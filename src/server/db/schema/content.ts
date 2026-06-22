import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { pk, createdAt, updatedAt, timestamp, bool, json } from '../columns'
import { users } from './identity'

type ResourceSource = { title?: string; url: string; domain?: string }

// ── Resources & research library ────────────────────────────────────────────

export const resources = sqliteTable(
  'resources',
  {
    slug: text('slug').primaryKey(),
    title: text('title').notNull(),
    excerpt: text('excerpt').notNull().default(''),
    bodyMarkdown: text('body_markdown'),
    keyFindings: json<string[]>('key_findings').default([]),
    tags: json<string[]>('tags').default([]),
    topic: text('topic'),
    plainLanguageSummary: text('plain_language_summary'),
    caveats: json<string[]>('caveats').default([]),
    sources: json<ResourceSource[]>('sources').default([]),
    url: text('url'),
    source: text('source'),
    category: text('category').notNull().default('resource'),
    type: text('type').notNull().default('article'),
    aiGenerated: bool('ai_generated').notNull().default(false),
    researchMode: text('research_mode'),
    model: text('model'),
    status: text('status').notNull().default('published'),
    featured: bool('featured').notNull().default(false),
    submittedBy: text('submitted_by'),
    requestedBy: text('requested_by'),
    contributionsCount: integer('contributions_count').notNull().default(0),
    pubDate: text('pub_date'),
    createdAt: createdAt(),
    publishedAt: timestamp('published_at'),
    updatedAt: updatedAt(),
  },
  (t) => [index('resources_category_idx').on(t.category), index('resources_status_idx').on(t.status)],
)

// ── Feature requests (user-submitted ideas + upvotes) ───────────────────────

export const featureRequests = sqliteTable(
  'feature_requests',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    category: text('category').notNull().default('feature'),
    /** 'open' | 'planned' | 'in_progress' | 'shipped' | 'declined' */
    status: text('status').notNull().default('open'),
    votesCount: integer('votes_count').notNull().default(1),
    isAnonymous: bool('is_anonymous').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('feature_requests_status_idx').on(t.status)],
)

export const featureRequestVotes = sqliteTable(
  'feature_request_votes',
  {
    id: pk(),
    requestId: text('request_id')
      .notNull()
      .references(() => featureRequests.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('feature_request_votes_uniq').on(t.requestId, t.userId)],
)

export const bugReports = sqliteTable(
  'bug_reports',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    /** Where it happened (a path or short note), optional. */
    pageUrl: text('page_url'),
    /** 'low' | 'normal' | 'high' */
    severity: text('severity').notNull().default('normal'),
    /** 'open' | 'investigating' | 'resolved' | 'closed' */
    status: text('status').notNull().default('open'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('bug_reports_status_idx').on(t.status)],
)

export const researchRequests = sqliteTable(
  'research_requests',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    request: text('request').notNull(),
    status: text('status').notNull().default('pending'),
    articleSlug: text('article_slug'),
    fulfilledAt: timestamp('fulfilled_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('research_req_status_idx').on(t.status)],
)

export const resourceContributions = sqliteTable(
  'resource_contributions',
  {
    id: pk(),
    resourceId: text('resource_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    content: text('content').notNull(),
    url: text('url'),
    upvotes: integer('upvotes').notNull().default(0),
    isAnonymous: bool('is_anonymous').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('resource_contrib_resource_idx').on(t.resourceId)],
)

export const resourceContributionVotes = sqliteTable(
  'resource_contribution_votes',
  {
    id: pk(),
    contributionId: text('contribution_id')
      .notNull()
      .references(() => resourceContributions.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('resource_contrib_votes_uniq').on(t.contributionId, t.userId)],
)

export const savedResources = sqliteTable(
  'saved_resources',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    resourceId: text('resource_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('saved_resources_uniq').on(t.userId, t.resourceId)],
)

// ── Support directory (map) ─────────────────────────────────────────────────

export const supportLocations = sqliteTable('support_locations', {
  id: pk(),
  name: text('name').notNull(),
  type: text('type').notNull().default('group'),
  address: text('address'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  phone: text('phone'),
  website: text('website'),
  rating: real('rating').default(0),
  description: text('description'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

// ── Games ───────────────────────────────────────────────────────────────────

export const games = sqliteTable('games', {
  id: pk(),
  hostId: text('host_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  gameType: text('game_type').notNull(),
  maxPlayers: integer('max_players').notNull().default(2),
  currentPlayers: integer('current_players').notNull().default(1),
  isPrivate: bool('is_private').notNull().default(false),
  roomCode: text('room_code'),
  status: text('status').notNull().default('waiting'),
  gameState: json<unknown>('game_state'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const gamePlayers = sqliteTable(
  'game_players',
  {
    id: pk(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    playerOrder: integer('player_order').notNull().default(1),
    joinedAt: createdAt(),
  },
  (t) => [uniqueIndex('game_players_uniq').on(t.gameId, t.userId)],
)

// ── Single-player game scores (per game key) ────────────────────────────────

export const gameScores = sqliteTable(
  'game_scores',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Slug of the game, e.g. '2048', 'snake', 'wordsearch'. */
    gameKey: text('game_key').notNull(),
    score: integer('score').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('game_scores_user_idx').on(t.userId)],
)
