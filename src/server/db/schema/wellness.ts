import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { pk, createdAt, updatedAt, timestamp, bool, json } from '../columns'
import { users } from './identity'

// ── Mood check-ins (daily, keyed by user+day) ───────────────────────────────

export const moodCheckins = sqliteTable(
  'mood_checkins',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mood: text('mood').notNull(),
    note: text('note').notNull().default(''),
    /** YYYY-MM-DD in the user's local day. */
    day: text('day').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('mood_user_day_uniq').on(t.userId, t.day)],
)

// ── Therapy sessions (cross-room memory) ────────────────────────────────────

export const therapySessions = sqliteTable(
  'therapy_sessions',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    persona: text('persona'),
    theme: text('theme'),
    moodAtStart: text('mood_at_start'),
    moodAtEnd: text('mood_at_end'),
    messageCount: integer('message_count').notNull().default(0),
    summary: text('summary'),
    keyThemes: json<string[]>('key_themes').default([]),
    startedAt: createdAt(),
    endedAt: timestamp('ended_at'),
    updatedAt: updatedAt(),
  },
  (t) => [index('therapy_user_idx').on(t.userId)],
)

// ── Personal healing journal (Plus tier) ────────────────────────────────────

export const journalEntries = sqliteTable(
  'journal_entries',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default(''),
    body: text('body').notNull().default(''),
    mood: text('mood'),
    tags: json<string[]>('tags').default([]),
    eventKind: text('event_kind').notNull().default('journal'),
    conditionSlug: text('condition_slug'),
    symptom: text('symptom'),
    treatment: text('treatment'),
    medication: text('medication'),
    intensity: integer('intensity'),
    isPrivate: bool('is_private').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('journal_user_idx').on(t.userId)],
)

// ── Symptom tracker ─────────────────────────────────────────────────────────

export const symptomLogs = sqliteTable(
  'symptom_logs',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    symptom: text('symptom').notNull(),
    severity: integer('severity'),
    conditionSlug: text('condition_slug'),
    note: text('note'),
    loggedAt: timestamp('logged_at'),
    createdAt: createdAt(),
  },
  (t) => [index('symptom_logs_user_idx').on(t.userId)],
)

// ── Treatment tracker ───────────────────────────────────────────────────────

export const treatmentLogs = sqliteTable(
  'treatment_logs',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    treatment: text('treatment').notNull(),
    status: text('status').notNull().default('active'),
    effectiveness: integer('effectiveness'),
    conditionSlug: text('condition_slug'),
    sideEffects: json<string[]>('side_effects').default([]),
    startedAt: timestamp('started_at'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('treatment_logs_user_idx').on(t.userId)],
)

// ── Medication reminders ────────────────────────────────────────────────────

export const medicationReminders = sqliteTable(
  'medication_reminders',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    medication: text('medication').notNull(),
    dose: text('dose'),
    conditionSlug: text('condition_slug'),
    /** Local HH:MM times, e.g. ["08:00","20:00"]. */
    times: json<string[]>('times').default([]),
    active: bool('active').notNull().default(true),
    lastTakenAt: timestamp('last_taken_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('med_reminders_user_idx').on(t.userId)],
)

// ── Web Push subscriptions (background reminders even when the app is closed) ─

export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('push_subs_endpoint_idx').on(t.endpoint),
    index('push_subs_user_idx').on(t.userId),
  ],
)

// ── Achievement unlocks (ledger of first-earned badges/levels) ──────────────

export const achievementUnlocks = sqliteTable(
  'achievement_unlocks',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Badge.id, or "level:N" for level milestones. */
    badgeId: text('badge_id').notNull(),
    tier: text('tier'),
    seenAt: timestamp('seen_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('achievement_unlocks_uniq').on(t.userId, t.badgeId)],
)

// ── Spoons Today (opt-in, expiring capacity signal) + quiet check-ins ────────

export const spoonStatuses = sqliteTable(
  'spoon_statuses',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 1..5 spoons of capacity today. */
    spoons: integer('spoons').notNull(),
    note: text('note'),
    emoji: text('emoji'),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('spoon_statuses_user_idx').on(t.userId)],
)

export const quietCheckins = sqliteTable(
  'quiet_checkins',
  {
    id: pk(),
    fromUser: text('from_user')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    toUser: text('to_user')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [index('quiet_checkins_to_idx').on(t.toUser)],
)

// ── Therapy message feedback (thumbs up/down on Guide replies) ──────────────

export const therapyFeedback = sqliteTable(
  'therapy_feedback',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: text('session_id'),
    /** 'up' | 'down' */
    value: text('value').notNull(),
    /** Optional short reason when a reply gets a thumbs-down. */
    reason: text('reason'),
    /** A snippet of the rated reply, for prompt tuning. */
    snippet: text('snippet'),
    createdAt: createdAt(),
  },
  (t) => [index('therapy_feedback_user_idx').on(t.userId)],
)

// ── Medication taken log (per-dose history for the activity calendar) ────────

export const medicationTakenLog = sqliteTable(
  'medication_taken_log',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reminderId: text('reminder_id'),
    medication: text('medication').notNull().default(''),
    /** YYYY-MM-DD (UTC) of when the dose was marked taken. */
    day: text('day').notNull(),
    takenAt: timestamp('taken_at'),
    createdAt: createdAt(),
  },
  (t) => [index('med_taken_user_idx').on(t.userId), index('med_taken_day_idx').on(t.day)],
)
