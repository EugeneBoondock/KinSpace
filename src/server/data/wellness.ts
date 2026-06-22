import { and, eq, or, inArray, sql } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor, toDate, getProfileSummary, getProfileSummaries } from './_shared'
import {
  medicationReminders,
  medicationTakenLog,
  moodCheckins,
  symptomLogs,
  therapySessions,
  profiles,
  chatMessages,
  spoonStatuses,
  quietCheckins,
  connectionRequests,
  therapyFeedback,
} from '@/server/db/schema'
import { createNotification } from '@/server/notify'
import { encryptField, decryptField } from '@/server/crypto/field-encryption'
import { normalizeReminderTimes, reconcileProfileMedications } from '@/lib/medication-reminders'
import { normalizeMoodCheckin } from '@/lib/moods'

// ── Mood check-ins with pattern detection ───────────────────────────────────

/**
 * Records (or merges) today's mood check-in. Upserts on the unique
 * (userId, day) pair so a second call the same day overwrites the mood/note.
 * Mirrors the original Firestore `setDoc(..., { merge: true })` behavior.
 */
export async function recordMoodCheckin(
  ctx: Ctx,
  _userId: string,
  data: { mood: string; note?: string }) {
  const userId = requireActor(ctx)
  const today = new Date()
  const day = today.toISOString().slice(0, 10)
  const mood = normalizeMoodCheckin(data.mood)

  const note = (await encryptField(data.note ?? '')) ?? '' // Mood notes are private. Encrypt at rest.
  const existing = await ctx.db.query.moodCheckins.findFirst({
    where: and(eq(moodCheckins.userId, userId), eq(moodCheckins.day, day)),
  })

  if (existing) {
    await ctx.db
      .update(moodCheckins)
      .set({ mood, note })
      .where(eq(moodCheckins.id, existing.id))
    return { id: existing.id }
  }

  const id = crypto.randomUUID()
  await ctx.db.insert(moodCheckins).values({ id, userId, mood, note, day })
  return { id }
}

/**
 * Returns the actor's mood check-ins from the last `days` days, oldest first.
 * Reads about the authenticated user, so the actor is the source of truth.
 */
export async function getMoodCheckins(ctx: Ctx, _userId: string, days = 14) {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.moodCheckins.findMany({
    where: eq(moodCheckins.userId, userId),
  })
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const filtered = rows
    .filter((entry) => {
      const when = toDate(entry.createdAt as never) ?? toDate(entry.day as never)
      if (!when) return false
      return when.getTime() >= cutoff
    })
    .sort(
      (a, b) =>
        (toDate(a.createdAt as never) ?? new Date(0)).getTime() -
        (toDate(b.createdAt as never) ?? new Date(0)).getTime())
  return Promise.all(filtered.map(async (entry) => ({ ...entry, note: await decryptField(entry.note) })))
}

// ── Symptom tracking (the missing write path that feeds personal insights) ───

const MAX_SEVERITY = 10

/** Records one symptom severity reading. Severity is clamped to 0..10. */
export async function recordSymptomLog(
  ctx: Ctx,
  data: {
    symptom: string
    severity?: number | null
    conditionSlug?: string | null
    note?: string | null
    loggedAt?: string | Date | null
  }) {
  const userId = requireActor(ctx)
  const symptom = String(data.symptom ?? '').trim().slice(0, 120)
  if (!symptom) throw new Error('A symptom is required')
  const severity =
    typeof data.severity === 'number' && Number.isFinite(data.severity)
      ? Math.max(0, Math.min(MAX_SEVERITY, Math.round(data.severity)))
      : null
  const note = data.note ? ((await encryptField(String(data.note))) ?? null) : null
  const loggedAt = (data.loggedAt ? toDate(data.loggedAt as never) : null) ?? new Date()
  const id = crypto.randomUUID()
  await ctx.db.insert(symptomLogs).values({
    id,
    userId,
    symptom,
    severity,
    conditionSlug: data.conditionSlug ?? null,
    note,
    loggedAt,
  })
  return { id }
}

