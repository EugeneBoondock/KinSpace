import { eq, desc } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor, toDate } from './_shared'
import { moodCheckins, symptomLogs, treatmentLogs, journalEntries, medicationReminders } from '@/server/db/schema'
import { decryptField } from '@/server/crypto/field-encryption'

const PER_TABLE_LIMIT = 50
const DEFAULT_EVENT_LIMIT = 60
const SNIPPET_LENGTH = 140

export type TimelineEventType =
  | 'mood'
  | 'symptom'
  | 'treatment'
  | 'side_effect'
  | 'journal'
  | 'medication'
  | 'life_event'

export type TimelineEvent = {
  id: string
  type: TimelineEventType
  at: string
  title: string
  detail?: string
  value?: number | null
  condition_slug?: string | null
  symptom?: string | null
  treatment?: string | null
  side_effect?: string | null
  medication?: string | null
}

export type TimelineStats = {
  total_events: number
  mood_checkins: number
  symptoms_logged: number
  treatments_logged: number
  side_effects_logged: number
  journal_entries: number
  medication_events: number
  life_events: number
}

export type HealthTimeline = {
  events: TimelineEvent[]
  stats: TimelineStats
}

type MoodRow = {
  id: string
  mood: string
  note?: string | null
  createdAt?: unknown
}

type SymptomRow = {
  id: string
  symptom: string
  severity?: number | null
  conditionSlug?: string | null
  note?: string | null
  loggedAt?: unknown
  createdAt?: unknown
}

type TreatmentRow = {
  id: string
  treatment: string
  effectiveness?: number | null
  conditionSlug?: string | null
  sideEffects?: unknown
  startedAt?: unknown
  notes?: string | null
  createdAt?: unknown
}

type JournalRow = {
  id: string
  title?: string | null
  body?: string | null
  eventKind?: string | null
  conditionSlug?: string | null
  symptom?: string | null
  treatment?: string | null
  medication?: string | null
  intensity?: number | null
  createdAt?: unknown
}

type MedicationRow = {
  id: string
  medication: string
  dose?: string | null
  conditionSlug?: string | null
  lastTakenAt?: unknown
  createdAt?: unknown
}

export type TimelineSourceRows = {
  moods: MoodRow[]
  symptoms: SymptomRow[]
  treatments: TreatmentRow[]
  journals: JournalRow[]
  medications: MedicationRow[]
}

function toIso(value: unknown): string {
  const date = toDate(value)
  return (date ?? new Date(0)).toISOString()
}

function snippet(value: string | null | undefined): string | undefined {
  const text = (value ?? '').trim()
  if (!text) return undefined
  return text.length > SNIPPET_LENGTH ? `${text.slice(0, SNIPPET_LENGTH).trimEnd()}...` : text
}

function cleanStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean)))
}

function cleanText(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text || null
}

function journalType(kind: string | null | undefined): 'journal' | 'life_event' {
  return kind === 'life_event' ? 'life_event' : 'journal'
}

