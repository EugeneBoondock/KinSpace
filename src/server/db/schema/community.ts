import { sqliteTable, text, integer, real, index, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { pk, createdAt, updatedAt, timestamp, bool, json } from '../columns'
import { users } from './identity'

type MediaItem = { url: string; type: 'image' | 'video' | 'audio' }

// ── Posts, comments, reactions ──────────────────────────────────────────────

export const communityPosts = sqliteTable(
  'community_posts',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull().default(''),
    type: text('type').notNull().default('post'),
    // Null = public post (shown in the main timeline). Set = scoped to a group;
    // visible only inside that group + in members' timelines.
    groupId: text('group_id'),
    tags: json<string[]>('tags').default([]),
    media: json<MediaItem[]>('media').default([]),
    likesCount: integer('likes_count').notNull().default(0),
    reactionCounts: json<Record<string, number>>('reaction_counts').default({}),
    commentsCount: integer('comments_count').notNull().default(0),
    rekindleCount: integer('rekindle_count').notNull().default(0),
    isAnonymous: bool('is_anonymous').notNull().default(false),
    edited: bool('edited').notNull().default(false),
    rekindleOf: text('rekindle_of'),
    rekindleOriginal: json<Record<string, unknown>>('rekindle_original'),
    /** Soft-delete for moderation; hidden from feeds but retained for audit. */
    isDeleted: bool('is_deleted').notNull().default(false),
    /** Set by a group admin/owner to pin this post to the top of the group feed
     * (only meaningful when groupId is set). Null = not pinned. */
    pinnedInGroupAt: timestamp('pinned_in_group_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('posts_user_idx').on(t.userId),
    index('posts_created_idx').on(t.createdAt),
    index('posts_group_idx').on(t.groupId),
  ],
)

// ── Polls (attached to a community post of type='poll') ─────────────────────

export const polls = sqliteTable(
  'polls',
  {
    id: pk(),
    postId: text('post_id')
      .notNull()
      .references(() => communityPosts.id, { onDelete: 'cascade' }),
    question: text('question').notNull().default(''),
    /** When true, voters can pick more than one option. */
    allowMultiple: bool('allow_multiple').notNull().default(false),
    expiresAt: timestamp('expires_at'),
    createdAt: createdAt(),
  },
  (t) => [index('polls_post_idx').on(t.postId)],
)

export const pollOptions = sqliteTable(
  'poll_options',
  {
    id: pk(),
    pollId: text('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    position: integer('position').notNull().default(0),
    /** Denormalised tally, kept correct via atomic deltas on vote/unvote. */
    votesCount: integer('votes_count').notNull().default(0),
  },
  (t) => [index('poll_options_poll_idx').on(t.pollId)],
)

export const pollVotes = sqliteTable(
  'poll_votes',
  {
    id: pk(),
    pollId: text('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    optionId: text('option_id')
      .notNull()
      .references(() => pollOptions.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    // One row per (poll, user, option). Single-choice is enforced in the data
    // layer by clearing prior votes before inserting.
    uniqueIndex('poll_votes_unique').on(t.pollId, t.userId, t.optionId),
    index('poll_votes_poll_idx').on(t.pollId),
  ],
)

export const postLikes = sqliteTable(
  'post_likes',
  {
    id: pk(),
    postId: text('post_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('post_likes_uniq').on(t.postId, t.userId)],
)

export const postReactions = sqliteTable(
  'post_reactions',
  {
    id: pk(),
    postId: text('post_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reaction: text('reaction').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('post_reactions_uniq').on(t.postId, t.userId, t.reaction)],
)

export const postComments = sqliteTable(
  'post_comments',
  {
    id: pk(),
    postId: text('post_id').notNull(),
    parentId: text('parent_id')
      .references((): AnySQLiteColumn => postComments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    isAnonymous: bool('is_anonymous').notNull().default(false),
    isDeleted: bool('is_deleted').notNull().default(false),
    /** Set by the post author to pin this comment to the top of the post's
     * comment thread. At most one comment per post is pinned. Null = not pinned. */
    pinnedAt: timestamp('pinned_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('comments_post_idx').on(t.postId),
    index('comments_parent_idx').on(t.parentId),
  ],
)

export const commentReactions = sqliteTable(
  'comment_reactions',
  {
    id: pk(),
    commentId: text('comment_id')
      .notNull()
      .references(() => postComments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reaction: text('reaction').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('comment_reactions_uniq').on(t.commentId, t.userId, t.reaction)],
)

export const chatMessages = sqliteTable(
  'chat_messages',
  {
    id: pk(),
    senderId: text('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    receiverId: text('receiver_id'),
    roomId: text('room_id'),
    /** For therapy-room messages, links the message to a therapy_sessions row so
     * past sessions can be replayed as read-only transcripts. Null for DMs. */
    sessionId: text('session_id'),
    message: text('message').notNull(),
    messageType: text('message_type').notNull().default('text'),
    isAi: bool('is_ai').notNull().default(false),
    readAt: timestamp('read_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('chat_room_idx').on(t.roomId),
    index('chat_sender_idx').on(t.senderId),
    index('chat_session_idx').on(t.sessionId),
  ],
)

// ── Bookmarks (private saves) ───────────────────────────────────────────────

export const bookmarks = sqliteTable(
  'bookmarks',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: text('post_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('bookmarks_uniq').on(t.userId, t.postId),
    index('bookmarks_user_created_idx').on(t.userId, t.createdAt),
  ],
)

// ── Personal pins (per-user "pin to top of my feed") ─────────────────────────
// A purely private, per-user view preference: a pinned post floats to the top of
// THAT user's community feed only — never visible to or affecting anyone else.

export const userPinnedPosts = sqliteTable(
  'user_pinned_posts',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: text('post_id')
      .notNull()
      .references(() => communityPosts.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('user_pinned_posts_uniq').on(t.userId, t.postId),
    index('user_pinned_posts_user_idx').on(t.userId),
  ],
)

// ── One-way follow ("keep an eye on") — asymmetric, count-free ───────────────

export const follows = sqliteTable(
  'follows',
  {
    id: pk(),
    followerId: text('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followedId: text('followed_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('follows_uniq').on(t.followerId, t.followedId), index('follows_followed_idx').on(t.followedId)],
)

// ── Groups & activities ─────────────────────────────────────────────────────

export const groups = sqliteTable(
  'groups',
  {
    id: pk(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    category: text('category').notNull(),
    type: text('type').notNull().default('virtual'),
    location: text('location'),
    latitude: real('latitude'),
    longitude: real('longitude'),
    tags: json<string[]>('tags').default([]),
    isPrivate: bool('is_private').notNull().default(false),
    coverUrl: text('cover_url'),
    iconUrl: text('icon_url'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    membersCount: integer('members_count').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('groups_category_idx').on(t.category)],
)

export const groupMembers = sqliteTable(
  'group_members',
  {
    id: pk(),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    // 'active' | 'muted' (can read, can't post) | 'banned' (removed/blocked).
    status: text('status').notNull().default('active'),
    joinedAt: createdAt(),
  },
  (t) => [uniqueIndex('group_members_uniq').on(t.groupId, t.userId)],
)

export const communityActivities = sqliteTable('community_activities', {
  id: pk(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  activityType: text('activity_type'),
  location: text('location'),
  isVirtual: bool('is_virtual').notNull().default(false),
  maxParticipants: integer('max_participants'),
  participantsCount: integer('participants_count').notNull().default(0),
  organizerId: text('organizer_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  scheduledAt: timestamp('scheduled_at'),
  durationMinutes: integer('duration_minutes'),
  status: text('status').notNull().default('upcoming'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const activityMembers = sqliteTable(
  'activity_members',
  {
    id: pk(),
    activityId: text('activity_id')
      .notNull()
      .references(() => communityActivities.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('activity_members_uniq').on(t.activityId, t.userId)],
)

// ── Peer connections (Strands), Angels, Mentors ─────────────────────────────

export const connectionRequests = sqliteTable(
  'connection_requests',
  {
    id: pk(),
    requesterId: text('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetUserId: text('target_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('conn_requester_idx').on(t.requesterId),
    index('conn_target_idx').on(t.targetUserId),
  ],
)

export const angels = sqliteTable('angels', {
  id: pk(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  specialty: text('specialty'),
  experienceYears: integer('experience_years').default(0),
  maxSouls: integer('max_souls').notNull().default(3),
  currentSouls: integer('current_souls').notNull().default(0),
  responseTime: text('response_time'),
  rating: real('rating').notNull().default(0),
  totalReviews: integer('total_reviews').notNull().default(0),
  isAvailable: bool('is_available').notNull().default(true),
  supportStyle: text('support_style'),
  bio: text('bio'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const angelSoulRelationships = sqliteTable(
  'angel_soul_relationships',
  {
    id: pk(),
    angelId: text('angel_id')
      .notNull()
      .references(() => angels.id, { onDelete: 'cascade' }),
    soulId: text('soul_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    relationshipStatus: text('relationship_status').notNull().default('active'),
    lastCheckin: timestamp('last_checkin'),
    nextCheckin: timestamp('next_checkin'),
    startedAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('angel_soul_uniq').on(t.angelId, t.soulId)],
)

export const mentors = sqliteTable('mentors', {
  id: pk(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expertise: json<string[]>('expertise').default([]),
  experienceYears: integer('experience_years').default(0),
  sessionsCompleted: integer('sessions_completed').notNull().default(0),
  rating: real('rating').notNull().default(0),
  totalReviews: integer('total_reviews').notNull().default(0),
  isAvailable: bool('is_available').notNull().default(true),
  sessionPrice: real('session_price').default(0),
  bio: text('bio'),
  credentials: json<string[]>('credentials').default([]),
  isVerified: bool('is_verified').notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

// ── On-demand peer support ("Lanterns") ─────────────────────────────────────
// A member signals they need someone now (a "lantern"); available members can
// answer. NOT a crisis line — the UI deflects emergencies to /crisis. Peers,
// not professionals. The conversation reuses the normal DM room once matched.

/** Who is available to answer a lantern right now (expires; opt-in per member). */
export const supportPresence = sqliteTable(
  'support_presence',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Conditions/topics this member feels able to support (slugs or free labels). */
    topics: json<string[]>('topics').default([]),
    note: text('note'),
    /** Available until this instant; past = not available. */
    availableUntil: timestamp('available_until').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('support_presence_user_uniq').on(t.userId)],
)

/** A request for a person, right now. */
export const supportRequests = sqliteTable(
  'support_requests',
  {
    id: pk(),
    seekerId: text('seeker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Short "what's going on" context — encrypted at rest. */
    note: text('note'),
    conditionSlug: text('condition_slug'),
    isAnonymous: bool('is_anonymous').notNull().default(false),
    /** 'open' | 'matched' | 'closed' | 'expired' */
    status: text('status').notNull().default('open'),
    matchedUserId: text('matched_user_id'),
    /** The DM room once matched (dm:<a>:<b>). */
    roomId: text('room_id'),
    matchedAt: timestamp('matched_at'),
    closedAt: timestamp('closed_at'),
    closedBy: text('closed_by'),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('support_requests_status_idx').on(t.status),
    index('support_requests_seeker_idx').on(t.seekerId),
  ],
)

// ── Support circles (Care Partner / Pro tier) ───────────────────────────────

export const supportCircles = sqliteTable('support_circles', {
  id: pk(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  isPrivate: bool('is_private').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const circleMembers = sqliteTable(
  'circle_members',
  {
    id: pk(),
    circleId: text('circle_id')
      .notNull()
      .references(() => supportCircles.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    joinedAt: createdAt(),
  },
  (t) => [uniqueIndex('circle_members_uniq').on(t.circleId, t.userId)],
)
