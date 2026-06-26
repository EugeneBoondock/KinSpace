import { eq } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor, toDate } from './_shared'
import {
  journalEntries,
  moodCheckins,
  symptomLogs,
  medicationTakenLog,
  medicationReminders,
  therapySessions,
  spoonStatuses,
} from '@/server/db/schema'
import { analyzeMoodPattern } from './wellness'
import { encryptField } from '@/server/crypto/field-encryption'
import {
  buildInsightReviewNote,
  buildPersonalInsights,
  MOOD_VALENCE,
  DAY_MS,
  type PersonalInsights,
} from './personal-insights-core'

export type { PersonalInsights } from './personal-insights-core'

/**
 * Loads a member's own tracking signals over the window and runs the pure
 * insights core (./personal-insights-core). Read-only, actor-scoped; returns the
 * snake_case-serialized shape the /insights page renders.
 */
export async function getPersonalInsights(ctx: Ctx, days = 30): Promise<PersonalInsights> {
  const userId = requireActor(ctx)
  const windowDays = days === 14 || days === 90 ? days : 30
  const today = new Date().toISOString().slice(0, 10)
  const windowStart = new Date(Date.parse(today + 'T00:00:00Z') - (windowDays - 1) * DAY_MS).toISOString().slice(0, 10)
  const inWindow = (day: string | null | undefined): day is string => !!day && day >= windowStart && day <= today
  const dayOf = (value: unknown): string | null => {
    const d = toDate(value as never)
    return d ? d.toISOString().slice(0, 10) : null
  }

  const [moodRows, symptomRows, medRows, reminderRows, therapyRows, spoonRows] = await Promise.all([
    ctx.db.query.moodCheckins.findMany({ where: eq(moodCheckins.userId, userId) }),
    ctx.db.query.symptomLogs.findMany({ where: eq(symptomLogs.userId, userId) }),
    ctx.db.query.medicationTakenLog.findMany({ where: eq(medicationTakenLog.userId, userId) }),
    ctx.db.query.medicationReminders.findMany({ where: eq(medicationReminders.userId, userId) }),
    ctx.db.query.therapySessions.findMany({ where: eq(therapySessions.userId, userId) }),
    ctx.db.query.spoonStatuses.findMany({ where: eq(spoonStatuses.userId, userId) }),
  ])

  const mood = new Map<string, number>()
  for (const row of moodRows) {
    if (!inWindow(row.day)) continue
    const v = MOOD_VALENCE[row.mood]
    if (v) mood.set(row.day, v)
  }

  const symAccum = new Map<string, Map<string, number[]>>()
  for (const row of symptomRows) {
    if (typeof row.severity !== 'number') continue
    const day = dayOf(row.loggedAt) ?? dayOf(row.createdAt)
    if (!inWindow(day)) continue
    const perSym = symAccum.get(day) ?? new Map<string, number[]>()
    const key = row.symptom.trim()
    const list = perSym.get(key) ?? []
    list.push(row.severity)
    perSym.set(key, list)
    symAccum.set(day, perSym)
  }
  const symptoms = new Map<string, Map<string, number>>()
  for (const [day, perSym] of symAccum) {
    const collapsed = new Map<string, number>()
    for (const [sym, vals] of perSym) collapsed.set(sym, vals.reduce((s, x) => s + x, 0) / vals.length)
    symptoms.set(day, collapsed)
  }

  const medTaken = new Set<string>()
  for (const row of medRows) if (inWindow(row.day)) medTaken.add(row.day)

  // Confirmed "due" days: every window day on/after an active reminder's creation.
  const medDue = new Set<string>()
  const earliestActive = reminderRows
    .filter((r) => r.active)
    .map((r) => dayOf(r.createdAt))
    .filter((d): d is string => !!d)
    .sort()[0]
  if (earliestActive) {
    for (let k = 0; k < windowDays; k++) {
      const d = new Date(Date.parse(today + 'T00:00:00Z') - k * DAY_MS).toISOString().slice(0, 10)
      if (d >= earliestActive && d >= windowStart) medDue.add(d)
    }
  }

  const spoons = new Map<string, number>()
  for (const row of spoonRows) {
    const day = dayOf(row.createdAt)
    if (inWindow(day) && typeof row.spoons === 'number') spoons.set(day, row.spoons)
  }

  const therapy = new Set<string>()
  for (const row of therapyRows) {
    // therapy_sessions.startedAt IS the created_at column (see columns.ts pk/createdAt helper).
    const day = dayOf(row.startedAt)
    if (inWindow(day)) therapy.add(day)
  }

  let crisisNudge: string | null = null
  try {
    const pattern = (await analyzeMoodPattern(ctx, userId)) as { hint?: string | null }
    crisisNudge = pattern?.hint ?? null
  } catch {
    crisisNudge = null
  }

  return buildPersonalInsights({
    windowDays,
    today,
    mood,
    symptoms,
    medTaken,
    medDue,
    spoons,
    therapy,
    crisisNudge,
    generatedAt: new Date().toISOString(),
  })
}

export async function savePersonalInsightReviewNote(ctx: Ctx, _userId: string, days = 30) {
  const userId = requireActor(ctx)
  const insights = await getPersonalInsights(ctx, days)
  const note = buildInsightReviewNote(insights)
  const id = crypto.randomUUID()

  await ctx.db.insert(journalEntries).values({
    id,
    userId,
    title: (await encryptField(note.title)) ?? note.title,
    body: (await encryptField(note.body)) ?? note.body,
    tags: note.tags,
    eventKind: 'journal',
    isPrivate: true,
  })

  return { id, title: note.title, href: '/timeline' }
}