/**
 * One fast daily check-in: an optional mood plus any number of symptom severity
 * readings. Reuses the mood upsert (one per day) and appends symptom readings;
 * the insights engine aggregates per day, so re-checking in the same day is safe.
 */
export async function recordDailyCheckin(
  ctx: Ctx,
  data: {
    mood?: string | null
    note?: string | null
    symptoms?: Array<{ symptom: string; severity?: number | null; conditionSlug?: string | null }>
  }) {
  const userId = requireActor(ctx)
  let moodSaved: string | undefined
  if (data?.mood) {
    await recordMoodCheckin(ctx, userId, { mood: data.mood, note: data.note ?? '' })
    moodSaved = data.mood
  }
  const symptoms = Array.isArray(data?.symptoms) ? data.symptoms : []
  let symptomCount = 0
  for (const entry of symptoms) {
    if (!entry || !String(entry.symptom ?? '').trim()) continue
    await recordSymptomLog(ctx, {
      symptom: entry.symptom,
      severity: entry.severity ?? null,
      conditionSlug: entry.conditionSlug ?? null,
    })
    symptomCount += 1
  }
  return { ok: true, mood: moodSaved, symptoms: symptomCount }
}

/** The actor's symptom readings from the last `days` days, oldest first. */
export async function getSymptomLogs(ctx: Ctx, days = 30) {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.symptomLogs.findMany({ where: eq(symptomLogs.userId, userId) })
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const when = (row: (typeof rows)[number]) =>
    toDate(row.loggedAt as never) ?? toDate(row.createdAt as never) ?? new Date(0)
  const filtered = rows
    .filter((row) => when(row).getTime() >= cutoff)
    .sort((a, b) => when(a).getTime() - when(b).getTime())
  return Promise.all(
    filtered.map(async (row) => ({
      id: row.id,
      symptom: row.symptom,
      severity: row.severity,
      condition_slug: row.conditionSlug,
      note: await decryptField(row.note ?? ''),
      logged_at: (when(row)).toISOString(),
    })))
}

/** Distinct symptom names the actor has logged recently, to prefill the check-in. */
export async function getTrackedSymptoms(ctx: Ctx, days = 60) {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.symptomLogs.findMany({ where: eq(symptomLogs.userId, userId) })
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const seen = new Map<string, string>()
  for (const row of rows) {
    const when = toDate(row.loggedAt as never) ?? toDate(row.createdAt as never)
    if (!when || when.getTime() < cutoff) continue
    const key = row.symptom.trim().toLowerCase()
    if (key && !seen.has(key)) seen.set(key, row.symptom.trim())
  }
  return [...seen.values()]
}

// ── Therapy sessions (memory across rooms) ──────────────────────────────────

export async function startTherapySession(
  ctx: Ctx,
  _userId: string,
  data: { persona?: string | null; theme?: string | null; mood?: string | null }) {
  const userId = requireActor(ctx)
  const id = crypto.randomUUID()
  await ctx.db.insert(therapySessions).values({
    id,
    userId,
    persona: data.persona ?? null,
    theme: data.theme ?? null,
    moodAtStart: data.mood ?? null,
    messageCount: 0,
    summary: null,
  })
  return { id }
}

