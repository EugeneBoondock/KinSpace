import { NextRequest, NextResponse } from 'next/server'
import { therapyChat, type TherapyContext, type TherapyMessage } from '@/lib/ai/therapy'
import { getAdminDb, isAdminConfigured } from '@/lib/server/firebase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RequestBody = {
  userId?: string
  messages?: TherapyMessage[]
  /**
   * Client can pass a pre-hydrated profile snapshot so we can skip the read
   * when the client already has it cached. We re-verify against the userId.
   */
  profileCache?: Record<string, unknown> | null
}

type InsightEntry = TherapyContext['conditionInsights'][number]

async function hydrateContext(
  db: FirebaseFirestore.Firestore,
  userId: string,
  profileCache: Record<string, unknown> | null,
): Promise<TherapyContext | null> {
  const profile = profileCache ?? (await db.collection('profiles').doc(userId).get()).data()
  if (!profile) return null

  const conditions = Array.isArray(profile.conditions) ? (profile.conditions as string[]) : []

  // Build an alias/name → slug map by reading the conditions collection once.
  const conditionsSnap = await db.collection('conditions').get()
  const aliasToSlug = new Map<string, string>()
  conditionsSnap.docs.forEach((doc) => {
    const data = doc.data()
    const slug = doc.id
    aliasToSlug.set(slug.toLowerCase(), slug)
    const name = String(data.name ?? '').toLowerCase()
    if (name) aliasToSlug.set(name, slug)
    if (Array.isArray(data.aliases)) {
      for (const alias of data.aliases) {
        if (typeof alias === 'string') aliasToSlug.set(alias.toLowerCase(), slug)
      }
    }
  })

  function resolveSlug(input: string): string {
    const raw = String(input).trim().toLowerCase()
    if (aliasToSlug.has(raw)) return aliasToSlug.get(raw)!
    const kebab = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return aliasToSlug.get(kebab) ?? kebab
  }

  // Pull top 3 community-rated treatments per condition
  const conditionInsights: InsightEntry[] = await Promise.all(
    conditions.slice(0, 4).map(async (conditionName) => {
      const slug = resolveSlug(conditionName)
      const snap = await db
        .collection('condition_treatments')
        .where('condition_slug', '==', slug)
        .limit(5)
        .get()
      const rows = snap.docs
        .map((doc) => doc.data())
        .sort((a, b) => (b.effectiveness_avg ?? 0) - (a.effectiveness_avg ?? 0))
        .slice(0, 3)

      const treatments = await Promise.all(
        rows.map(async (row) => {
          const treatmentSnap = await db.collection('treatments').doc(row.treatment_slug as string).get()
          const name = (treatmentSnap.exists ? (treatmentSnap.data()?.name as string) : row.treatment_slug as string) ?? ''
          return {
            name,
            effectiveness: Number(row.effectiveness_avg ?? 0),
            count: Number(row.effectiveness_count ?? 0),
          }
        }),
      )

      return {
        condition: conditionName,
        topTreatments: treatments.filter((treatment) => treatment.name),
      }
    }),
  )

  // Recent mood log + pattern
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
  const moodSnap = await db
    .collection('mood_checkins')
    .where('user_id', '==', userId)
    .get()
    .catch(() => null)
  const recentMoods = moodSnap
    ? moodSnap.docs
        .map((doc) => doc.data())
        .filter((entry) => {
          const when = entry.created_at?.toDate?.() ?? (entry.day ? new Date(entry.day) : null)
          return when && when.getTime() >= cutoff
        })
        .sort((a, b) => {
          const aTime = a.created_at?.toDate?.()?.getTime() ?? 0
          const bTime = b.created_at?.toDate?.()?.getTime() ?? 0
          return aTime - bTime
        })
        .map((entry) => ({
          day: String(entry.day ?? '').slice(0, 10),
          mood: String(entry.mood ?? ''),
        }))
        .filter((entry) => entry.day && entry.mood)
    : []

  let moodPatternHint: string | null = null
  if (recentMoods.length >= 3) {
    const heavy = recentMoods.filter((entry) =>
      ['heavy', 'tired', 'stretched'].includes(entry.mood),
    ).length
    const bright = recentMoods.filter((entry) => ['hopeful', 'grounded'].includes(entry.mood)).length
    const tail = recentMoods.slice(-5).map((entry) => entry.mood)
    let streak = 1
    for (let index = tail.length - 2; index >= 0; index -= 1) {
      if (tail[index] === tail[tail.length - 1]) streak += 1
      else break
    }
    if (streak >= 3 && ['heavy', 'tired'].includes(tail[tail.length - 1])) {
      moodPatternHint = `User has logged "${tail[tail.length - 1]}" ${streak} days in a row.`
    } else if (heavy >= Math.max(4, Math.floor(recentMoods.length * 0.6))) {
      moodPatternHint = `Mood has been mostly heavy/tired for the last two weeks.`
    } else if (bright >= Math.floor(recentMoods.length * 0.7)) {
      moodPatternHint = `User has been in a steady bright patch — hopeful/grounded mostly.`
    }
  }

  return {
    userId,
    displayName: (profile.full_name as string | undefined) || (profile.username as string | undefined) || 'friend',
    pronouns: (profile.pronouns as string | undefined) ?? null,
    age: (profile.age as number | undefined) ?? null,
    location: (profile.location as string | undefined) ?? null,
    conditions,
    medications: Array.isArray(profile.medications) ? (profile.medications as string[]) : [],
    comorbidities: Array.isArray(profile.comorbidities) ? (profile.comorbidities as string[]) : [],
    goals: Array.isArray(profile.mental_health_goals) ? (profile.mental_health_goals as string[]) : [],
    interests: Array.isArray(profile.interests) ? (profile.interests as string[]) : [],
    preferredCommunication: (profile.preferred_communication as string | undefined) ?? null,
    conditionInsights,
    currentMood: (profile.daily_mood as string | undefined) ?? null,
    currentMoodAt: profile.mood_updated_at ? new Date(profile.mood_updated_at as string) : null,
    recentMoods,
    moodPatternHint,
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY is not set.' }, { status: 500 })
  }
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Firebase Admin not configured — cannot load user context securely.' },
      { status: 500 },
    )
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.userId || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ ok: false, error: 'userId and messages required' }, { status: 400 })
  }

  // Sanitise messages — we only accept user/assistant roles, and trim length.
  const sanitised: TherapyMessage[] = body.messages
    .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
    .map((message) => ({
      role: message.role,
      content: String(message.content ?? '').slice(0, 4000),
    }))
    .filter((message) => message.content.length > 0)

  if (sanitised.length === 0) {
    return NextResponse.json({ ok: false, error: 'No valid messages' }, { status: 400 })
  }

  const db = getAdminDb()
  const context = await hydrateContext(db, body.userId, body.profileCache ?? null)
  if (!context) {
    return NextResponse.json({ ok: false, error: 'Profile not found' }, { status: 404 })
  }

  try {
    const result = await therapyChat(context, sanitised)
    return NextResponse.json({
      ok: true,
      reply: result.reply,
      isCrisis: result.isCrisis,
    })
  } catch (error) {
    console.error('Therapy chat failed:', error)
    return NextResponse.json({ ok: false, error: 'Therapy chat failed' }, { status: 500 })
  }
}
