import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { pk, createdAt, updatedAt, timestamp, bool, json } from '../columns'

/**
 * Identity & auth. `users` holds credentials/identity; `profiles` holds the
 * public + health profile (1:1 with users). Sessions are the source of truth
 * for server-verified auth (also cached in KV for fast middleware lookups).
 */

export const users = sqliteTable(
  'users',
  {
    id: pk(),
    email: text('email').notNull().unique(),
    emailVerified: bool('email_verified').notNull().default(false),
    /** Null for OAuth-only accounts. PBKDF2/scrypt hash via Web Crypto. */
    passwordHash: text('password_hash'),
    googleId: text('google_id').unique(),
    /** 'user' | 'moderator' | 'admin' */
    role: text('role').notNull().default('user'),
    /** 'active' | 'suspended' | 'deleted' */
    status: text('status').notNull().default('active'),
    suspendedReason: text('suspended_reason'),
    lastLoginAt: timestamp('last_login_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('users_google_idx').on(t.googleId)],
)

export const profiles = sqliteTable(
  'profiles',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    username: text('username').notNull().unique(),
    fullName: text('full_name'),
    pseudonym: text('pseudonym'),
    isAnonymous: bool('is_anonymous').notNull().default(false),
    avatarUrl: text('avatar_url'),
    coverImageUrl: text('cover_image_url'),
    bio: text('bio'),
    pronouns: text('pronouns'),
    age: integer('age'),
    location: text('location'),
    timezone: text('timezone'),
    conditions: json<string[]>('conditions').default([]),
    comorbidities: json<string[]>('comorbidities').default([]),
    medications: json<string[]>('medications').default([]),
    /** Free-text health status line. */
    status: text('status'),
    accessNeeds: json<string[]>('access_needs').default([]),
    interests: json<string[]>('interests').default([]),
    mentalHealthGoals: json<string[]>('mental_health_goals').default([]),
    preferredCommunication: text('preferred_communication').default('chat'),
    emergencyContact: text('emergency_contact'),
    emergencyPhone: text('emergency_phone'),
    followers: integer('followers').notNull().default(0),
    following: integer('following').notNull().default(0),
    postsCount: integer('posts_count').notNull().default(0),
    dailyMood: text('daily_mood'),
    moodUpdatedAt: timestamp('mood_updated_at'),
    therapistPersona: text('therapist_persona'),
    onboardingComplete: bool('onboarding_complete').notNull().default(false),
    /** 'newly_diagnosed' | 'in_treatment' | 'caregiver' | 'grieving' | 'exploring' | ... */
    onboardingStatus: text('onboarding_status'),
    /** Privacy-first default: profile visible to the community, not the public web. */
    visibility: text('visibility').notNull().default('community'),
    notifyMatches: bool('notify_matches').notNull().default(true),
    notifyMessages: bool('notify_messages').notNull().default(true),
    notifyGroups: bool('notify_groups').notNull().default(true),
    notifyResearch: bool('notify_research').notNull().default(true),
    /** When true (default), the Guide (therapy AI) receives the user's health
     * profile — conditions, medications, comorbidities, and community insights.
     * Users can opt out to keep those details out of every Guide conversation. */
    shareHealthWithGuide: bool('share_health_with_guide').notNull().default(true),
    /** Who may view this profile while anonymous mode is on. 'connections' =
     * accepted strands only; 'private' = nobody but the owner. Ignored when the
     * profile is not anonymous (then it is viewable across the community). Posts
     * and comments stay visible regardless of this setting. */
    anonymousProfileVisibility: text('anonymous_profile_visibility').notNull().default('connections'),
    /** Discreet mode for the user's own home page: when true, their conditions
     * and condition-derived surfacing are hidden on the dashboard so they can
     * show the app to others without disclosing health details before they're
     * ready. Does not change what anyone else sees — purely a local home view. */
    hideConditionsOnHome: bool('hide_conditions_on_home').notNull().default(false),
    /** When true, the user's conditions are hidden on their profile page (the
     * "What you're living with" card). Other people already never receive a
     * non-owner's conditions, so this controls the owner's own profile view. */
    hideConditionsOnProfile: bool('hide_conditions_on_profile').notNull().default(false),
    spaceTheme: text('space_theme').notNull().default('forest'),
    spaceAccent: text('space_accent').notNull().default('sage'),
    spaceFont: text('space_font').notNull().default('clean'),
    spaceMotto: text('space_motto'),
    spaceVibe: text('space_vibe'),
    spacePinnedNote: text('space_pinned_note'),
    spaceBackgroundImageUrl: text('space_background_image_url'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('profiles_username_idx').on(t.username)],
)

export const sessions = sqliteTable(
  'sessions',
  {
    /** Opaque session id (also the cookie value, hashed at rest). */
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert
export type Session = typeof sessions.$inferSelect
