import { sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { pk, createdAt, updatedAt, timestamp, bool } from '../columns'
import { users } from './identity'
import { groups } from './community'

/**
 * Virtual support group sessions — turn-based ("talking stick") live group
 * meetings that run inside an existing group. A session has a host, a set of
 * participants, an ordered phase, and a chat-style message stream. Realtime is
 * done with client polling (no per-request KV writes).
 */

export const groupSessions = sqliteTable(
  'group_sessions',
  {
    id: pk(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    hostId: text('host_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    /** Template id from the session template registry (e.g. 'open', 'aa'). */
    template: text('template').notNull().default('open'),
    topic: text('topic').notNull().default(''),
    /** 'live' | 'ended' */
    status: text('status').notNull().default('live'),
    /** 'checkin' | 'discussion' | 'closing' | 'ended' */
    phase: text('phase').notNull().default('checkin'),
    /** The participant currently holding the talking stick (null = open floor). */
    floorHolderId: text('floor_holder_id'),
    /** When the current floor hold lapses; the floor is effectively open after. */
    floorExpiresAt: timestamp('floor_expires_at'),
    startedAt: createdAt(),
    endedAt: timestamp('ended_at'),
    updatedAt: updatedAt(),
  },
  (t) => [index('group_sessions_group_idx').on(t.groupId)],
)

export const sessionParticipants = sqliteTable(
  'session_participants',
  {
    id: pk(),
    sessionId: text('session_id')
      .notNull()
      .references(() => groupSessions.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 'host' | 'member' */
    role: text('role').notNull().default('member'),
    handRaised: bool('hand_raised').notNull().default(false),
    /** 'active' | 'left' */
    status: text('status').notNull().default('active'),
    joinedAt: createdAt(),
  },
  (t) => [uniqueIndex('session_participants_uniq').on(t.sessionId, t.userId)],
)

export const sessionMessages = sqliteTable(
  'session_messages',
  {
    id: pk(),
    sessionId: text('session_id')
      .notNull()
      .references(() => groupSessions.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 'message' | 'system' */
    kind: text('kind').notNull().default('message'),
    content: text('content').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('session_messages_session_idx').on(t.sessionId)],
)

export type GroupSession = typeof groupSessions.$inferSelect
export type SessionParticipant = typeof sessionParticipants.$inferSelect
export type SessionMessage = typeof sessionMessages.$inferSelect