export function buildHealthTimelineEvents(source: TimelineSourceRows): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const row of source.moods) {
    events.push({
      id: `mood:${row.id}`,
      type: 'mood',
      at: toIso(row.createdAt),
      title: row.mood,
      detail: snippet(row.note),
    })
  }

  for (const row of source.symptoms) {
    events.push({
      id: `symptom:${row.id}`,
      type: 'symptom',
      at: toIso(row.loggedAt ?? row.createdAt),
      title: row.symptom,
      value: row.severity ?? null,
      detail: snippet(row.note),
      condition_slug: row.conditionSlug ?? null,
      symptom: row.symptom,
    })
  }

  for (const row of source.treatments) {
    const at = toIso(row.startedAt ?? row.createdAt)
    const sideEffects = cleanStringList(row.sideEffects)
    for (const sideEffect of sideEffects) {
      events.push({
        id: `side_effect:${row.id}:${sideEffect.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        type: 'side_effect',
        at,
        title: sideEffect,
        detail: `Reported with ${row.treatment}`,
        condition_slug: row.conditionSlug ?? null,
        treatment: row.treatment,
        side_effect: sideEffect,
      })
    }
    events.push({
      id: `treatment:${row.id}`,
      type: 'treatment',
      at,
      title: row.treatment,
      value: row.effectiveness ?? null,
      detail: snippet(row.notes),
      condition_slug: row.conditionSlug ?? null,
      treatment: row.treatment,
    })
  }

  for (const row of source.journals) {
    const title = cleanText(row.title)
    const type = journalType(row.eventKind)
    events.push({
      id: `${type}:${row.id}`,
      type,
      at: toIso(row.createdAt),
      title: title || (type === 'life_event' ? 'Life event' : 'Journal entry'),
      detail: snippet(row.body),
      value: row.intensity ?? null,
      condition_slug: row.conditionSlug ?? null,
      symptom: row.symptom ?? null,
      treatment: row.treatment ?? null,
      medication: row.medication ?? null,
    })
  }

  for (const row of source.medications) {
    if (!row.lastTakenAt) continue
    events.push({
      id: `medication:${row.id}`,
      type: 'medication',
      at: toIso(row.lastTakenAt),
      title: row.medication,
      detail: cleanText(row.dose) ? `Dose: ${row.dose}` : undefined,
      condition_slug: row.conditionSlug ?? null,
      medication: row.medication,
    })
  }

  return events.sort((a, b) => b.at.localeCompare(a.at))
}

function timelineStats(events: TimelineEvent[], source: TimelineSourceRows): TimelineStats {
  return {
    total_events: events.length,
    mood_checkins: source.moods.length,
    symptoms_logged: source.symptoms.length,
    treatments_logged: source.treatments.length,
    side_effects_logged: events.filter((event) => event.type === 'side_effect').length,
    journal_entries: source.journals.filter((row) => journalType(row.eventKind) === 'journal').length,
    medication_events: events.filter((event) => event.type === 'medication').length,
    life_events: events.filter((event) => event.type === 'life_event').length,
  }
}

export async function getHealthTimeline(
  ctx: Ctx,
  _userId: string,
  opts?: { limit?: number },
): Promise<HealthTimeline> {
  const actor = requireActor(ctx)

  const [moods, symptoms, treatments, journals, medications] = await Promise.all([
    ctx.db.query.moodCheckins.findMany({
      where: eq(moodCheckins.userId, actor),
      orderBy: [desc(moodCheckins.createdAt)],
      limit: PER_TABLE_LIMIT,
    }),
    ctx.db.query.symptomLogs.findMany({
      where: eq(symptomLogs.userId, actor),
      orderBy: [desc(symptomLogs.createdAt)],
      limit: PER_TABLE_LIMIT,
    }),
    ctx.db.query.treatmentLogs.findMany({
      where: eq(treatmentLogs.userId, actor),
      orderBy: [desc(treatmentLogs.createdAt)],
      limit: PER_TABLE_LIMIT,
    }),
    ctx.db.query.journalEntries.findMany({
      where: eq(journalEntries.userId, actor),
      orderBy: [desc(journalEntries.createdAt)],
      limit: PER_TABLE_LIMIT,
    }),
    ctx.db.query.medicationReminders.findMany({
      where: eq(medicationReminders.userId, actor),
      orderBy: [desc(medicationReminders.updatedAt)],
      limit: PER_TABLE_LIMIT,
    }),
  ])

  const decryptedJournals = await Promise.all(
    journals.map(async (row) => ({
      ...row,
      title: (await decryptField(row.title)) ?? row.title,
      body: (await decryptField(row.body)) ?? row.body,
    })),
  )
  const source = { moods, symptoms, treatments, journals: decryptedJournals, medications }
  const events = buildHealthTimelineEvents(source)
  const limit = opts?.limit ?? DEFAULT_EVENT_LIMIT

  return {
    events: events.slice(0, limit),
    stats: timelineStats(events, source),
  }
}