export async function touchTherapySession(ctx: Ctx, sessionId: string) {
  const userId = requireActor(ctx)
  const existing = await ctx.db.query.therapySessions.findFirst({ where: eq(therapySessions.id, sessionId) })
  if (!existing || existing.userId !== userId) return
  await ctx.db
    .update(therapySessions)
    .set({
      messageCount: sql`${therapySessions.messageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(therapySessions.id, sessionId))
}

export async function saveTherapySessionSummary(
  ctx: Ctx,
  sessionId: string,
  payload: { summary: string; mood_at_end?: string | null; key_themes?: string[] }) {
  const userId = requireActor(ctx)
  const existing = await ctx.db.query.therapySessions.findFirst({ where: eq(therapySessions.id, sessionId) })
  if (!existing || existing.userId !== userId) throw new Error('Not authorized')
  await ctx.db
    .update(therapySessions)
    .set({
      summary: await encryptField(payload.summary), // Therapy narrative is sensitive. Encrypt at rest.
      moodAtEnd: payload.mood_at_end ?? null,
      keyThemes: payload.key_themes ?? [],
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(therapySessions.id, sessionId))
}

export async function getRecentTherapySessions(ctx: Ctx, _userId: string, limitCount = 5) {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.therapySessions.findMany({
    where: eq(therapySessions.userId, userId),
  })
  const recent = rows
    .filter((session) => Boolean(session.summary))
    .sort(
      (a, b) =>
        (toDate(b.startedAt as never) ?? new Date(0)).getTime() -
        (toDate(a.startedAt as never) ?? new Date(0)).getTime())
    .slice(0, limitCount)
  return Promise.all(recent.map(async (s) => ({ ...s, summary: await decryptField(s.summary) })))
}

/**
 * Past therapy sessions for the actor, newest first, with the (decrypted)
 * summary and a count of messages tagged to each session. Feeds the
 * session-history panel.
 */
export async function getTherapySessionHistory(ctx: Ctx, _userId?: string, limitCount = 50) {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.therapySessions.findMany({
    where: eq(therapySessions.userId, userId),
  })
  const sorted = rows
    .sort(
      (a, b) =>
        (toDate(b.startedAt as never) ?? new Date(0)).getTime() -
        (toDate(a.startedAt as never) ?? new Date(0)).getTime())
    .slice(0, limitCount)

  return Promise.all(
    sorted.map(async (session) => {
      const msgs = await ctx.db.query.chatMessages.findMany({
        where: eq(chatMessages.sessionId, session.id),
      })
      return {
        id: session.id,
        persona: session.persona,
        theme: session.theme,
        moodAtStart: session.moodAtStart,
        moodAtEnd: session.moodAtEnd,
        summary: await decryptField(session.summary),
        keyThemes: session.keyThemes ?? [],
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        messageCount: msgs.length,
      }
    }))
}

/**
 * Read-only transcript for one past session. Verifies the session belongs to the
 * actor, then returns its messages oldest-first. Sessions whose messages predate
 * session tagging return [] (the UI falls back to the stored summary).
 */
export async function getTherapySessionMessages(ctx: Ctx, sessionId: string) {
  const userId = requireActor(ctx)
  const session = await ctx.db.query.therapySessions.findFirst({
    where: eq(therapySessions.id, sessionId),
  })
  if (!session || session.userId !== userId) return []

  const rows = await ctx.db.query.chatMessages.findMany({
    where: eq(chatMessages.sessionId, sessionId),
  })
  return rows
    .sort(
      (a, b) =>
        (toDate(a.createdAt as never) ?? new Date(0)).getTime() -
        (toDate(b.createdAt as never) ?? new Date(0)).getTime())
    .map((row) => ({
      id: row.id,
      message: row.message,
      isAi: row.isAi,
      senderId: row.senderId,
      createdAt: row.createdAt,
    }))
}

/** Cheap pattern detector. Returns a terse human note if the last 7 days trends in one direction. */
export async function analyzeMoodPattern(
  ctx: Ctx,
  _userId: string): Promise<{ streak: number; recent: string[]; hint: string | null }> {
  const recent = await getMoodCheckins(ctx, _userId, 14)
  const moods = recent.map((entry) => (entry.mood as string) ?? '').filter(Boolean)
  if (moods.length === 0) return { streak: 0, recent: [], hint: null }

  const heavy = moods.filter(
    (mood) => mood === 'heavy' || mood === 'tired' || mood === 'stretched').length
  const bright = moods.filter((mood) => mood === 'hopeful' || mood === 'grounded').length

  const tail = moods.slice(-5)
  let streak = 1
  for (let index = tail.length - 2; index >= 0; index -= 1) {
    if (tail[index] === tail[tail.length - 1]) streak += 1
    else break
  }

  let hint: string | null = null
  if (streak >= 4 && (tail[tail.length - 1] === 'heavy' || tail[tail.length - 1] === 'tired')) {
    hint = `You’ve logged “${tail[tail.length - 1]}” ${streak} days in a row. Please check in with a real human, your care team or an Angel here.`
  } else if (heavy >= Math.max(4, Math.floor(moods.length * 0.6))) {
    hint = `Mood has been mostly heavy the last couple of weeks. Consider slowing one thing down this week.`
  } else if (bright >= Math.floor(moods.length * 0.7)) {
    hint = `You've had a steady bright patch. If you want to protect it, the Guide can help you name what's working.`
  }

  return { streak, recent: moods, hint }
}

type MedicationReminderInput = {
  medication?: string | null
  dose?: string | null
  times?: string[] | null
  active?: boolean | null
}

function cleanReminderInput(data: MedicationReminderInput) {
  const medication = (data.medication ?? '').trim()
  const dose = (data.dose ?? '').trim()
  const times = normalizeReminderTimes(Array.isArray(data.times) ? data.times : [])

  return {
    medication,
    dose: dose || null,
    times,
    active: data.active !== false,
  }
}

async function syncMedicationProfileMirror(ctx: Ctx, userId: string, staleMedications: string[] = []) {
  const profile = await ctx.db.query.profiles.findFirst({ where: eq(profiles.userId, userId) })
  if (!profile) return

  const rows = await ctx.db.query.medicationReminders.findMany({
    where: eq(medicationReminders.userId, userId),
  })
  const current = Array.isArray(profile.medications) ? profile.medications.map(String) : []
  const next = reconcileProfileMedications(
    current,
    rows.map((row) => row.medication),
    staleMedications)

  if (current.length === next.length && current.every((medication, index) => medication === next[index])) return

  await ctx.db
    .update(profiles)
    .set({ medications: next, updatedAt: new Date() })
    .where(eq(profiles.userId, userId))
}

export async function getMedicationReminders(ctx: Ctx, _userId: string) {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.medicationReminders.findMany({
    where: eq(medicationReminders.userId, userId),
  })

  return rows
    .map((row) => ({
      ...row,
      times: normalizeReminderTimes(row.times ?? []),
    }))
    .sort((a, b) => a.medication.localeCompare(b.medication))
}

export async function createMedicationReminder(
  ctx: Ctx,
  _userId: string,
  data: MedicationReminderInput) {
  const userId = requireActor(ctx)
  const cleaned = cleanReminderInput(data)

  if (!cleaned.medication) throw new Error('Medication name is required')
  if (cleaned.times.length === 0) throw new Error('At least one reminder time is required')

  const id = crypto.randomUUID()
  await ctx.db.insert(medicationReminders).values({
    id,
    userId,
    medication: cleaned.medication,
    dose: cleaned.dose,
    times: cleaned.times,
    active: cleaned.active,
  })

  await syncMedicationProfileMirror(ctx, userId)

  return ctx.db.query.medicationReminders.findFirst({ where: eq(medicationReminders.id, id) })
}

export async function updateMedicationReminder(
  ctx: Ctx,
  _userId: string,
  reminderId: string,
  data: MedicationReminderInput) {
  const userId = requireActor(ctx)
  const existing = await ctx.db.query.medicationReminders.findFirst({
    where: eq(medicationReminders.id, reminderId),
  })
  if (!existing || existing.userId !== userId) throw new Error('Not authorized')

  const cleaned = cleanReminderInput({
    medication: data.medication ?? existing.medication,
    dose: data.dose ?? existing.dose,
    times: data.times ?? existing.times,
    active: data.active ?? existing.active,
  })

  if (!cleaned.medication) throw new Error('Medication name is required')
  if (cleaned.times.length === 0) throw new Error('At least one reminder time is required')

  await ctx.db
    .update(medicationReminders)
    .set({
      medication: cleaned.medication,
      dose: cleaned.dose,
      times: cleaned.times,
      active: cleaned.active,
      updatedAt: new Date(),
    })
    .where(eq(medicationReminders.id, reminderId))

  await syncMedicationProfileMirror(ctx, userId, [existing.medication])

  return ctx.db.query.medicationReminders.findFirst({ where: eq(medicationReminders.id, reminderId) })
}

export async function deleteMedicationReminder(ctx: Ctx, _userId: string, reminderId: string) {
  const userId = requireActor(ctx)
  const existing = await ctx.db.query.medicationReminders.findFirst({
    where: eq(medicationReminders.id, reminderId),
  })
  if (!existing || existing.userId !== userId) throw new Error('Not authorized')

  await ctx.db.delete(medicationReminders).where(eq(medicationReminders.id, reminderId))
  await syncMedicationProfileMirror(ctx, userId, [existing.medication])
  return { ok: true }
}

export async function markMedicationReminderTaken(ctx: Ctx, _userId: string, reminderId: string) {
  const userId = requireActor(ctx)
  const existing = await ctx.db.query.medicationReminders.findFirst({
    where: eq(medicationReminders.id, reminderId),
  })
  if (!existing || existing.userId !== userId) throw new Error('Not authorized')

  const now = new Date()
  await ctx.db
    .update(medicationReminders)
    .set({ lastTakenAt: now, updatedAt: now })
    .where(eq(medicationReminders.id, reminderId))

  // Append to the per-dose history that powers the activity calendar.
  await ctx.db.insert(medicationTakenLog).values({
    id: crypto.randomUUID(),
    userId,
    reminderId,
    medication: existing.medication,
    day: now.toISOString().slice(0, 10),
    takenAt: now,
  })

  return ctx.db.query.medicationReminders.findFirst({ where: eq(medicationReminders.id, reminderId) })
}

/**
 * Per-day activity for the calendar: which days had medication doses taken,
 * therapy sessions, and a mood check-in (with the mood). UTC days, matching how
 * check-ins are keyed. Returns the most recent `days` window, oldest first.
 */
export async function getActivityCalendar(ctx: Ctx, _userId?: string, days = 120) {
  const userId = requireActor(ctx)
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000

  const [moods, sessions, taken] = await Promise.all([
    ctx.db.query.moodCheckins.findMany({ where: eq(moodCheckins.userId, userId) }),
    ctx.db.query.therapySessions.findMany({ where: eq(therapySessions.userId, userId) }),
    ctx.db.query.medicationTakenLog.findMany({ where: eq(medicationTakenLog.userId, userId) }),
  ])

  type DayCell = { day: string; medsTaken: number; sessions: number; mood: string | null }
  const map = new Map<string, DayCell>()
  const cell = (day: string): DayCell => {
    const existing = map.get(day)
    if (existing) return existing
    const fresh: DayCell = { day, medsTaken: 0, sessions: 0, mood: null }
    map.set(day, fresh)
    return fresh
  }

  for (const entry of moods) {
    const day = String(entry.day ?? '').slice(0, 10)
    if (!day) continue
    const when = toDate(entry.createdAt as never)?.getTime() ?? new Date(`${day}T00:00:00Z`).getTime()
    if (when < cutoff) continue
    cell(day).mood = (entry.mood as string) ?? null
  }
  for (const session of sessions) {
    const when = toDate(session.startedAt as never)
    if (!when || when.getTime() < cutoff) continue
    cell(when.toISOString().slice(0, 10)).sessions += 1
  }
  for (const dose of taken) {
    const when = toDate(dose.takenAt as never)
    const day = String(dose.day ?? '').slice(0, 10) || (when ? when.toISOString().slice(0, 10) : '')
    if (!day) continue
    if (when && when.getTime() < cutoff) continue
    cell(day).medsTaken += 1
  }

  return Array.from(map.values()).sort((a, b) => (a.day < b.day ? -1 : 1))
}

// ── Spoons Today (opt-in, expiring capacity signal) ─────────────────────────

const SPOON_TTL_MS = 24 * 60 * 60 * 1000

/** Set today's capacity (1-5 spoons). Replaces any existing active status; auto-expires in 24h. */
export async function setSpoonStatus(
  ctx: Ctx,
  data: { spoons: number; note?: string | null; emoji?: string | null }) {
  const userId = requireActor(ctx)
  const spoons = Math.max(1, Math.min(5, Math.round(Number(data.spoons) || 0)))
  await ctx.db.delete(spoonStatuses).where(eq(spoonStatuses.userId, userId))
  const id = crypto.randomUUID()
  await ctx.db.insert(spoonStatuses).values({
    id,
    userId,
    spoons,
    note: data.note ? String(data.note).slice(0, 140) : null,
    emoji: data.emoji ? String(data.emoji).slice(0, 8) : null,
    expiresAt: new Date(Date.now() + SPOON_TTL_MS),
  })
  return { id, spoons }
}

/** The actor's current (non-expired) spoon status, or null. */
export async function getMySpoonStatus(ctx: Ctx) {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.spoonStatuses.findMany({ where: eq(spoonStatuses.userId, userId) })
  const now = Date.now()
  const active = rows.find((row) => (toDate(row.expiresAt as never)?.getTime() ?? 0) > now)
  if (!active) return null
  return { id: active.id, spoons: active.spoons, note: active.note, emoji: active.emoji, expires_at: active.expiresAt }
}

/** Active spoon statuses among the actor's accepted connections (their circle). */
export async function getCircleSpoons(ctx: Ctx) {
  const userId = requireActor(ctx)
  const conns = await ctx.db.query.connectionRequests.findMany({
    where: or(eq(connectionRequests.requesterId, userId), eq(connectionRequests.targetUserId, userId)),
  })
  const partnerIds = conns
    .filter((row) => row.status === 'accepted')
    .map((row) => (row.requesterId === userId ? row.targetUserId : row.requesterId))
  if (partnerIds.length === 0) return []

  const now = Date.now()
  const statuses = await ctx.db.query.spoonStatuses.findMany({ where: inArray(spoonStatuses.userId, partnerIds) })
  const active = statuses.filter((row) => (toDate(row.expiresAt as never)?.getTime() ?? 0) > now)
  const profilesMap = await getProfileSummaries(ctx.db, active.map((row) => row.userId))
  return active
    .sort((a, b) => a.spoons - b.spoons)
    .map((row) => ({
      user_id: row.userId,
      spoons: row.spoons,
      note: row.note,
      emoji: row.emoji,
      profile: profilesMap.get(row.userId) ?? null,
    }))
}

/** Record thumbs up/down feedback on a Guide reply (for prompt tuning). */
export async function recordTherapyFeedback(
  ctx: Ctx,
  data: { sessionId?: string | null; value: 'up' | 'down'; reason?: string | null; snippet?: string | null }) {
  const userId = requireActor(ctx)
  const value = data.value === 'up' ? 'up' : 'down'
  await ctx.db.insert(therapyFeedback).values({
    id: crypto.randomUUID(),
    userId,
    sessionId: data.sessionId ?? null,
    value,
    reason: data.reason ? String(data.reason).slice(0, 120) : null,
    snippet: data.snippet ? String(data.snippet).slice(0, 300) : null,
  })
  return { ok: true }
}

/** Send a wordless "thinking of you" 💛 to someone (often after seeing low spoons). */
export async function sendQuietCheckin(ctx: Ctx, toUser: string) {
  const userId = requireActor(ctx)
  if (!toUser || toUser === userId) throw new Error('Invalid recipient')
  await ctx.db.insert(quietCheckins).values({ id: crypto.randomUUID(), fromUser: userId, toUser })
  const me = await getProfileSummary(ctx.db, userId)
  const name = me?.isAnonymous ? me?.pseudonym || 'Someone' : me?.fullName || me?.username || 'Someone'
  await createNotification(ctx.db, toUser, {
    type: 'quiet_checkin',
    title: `${name} sent you a quiet 💛`,
    data: { from_user_id: userId },
  })
  return { ok: true }
}
