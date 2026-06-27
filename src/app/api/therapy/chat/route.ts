import { NextRequest, NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { therapyChat, type TherapyContext, type TherapyMessage } from '@/lib/ai/therapy'
import { getDb } from '@/server/db/client'
import {
  profiles,
  conditionTreatments,
  treatments,
  moodCheckins,
  therapySessions,
  medicationReminders,
} from '@/server/db/schema'
import { getSessionUserId } from '@/server/http/auth'
import { rateLimit } from '@/server/http/rate-limit'
import { checkAndConsume, refundConsumedUsage, type QuotaResult } from '@/server/billing/repo'
import { detectCrisisInMessages } from '@/server/ai/safety'
import { decryptField } from '@/server/crypto/field-encryption'
import { normaliseGuideAttachments, toGuideModelMessageContent } from '@/lib/guide-media'
import { getOrBuildGuideMemory, normaliseGuidePersonaId } from '@/server/therapy/guide-memory'
import { recordAiPrivacyAuditEvent } from '@/server/privacy/ai-audit'
import { getPersona } from '@/lib/therapy-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RequestBody = { messages?: TherapyMessage[]; sessionId?: string | null; personaId?: string | null }
type Db = ReturnType<typeof getDb>

async function hydrateContext(db: Db, userId: string, personaOverride?: string | null): Promise<TherapyContext | null> {
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) })
  if (!profile) return null

  // Consent gate. Default ON (legacy rows have null → treated as shared); the user
  // can opt out in Settings, after which no health detail reaches the Guide.
  const shareHealth = profile.shareHealthWithGuide !== false
  const selectedPersonaId = normaliseGuidePersonaId(personaOverride ?? profile.therapistPersona ?? null)

  const conditions = shareHealth ? (profile.conditions ?? []) : []
  const accessNeeds = shareHealth ? (profile.accessNeeds ?? []) : []

  const allConditions = await db.query.conditions.findMany()
  const aliasToSlug = new Map<string, string>()
  for (const c of allConditions) {
    aliasToSlug.set(c.slug.toLowerCase(), c.slug)
    if (c.name) aliasToSlug.set(c.name.toLowerCase(), c.slug)
    for (const alias of c.aliases ?? []) aliasToSlug.set(String(alias).toLowerCase(), c.slug)
  }
  const resolveSlug = (input: string): string => {
    const raw = input.trim().toLowerCase()
    if (aliasToSlug.has(raw)) return aliasToSlug.get(raw)!
    const kebab = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return aliasToSlug.get(kebab) ?? kebab
  }

  const conditionInsights = await Promise.all(
    conditions.slice(0, 4).map(async (conditionName) => {
      const slug = resolveSlug(conditionName)
      const rows = await db.query.conditionTreatments.findMany({
        where: eq(conditionTreatments.conditionSlug, slug),
        limit: 5,
      })
      const top = rows
        .sort((a, b) => (b.effectivenessAvg ?? 0) - (a.effectivenessAvg ?? 0))
        .slice(0, 3)
      const topTreatments = await Promise.all(
        top.map(async (row) => {
          const t = await db.query.treatments.findFirst({ where: eq(treatments.slug, row.treatmentSlug) })
          return {
            name: t?.name ?? row.treatmentSlug,
            effectiveness: Number(row.effectivenessAvg ?? 0),
            count: Number(row.effectivenessCount ?? 0),
          }
        }),
      )
      return { condition: conditionName, topTreatments: topTreatments.filter((t) => t.name) }
    }),
  )

  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
  const moodRows = await db.query.moodCheckins.findMany({ where: eq(moodCheckins.userId, userId) })
  const recentMoods = moodRows
    .filter((m) => {
      const when = m.createdAt ?? (m.day ? new Date(m.day) : null)
      return when ? when.getTime() >= cutoff : false
    })
    .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0))
    .map((m) => ({ day: String(m.day ?? '').slice(0, 10), mood: String(m.mood ?? '') }))
    .filter((m) => m.day && m.mood)

  let moodPatternHint: string | null = null
  if (recentMoods.length >= 3) {
    const heavy = recentMoods.filter((e) => ['heavy', 'tired', 'stretched'].includes(e.mood)).length
    const bright = recentMoods.filter((e) => ['hopeful', 'grounded'].includes(e.mood)).length
    const tail = recentMoods.slice(-5).map((e) => e.mood)
    let streak = 1
    for (let i = tail.length - 2; i >= 0; i -= 1) {
      if (tail[i] === tail[tail.length - 1]) streak += 1
      else break
    }
    if (streak >= 3 && ['heavy', 'tired'].includes(tail[tail.length - 1])) {
      moodPatternHint = `User has logged "${tail[tail.length - 1]}" ${streak} days in a row.`
    } else if (heavy >= Math.max(4, Math.floor(recentMoods.length * 0.6))) {
      moodPatternHint = 'Mood has been mostly heavy/tired for the last two weeks.'
    } else if (bright >= Math.floor(recentMoods.length * 0.7)) {
      moodPatternHint = 'User has been in a steady bright patch - hopeful/grounded mostly.'
    }
  }

  const priorRows = await db.query.therapySessions.findMany({ where: eq(therapySessions.userId, userId) })
  const priorSessions = await Promise.all(
    priorRows
      .filter((s) => Boolean(s.summary))
      .filter((s) => normaliseGuidePersonaId(s.persona) === selectedPersonaId)
      .sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0))
      .slice(0, 5)
      .map(async (s) => ({
        summary: (await decryptField(s.summary)) ?? '',
        key_themes: s.keyThemes ?? [],
        mood_at_start: s.moodAtStart ?? null,
        mood_at_end: s.moodAtEnd ?? null,
        started_at: s.startedAt?.toISOString() ?? null,
      })),
  )
  const guideMemory = await getOrBuildGuideMemory(db, userId, selectedPersonaId).catch(() => null)

  // Bridge the medication shelf into what the Guide knows. The shelf (reminders)
  // is where users actually log what they take, so active reminders are the
  // authoritative "currently taking" list; profile meds fill in the rest. Names
  // are de-duped on their base (dose-stripped) name so "Metformin" and
  // "Metformin (500 mg)" never both appear.
  const medications: string[] = []
  if (shareHealth) {
    const baseName = (value: string) => value.replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase()
    const seen = new Set<string>()
    const reminderRows = await db.query.medicationReminders.findMany({
      where: eq(medicationReminders.userId, userId),
    })
    for (const row of reminderRows) {
      if (row.active === false) continue
      const name = (row.medication ?? '').trim()
      if (!name) continue
      const label = row.dose ? `${name} (${row.dose})` : name
      const key = baseName(label)
      if (seen.has(key)) continue
      seen.add(key)
      medications.push(label)
    }
    for (const med of profile.medications ?? []) {
      const key = baseName(String(med))
      if (!key || seen.has(key)) continue
      seen.add(key)
      medications.push(String(med))
    }
  }

  return {
    userId,
    displayName: profile.fullName || profile.username || 'friend',
    pronouns: profile.pronouns ?? null,
    age: profile.age ?? null,
    location: profile.location ?? null,
    conditions,
    medications,
    healthShared: shareHealth,
    comorbidities: shareHealth ? (profile.comorbidities ?? []) : [],
    accessNeeds,
    goals: profile.mentalHealthGoals ?? [],
    interests: profile.interests ?? [],
    preferredCommunication: profile.preferredCommunication ?? null,
    conditionInsights,
    currentMood: profile.dailyMood ?? null,
    currentMoodAt: profile.moodUpdatedAt ?? null,
    recentMoods,
    moodPatternHint,
    personaId: selectedPersonaId,
    priorSessions,
    guideMemory,
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: 'AI is not configured.' }, { status: 500 })
  }

  const userId = await getSessionUserId(request)
  if (!userId) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 })

  const limited = await rateLimit(`therapy:${userId}`, 30, 60)
  if (!limited.allowed) {
    return NextResponse.json({ ok: false, error: 'Slow down a moment, then try again.' }, { status: 429 })
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 })
  }

  const sanitised: TherapyMessage[] = (body.messages ?? [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({
      role: m.role,
      content: toGuideModelMessageContent(
        String(m.content ?? '').slice(0, 8000),
        normaliseGuideAttachments((m as { attachments?: unknown }).attachments),
      ).slice(0, 6000),
    }))
    .filter((m) => m.content.length > 0)
  if (sanitised.length === 0) {
    return NextResponse.json({ ok: false, error: 'No message provided.' }, { status: 400 })
  }

  const db = getDb()

  // Quota counts SESSIONS, not messages: consume one unit only on the first
  // message of a session. Continuing an existing session is always free. Admins
  // and paid tiers bypass inside checkAndConsume.
  let isNewSession = true
  let ownedSessionId: string | null = null
  if (body.sessionId) {
    const sessionRow = await db.query.therapySessions.findFirst({
      where: eq(therapySessions.id, body.sessionId),
    })
    if (sessionRow) {
      if (sessionRow.userId !== userId) {
        return NextResponse.json({ ok: false, error: 'Session not found.' }, { status: 404 })
      }
      ownedSessionId = sessionRow.id
      if ((sessionRow.messageCount ?? 0) > 0) isNewSession = false
    }
  }

  const context = await hydrateContext(db, userId, body.personaId ?? null)
  if (!context) return NextResponse.json({ ok: false, error: 'Complete your profile first.' }, { status: 404 })

  let quota: QuotaResult | null = null
  if (isNewSession) {
    quota = await checkAndConsume(userId, 'ai_therapy')
    if (!quota.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `You have used your ${quota.limit} monthly Guide sessions. Upgrade to KinSpace Plus or add Guide credits to keep chatting.`,
          upgrade: true,
        },
        { status: 402 },
      )
    }
  }

  void recordAiPrivacyAuditEvent(db, {
    actorId: userId,
    action: 'ai.guide.context_read',
    targetId: context.personaId ?? null,
    meta: {
      personaId: context.personaId ?? null,
      personaName: getPersona(context.personaId ?? null).name,
      healthShared: context.healthShared !== false,
      conditionCount: context.conditions.length,
      medicationCount: context.medications.length,
      accessNeedCount: context.accessNeeds.length,
      priorSessionCount: context.priorSessions?.length ?? 0,
      hasGuideMemory: Boolean(context.guideMemory?.summary),
      sessionId: body.sessionId ?? null,
    },
  }).catch(() => undefined)

  if (ownedSessionId) {
    void db
      .update(therapySessions)
      .set({ messageCount: sql`${therapySessions.messageCount} + 1`, updatedAt: new Date() })
      .where(eq(therapySessions.id, ownedSessionId))
      .catch(() => undefined)
  }

  try {
    const result = await therapyChat(context, sanitised)
    const isCrisis = result.isCrisis || detectCrisisInMessages(sanitised)
    return NextResponse.json({ ok: true, reply: result.reply, isCrisis, endSession: result.endSession && !isCrisis })
  } catch (error) {
    if (isNewSession) await refundConsumedUsage(userId, 'ai_therapy', quota).catch(() => undefined)
    // Log the real error so failures are diagnosable in `wrangler tail` (the
    // generic message below is all the user sees). Most common cause: an invalid
    // or expired OPENAI_API_KEY → OpenAI returns 401.
    const status = (error as { status?: number })?.status
    const detail = error instanceof Error ? error.message : String(error)
    console.error(`Therapy chat failed (status=${status ?? 'n/a'}): ${detail}`)
    return NextResponse.json({ ok: false, error: 'The Guide is unavailable right now.' }, { status: 500 })
  }
}
