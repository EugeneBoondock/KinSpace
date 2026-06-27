import { eq, and, desc, inArray, isNull, or, sql } from 'drizzle-orm'
import OpenAI from 'openai'
import type { Ctx } from './_shared'
import {
  requireActor,
  getProfileSummary,
  getProfileSummaries,
  sortByNewest,
  toDate,
  formatRelativeTime,
} from './_shared'
import { createNotification } from '@/server/notify'
import { notifyMatchingExperts } from '@/server/expertise'
import { consumeFeatureQuota } from '@/server/billing/access'
import { blockedRelatedIds, isBlockBetween } from '@/server/social/blocks'
import { filterReadablePosts, requireReadablePost } from './post-access'
import {
  buildPublicGuideCommentRequest,
  hasPublicGuideAlreadyCommented,
  sanitizePublicGuideComment,
} from '@/lib/ai/public-guide'
import { ensureGuidePersonaUser, guidePersonaUserId } from '@/server/therapy/guide-persona-user'
import {
  communityPosts,
  communityActivities,
  activityMembers,
  postLikes,
  postReactions,
  postComments,
  commentReactions,
  chatMessages,
  groupMembers,
  groups,
  profiles,
  conditionReports,
} from '@/server/db/schema'

type MediaItem = { url: string; type: 'image' | 'video' | 'audio' }
let publicGuideClient: OpenAI | null = null

function getPublicGuideClient(): OpenAI {
  if (publicGuideClient) return publicGuideClient
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('AI is not configured')
  publicGuideClient = new OpenAI({ apiKey })
  return publicGuideClient
}
type ReplySignalInput = {
  conditions?: unknown
  interests?: unknown
  symptoms?: unknown
  treatments?: unknown
}
type ReplyQueuePostInput = Record<string, unknown> & {
  id?: string
  userId?: string
  user_id?: string
  content?: unknown
  type?: unknown
  tags?: unknown
  groupId?: string | null
  group_id?: string | null
  group?: unknown
  commentsCount?: number | null
  comments_count?: number | null
  isDeleted?: boolean | null
  is_deleted?: boolean | null
  isAnonymous?: boolean | null
  is_anonymous?: boolean | null
  createdAt?: unknown
  created_at?: unknown
  profile?: unknown
}
type ReplyQueueAuthor = {
  id: string
  userId: string
  username: string | null
  fullName: string | null
  pseudonym: string | null
  isAnonymous: boolean
  avatarUrl: string | null
}
export type CommunityReplyQueueItem = {
  id: string
  content: string
  type: string
  createdAt: Date
  commentsCount: number
  urgency: 'new' | 'low-reply' | 'fresh' | 'open'
  reasons: string[]
  author: ReplyQueueAuthor | null
  group: { id: string; name: string } | null
}

// ── Activities ──────────────────────────────────────────────────────────────

export async function getCommunityActivities(ctx: Ctx, limitCount = 12) {
  const rows = await ctx.db.query.communityActivities.findMany()

  const organizerIds = rows.map((row) => row.organizerId)
  const profileMap = await getProfileSummaries(ctx.db, organizerIds)

  const activities = rows.map((row) => ({
    ...row,
    organizer: profileMap.get(row.organizerId) ?? null,
    formatted_date: formatRelativeTime(row.scheduledAt as Date | null),
  }))

  return activities
    .filter((activity) => activity.status !== 'cancelled')
    .sort(
      (first, second) =>
        (toDate(first.scheduledAt as never) ?? new Date(8640000000000000)).getTime() -
        (toDate(second.scheduledAt as never) ?? new Date(8640000000000000)).getTime(),
    )
    .slice(0, limitCount)
}

export async function joinActivity(ctx: Ctx, activityId: string, _userId?: string) {
  const userId = requireActor(ctx)

  const existing = await ctx.db.query.activityMembers.findFirst({
    where: and(eq(activityMembers.activityId, activityId), eq(activityMembers.userId, userId)),
  })
  if (existing) return existing.id

  const id = crypto.randomUUID()
  await ctx.db.insert(activityMembers).values({ id, activityId, userId })

  await ctx.db
    .update(communityActivities)
    .set({
      participantsCount: sql`${communityActivities.participantsCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(communityActivities.id, activityId))

  return id
}

/**
 * Schedule a community activity / meetup. The authenticated user is the organizer
 * (and is auto-joined as the first participant). Actor comes from the session.
 */
export async function createActivity(
  ctx: Ctx,
  _userId: string,
  data: {
    title: string
    description?: string
    activityType?: string
    location?: string
    isVirtual?: boolean
    maxParticipants?: number | null
    scheduledAt?: string | number | null
    durationMinutes?: number | null
  },
) {
  const organizerId = requireActor(ctx)
  const title = String(data.title || '').trim()
  if (!title) throw new Error('An activity needs a title')

  const id = crypto.randomUUID()
  const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null
  await ctx.db.insert(communityActivities).values({
    id,
    title,
    description: String(data.description ?? '').trim(),
    activityType: data.activityType?.trim() || null,
    location: data.location?.trim() || null,
    isVirtual: Boolean(data.isVirtual),
    maxParticipants: typeof data.maxParticipants === 'number' ? data.maxParticipants : null,
    participantsCount: 1,
    organizerId,
    scheduledAt,
    durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : null,
    status: 'upcoming',
  })
  await ctx.db
    .insert(activityMembers)
    .values({ id: crypto.randomUUID(), activityId: id, userId: organizerId })

  return { id }
}

// ── Posts ───────────────────────────────────────────────────────────────────

/** Attach author profiles + a light { id, name } group ref to a batch of posts. */
async function hydratePosts(ctx: Ctx, rows: Array<typeof communityPosts.$inferSelect>) {
  // Drop posts by anyone in a block relationship with the viewer (both directions).
  const blocked = await blockedRelatedIds(ctx.db, ctx.userId)
  const visibleRows = blocked.size ? rows.filter((row) => !blocked.has(row.userId)) : rows
  const profileMap = await getProfileSummaries(ctx.db, visibleRows.map((row) => row.userId))
  const groupIds = Array.from(new Set(visibleRows.map((row) => row.groupId).filter((id): id is string => Boolean(id))))
  const groupMap = new Map<string, { id: string; name: string }>()
  if (groupIds.length > 0) {
    const groupRows = await ctx.db.query.groups.findMany({ where: inArray(groups.id, groupIds) })
    for (const group of groupRows) groupMap.set(group.id, { id: group.id, name: group.name })
  }

  const postIds = visibleRows.map((row) => row.id)
  const reactionRows = postIds.length
    ? await ctx.db.query.postReactions.findMany({
        where: inArray(postReactions.postId, postIds),
      })
    : []

  const reactorUserIds = reactionRows.map((r) => r.userId)
  const reactorProfileMap = await getProfileSummaries(ctx.db, reactorUserIds)

  const reactorsByPostReaction = new Map<string, string[]>() // keyed by `${postId}:${emoji}`
  for (const reaction of reactionRows) {
    const profile = reactorProfileMap.get(reaction.userId)
    const name = profile ? (profile.fullName || profile.username) : 'Anonymous'
    const key = `${reaction.postId}:${reaction.reaction}`
    const list = reactorsByPostReaction.get(key) ?? []
    if (!list.includes(name)) {
      list.push(name)
    }
    reactorsByPostReaction.set(key, list)
  }

  return visibleRows.map((row) => {
    const reactors: Record<string, string[]> = {}
    const reactionCounts = row.reactionCounts ?? {}
    for (const emoji of Object.keys(reactionCounts)) {
      reactors[emoji] = reactorsByPostReaction.get(`${row.id}:${emoji}`) ?? []
    }
    return {
      ...row,
      profile: profileMap.get(row.userId) ?? null,
      group: row.groupId ? groupMap.get(row.groupId) ?? null : null,
      reactors,
    }
  })
}

function normalizeReplyToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function signalList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const list: string[] = []
  for (const item of value) {
    const token = normalizeReplyToken(item)
    if (!token || seen.has(token)) continue
    seen.add(token)
    list.push(token)
  }
  return list
}

function treatmentSignalList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const list: string[] = []
  for (const item of value) {
    const token = normalizeReplyToken(
      item && typeof item === 'object'
        ? ((item as { name?: unknown; slug?: unknown }).name ?? (item as { slug?: unknown }).slug)
        : item,
    )
    if (!token || seen.has(token)) continue
    seen.add(token)
    list.push(token)
  }
  return list
}

function replySignalTokens(signals: ReplySignalInput) {
  return {
    conditions: signalList(signals.conditions),
    symptoms: signalList(signals.symptoms),
    treatments: treatmentSignalList(signals.treatments),
    interests: signalList(signals.interests),
  }
}

function containsSignal(text: string, token: string): boolean {
  return Boolean(token) && text.includes(token)
}

function commentsForPost(post: ReplyQueuePostInput, counts?: Map<string, number>): number {
  const fromMap = post.id ? counts?.get(post.id) : undefined
  const value = fromMap ?? post.commentsCount ?? post.comments_count ?? 0
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
}

function postGroupId(post: ReplyQueuePostInput): string | null {
  return post.groupId ?? post.group_id ?? null
}

function postUserId(post: ReplyQueuePostInput): string {
  return String(post.userId ?? post.user_id ?? '')
}

function safeText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function postCreatedAt(post: ReplyQueuePostInput): Date {
  return toDate((post.createdAt ?? post.created_at) as never) ?? new Date(0)
}

function safeReplyAuthor(profile: unknown): ReplyQueueAuthor | null {
  if (!profile || typeof profile !== 'object') return null
  const row = profile as Record<string, unknown>
  const userId = String(row.userId ?? row.user_id ?? row.id ?? '').trim()
  if (!userId) return null
  return {
    id: String(row.id ?? userId),
    userId,
    username: row.username ? String(row.username) : null,
    fullName: row.fullName || row.full_name ? String(row.fullName ?? row.full_name) : null,
    pseudonym: row.pseudonym ? String(row.pseudonym) : null,
    isAnonymous: Boolean(row.isAnonymous ?? row.is_anonymous),
    avatarUrl: row.avatarUrl || row.avatar_url ? String(row.avatarUrl ?? row.avatar_url) : null,
  }
}

function safeReplyGroup(group: unknown): { id: string; name: string } | null {
  if (!group || typeof group !== 'object') return null
  const row = group as Record<string, unknown>
  const id = String(row.id ?? '').trim()
  const name = String(row.name ?? '').trim()
  if (!id || !name) return null
  return { id, name }
}

function scoreSignalGroup(source: string, tokens: string[], weight: number, cap: number): number {
  let hits = 0
  for (const token of tokens) {
    if (containsSignal(source, token)) hits += 1
  }
  return Math.min(cap, hits * weight)
}

function storedTruth(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

function viewerReplySignalsFromRows(profile: typeof profiles.$inferSelect | null | undefined, reports: Array<typeof conditionReports.$inferSelect>): ReplySignalInput {
  const finishedReports = reports.filter((report) => report.completionState !== 'draft')
  return {
    conditions: [
      ...((profile?.conditions as string[] | undefined) ?? []),
      ...finishedReports.map((report) => report.conditionSlug),
    ],
    interests: (profile?.interests as string[] | undefined) ?? [],
    symptoms: finishedReports.flatMap((report) => (report.symptoms as string[] | undefined) ?? []),
    treatments: finishedReports.flatMap((report) => (report.treatments as Array<{ name?: string; slug?: string }> | undefined) ?? []),
  }
}

export function buildCommunityReplyQueue({
  actorId,
  viewerSignals,
  posts,
  actorGroupIds = [],
  commentCounts,
  now = new Date(),
  limit = 5,
}: {
  actorId: string
  viewerSignals: ReplySignalInput
  posts: ReplyQueuePostInput[]
  actorGroupIds?: string[]
  commentCounts?: Map<string, number>
  now?: Date
  limit?: number
}): CommunityReplyQueueItem[] {
  if (!actorId || !Array.isArray(posts)) return []
  const groups = new Set(actorGroupIds)
  const signals = replySignalTokens(viewerSignals ?? {})
  const nowMs = now.getTime()

  return posts
    .map((post) => {
      const id = String(post.id ?? '').trim()
      const userId = postUserId(post)
      const groupId = postGroupId(post)
      if (!id || !userId || userId === actorId) return null
      if (post.isDeleted || post.is_deleted) return null
      if (groupId && !groups.has(groupId)) return null

      const content = safeText(post.content).slice(0, 220)
      const tagText = Array.isArray(post.tags) ? post.tags.map(normalizeReplyToken).join(' ') : ''
      const group = safeReplyGroup(post.group)
      const source = normalizeReplyToken(`${content} ${tagText} ${group?.name ?? ''}`)
      const commentsCount = commentsForPost(post, commentCounts)
      const createdAt = postCreatedAt(post)
      const ageHours = Math.max(0, (nowMs - createdAt.getTime()) / 3_600_000)
      const healthScore =
        scoreSignalGroup(source, signals.conditions, 18, 36) +
        scoreSignalGroup(source, signals.symptoms, 16, 32) +
        scoreSignalGroup(source, signals.treatments, 16, 32) +
        scoreSignalGroup(source, signals.interests, 10, 20)
      const replyScore = commentsCount === 0 ? 100 : commentsCount === 1 ? 45 : commentsCount <= 3 ? 15 : 0
      const freshScore = ageHours <= 48 ? 16 : ageHours <= 168 ? 8 : 0
      const groupScore = groupId ? 5 : 0
      const score = replyScore + healthScore + freshScore + groupScore
      const reasons = [
        commentsCount === 0 ? 'No replies yet' : commentsCount <= 1 ? 'Low reply count' : null,
        healthScore > 0 ? 'Matches your health notes' : null,
        ageHours <= 48 ? 'Fresh post' : null,
        groupId ? 'Group you joined' : null,
      ].filter((reason): reason is string => Boolean(reason))

      return {
        item: {
          id,
          content,
          type: safeText(post.type) || 'discussion',
          createdAt,
          commentsCount,
          urgency: commentsCount === 0 && ageHours <= 48 ? 'new' : commentsCount <= 1 ? 'low-reply' : ageHours <= 48 ? 'fresh' : 'open',
          reasons: reasons.length > 0 ? reasons : ['Could use a kind reply'],
          author: storedTruth(post.isAnonymous ?? post.is_anonymous) ? null : safeReplyAuthor(post.profile),
          group,
        } satisfies CommunityReplyQueueItem,
        score,
      }
    })
    .filter((entry): entry is { item: CommunityReplyQueueItem; score: number } => Boolean(entry))
    .filter((entry) => entry.score > 0)
    .sort((first, second) => {
      if (second.score !== first.score) return second.score - first.score
      if (first.item.commentsCount !== second.item.commentsCount) return first.item.commentsCount - second.item.commentsCount
      return second.item.createdAt.getTime() - first.item.createdAt.getTime()
    })
    .slice(0, Math.max(1, Math.min(12, limit)))
    .map((entry) => entry.item)
}

/**
 * The home timeline. With options.userId, returns that user’s own posts (profile
 * feed). Otherwise returns PUBLIC posts plus posts from groups the actor belongs
 * to, so a member sees their groups woven into one stream, while group-only
 * posts stay hidden from everyone else.
 */
export async function getCommunityPosts(
  ctx: Ctx,
  limitCount = 20,
  options?: { userId?: string },
) {
  if (options?.userId) {
    const rows = await ctx.db.query.communityPosts.findMany({
      where: eq(communityPosts.userId, options.userId),
      orderBy: desc(communityPosts.createdAt),
      limit: limitCount,
    })
    return sortByNewest(await hydratePosts(ctx, await filterReadablePosts(ctx, rows))).slice(0, limitCount)
  }

  const actorId = ctx.userId
  let myGroupIds: string[] = []
  if (actorId) {
    const memberships = await ctx.db.query.groupMembers.findMany({ where: eq(groupMembers.userId, actorId) })
    myGroupIds = memberships.filter((m) => m.status !== 'banned').map((m) => m.groupId)
  }
  const where = myGroupIds.length
    ? or(isNull(communityPosts.groupId), inArray(communityPosts.groupId, myGroupIds))
    : isNull(communityPosts.groupId)

  const rows = await ctx.db.query.communityPosts.findMany({
    where,
    orderBy: desc(communityPosts.createdAt),
    limit: limitCount,
  })
  return sortByNewest(await hydratePosts(ctx, rows)).slice(0, limitCount)
}

export async function getCommunityReplyQueue(
  ctx: Ctx,
  _userId?: string,
  options?: { limit?: number },
) {
  const actorId = requireActor(ctx)
  const limit = Math.max(1, Math.min(8, Number(options?.limit ?? 4) || 4))
  const [posts, memberships, profile, reports] = await Promise.all([
    getCommunityPosts(ctx, Math.max(48, limit * 12)),
    ctx.db.query.groupMembers.findMany({ where: eq(groupMembers.userId, actorId) }),
    ctx.db.query.profiles.findFirst({ where: eq(profiles.userId, actorId) }),
    ctx.db.query.conditionReports.findMany({ where: eq(conditionReports.userId, actorId) }),
  ])
  const actorGroupIds = memberships.filter((member) => member.status !== 'banned').map((member) => member.groupId)

  return buildCommunityReplyQueue({
    actorId,
    viewerSignals: viewerReplySignalsFromRows(profile, reports),
    posts: posts as ReplyQueuePostInput[],
    actorGroupIds,
    limit,
  })
}

/**
 * Posts inside a single group, newest first. The group page uses this so its
 * feed shows only that group’s posts. Caller (UI) gates by membership/visibility.
 */
export async function getGroupFeed(ctx: Ctx, groupId: string, limitCount = 30) {
  if (!groupId) return []

  // PRIVATE groups are not readable by outsiders. The UI hides the feed, but this
  // is the real boundary: a non-member hitting the RPC directly gets nothing.
  // Active members (and the creator) can read; pending/banned/non-members cannot.
  const group = await ctx.db.query.groups.findFirst({ where: eq(groups.id, groupId) })
  if (!group) return []
  if (group.isPrivate) {
    const actor = ctx.userId
    if (!actor) return []
    if (group.createdBy !== actor) {
      const membership = await ctx.db.query.groupMembers.findFirst({
        where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, actor)),
      })
      const isActive = Boolean(membership && membership.status !== 'banned' && membership.status !== 'pending')
      if (!isActive) return []
    }
  }

  const rows = await ctx.db.query.communityPosts.findMany({
    where: eq(communityPosts.groupId, groupId),
    orderBy: desc(communityPosts.createdAt),
    limit: limitCount,
  })
  return sortByNewest(await hydratePosts(ctx, rows)).slice(0, limitCount)
}

/**
 * Parse @handles from `content`, resolve them to members, and notify each that
 * they were mentioned. Best-effort: never blocks the post/comment on failure.
 * Skips the author, anyone blocked either way, and de-dupes. Bounded to 10.
 */
async function notifyMentions(
  ctx: Ctx,
  content: string,
  authorId: string,
  context: { postId: string; inComment?: boolean },
): Promise<void> {
  try {
    const handles = new Set<string>()
    const re = /(?:^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{2,30})/g
    let match: RegExpExecArray | null
    while ((match = re.exec(content)) !== null) {
      handles.add(match[1].toLowerCase())
      if (handles.size >= 10) break
    }
    if (handles.size === 0) return

    const rows = await ctx.db.query.profiles.findMany({
      where: or(...Array.from(handles).map((handle) => sql`lower(${profiles.username}) = ${handle}`)),
    })
    const notified = new Set<string>([authorId])
    for (const row of rows) {
      if (notified.has(row.userId)) continue
      notified.add(row.userId)
      if (await isBlockBetween(ctx.db, authorId, row.userId)) continue
      await createNotification(ctx.db, row.userId, {
        type: 'mention',
        title: context.inComment ? 'You were mentioned in a comment' : 'You were mentioned in a post',
        body: 'Someone tagged you. Tap to take a look.',
        data: { post_id: context.postId },
      })
    }
  } catch (error) {
    console.warn('mention notify failed (non-fatal):', error)
  }
}

export async function createPost(
  ctx: Ctx,
  _userId: string,
  content: string,
  type: string,
  tags?: string[],
  isAnonymous = false,
  media?: Array<MediaItem>,
  groupId?: string | null,
) {
  const userId = requireActor(ctx)

  // Posting into a group requires active membership. Muted/banned members and
  // non-members are rejected so a group feed stays scoped to its people.
  if (groupId) {
    const membership = await ctx.db.query.groupMembers.findFirst({
      where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
    })
    if (!membership || membership.status === 'banned') throw new Error('You are not a member of this group')
    if (membership.status === 'muted') throw new Error('You are muted in this group')
  }

  const id = crypto.randomUUID()
  await ctx.db.insert(communityPosts).values({
    id,
    userId,
    content,
    type,
    groupId: groupId ?? null,
    tags: tags || [],
    media: media || [],
    likesCount: 0,
    reactionCounts: {},
    commentsCount: 0,
    rekindleCount: 0,
    isAnonymous,
  })

  await ctx.db
    .update(profiles)
    .set({ postsCount: sql`${profiles.postsCount} + 1`, updatedAt: new Date() })
    .where(eq(profiles.userId, userId))

  // Ping people whose lived experience matches this post (best-effort, bounded).
  await notifyMatchingExperts(ctx.db, {
    authorId: userId,
    postId: id,
    groupId: groupId ?? null,
    content,
    tags: tags || [],
  })

  // Notify anyone @mentioned in the post.
  await notifyMentions(ctx, content, userId, { postId: id })

  return { id }
}

export async function updatePost(
  ctx: Ctx,
  postId: string,
  _userId: string,
  updates: { content?: string },
) {
  const userId = requireActor(ctx)

  const post = await ctx.db.query.communityPosts.findFirst({
    where: eq(communityPosts.id, postId),
  })
  if (!post) throw new Error('Post not found')
  if (post.userId !== userId) throw new Error('Not authorized')

  await ctx.db
    .update(communityPosts)
    .set({ ...updates, edited: true, updatedAt: new Date() })
    .where(eq(communityPosts.id, postId))
}

export async function rekindlePost(
  ctx: Ctx,
  postId: string,
  _userId: string,
  comment?: string,
) {
  const { userId, post: original } = await requireReadablePost(ctx, postId)

  const originalProfile = await getProfileSummary(ctx.db, original.userId)

  const id = crypto.randomUUID()
  await ctx.db.insert(communityPosts).values({
    id,
    userId,
    content: comment || '',
    type: 'rekindle',
    tags: [],
    media: [],
    groupId: original.groupId ?? null,
    likesCount: 0,
    reactionCounts: {},
    commentsCount: 0,
    rekindleCount: 0,
    isAnonymous: false,
    rekindleOf: postId,
    rekindleOriginal: {
      id: postId,
      content: original.content,
      user_id: original.userId,
      media: original.media || [],
      is_anonymous: original.isAnonymous,
      author_name: original.isAnonymous
        ? 'Anonymous'
        : (originalProfile?.fullName as string | undefined) ||
          (originalProfile?.username as string | undefined) ||
          'Community member',
      created_at: original.createdAt instanceof Date ? original.createdAt.toISOString() : original.createdAt,
    },
  })

  await ctx.db
    .update(communityPosts)
    .set({ rekindleCount: sql`${communityPosts.rekindleCount} + 1`, updatedAt: new Date() })
    .where(eq(communityPosts.id, postId))

  await ctx.db
    .update(profiles)
    .set({ postsCount: sql`${profiles.postsCount} + 1`, updatedAt: new Date() })
    .where(eq(profiles.userId, userId))

  return { id }
}

// ── Likes & reactions ───────────────────────────────────────────────────────

export async function getUserLikedPostIds(ctx: Ctx, _userId?: string) {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.postLikes.findMany({ where: eq(postLikes.userId, userId) })
  // Return an array (a Set serializes to {} over JSON-RPC); the client wraps it in a Set.
  return rows.map((row) => row.postId)
}

export async function getUserPostReactions(ctx: Ctx, _userId?: string) {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.postReactions.findMany({
    where: eq(postReactions.userId, userId),
  })
  // Return an array (a Set serializes to {} over JSON-RPC); the client wraps it in a Set.
  return rows.map((row) => `${row.postId}:${row.reaction}`)
}

export async function togglePostLike(ctx: Ctx, postId: string, _userId?: string) {
  const { userId } = await requireReadablePost(ctx, postId)

  const existing = await ctx.db.query.postLikes.findFirst({
    where: and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)),
  })

  if (existing) {
    await ctx.db.delete(postLikes).where(eq(postLikes.id, existing.id))
    await ctx.db
      .update(communityPosts)
      .set({ likesCount: sql`${communityPosts.likesCount} - 1`, updatedAt: new Date() })
      .where(eq(communityPosts.id, postId))
    return false
  }

  await ctx.db.insert(postLikes).values({ id: crypto.randomUUID(), postId, userId })
  await ctx.db
    .update(communityPosts)
    .set({ likesCount: sql`${communityPosts.likesCount} + 1`, updatedAt: new Date() })
    .where(eq(communityPosts.id, postId))
  return true
}

export async function togglePostReaction(
  ctx: Ctx,
  postId: string,
  _userId: string,
  reaction: string,
) {
  const { userId } = await requireReadablePost(ctx, postId)

  const existing = await ctx.db.query.postReactions.findFirst({
    where: and(
      eq(postReactions.postId, postId),
      eq(postReactions.userId, userId),
      eq(postReactions.reaction, reaction),
    ),
  })

  if (existing) {
    await ctx.db.delete(postReactions).where(eq(postReactions.id, existing.id))
    await adjustReactionCount(ctx, postId, reaction, -1)
    return false
  }

  await ctx.db
    .insert(postReactions)
    .values({ id: crypto.randomUUID(), postId, userId, reaction })
  await adjustReactionCount(ctx, postId, reaction, 1)
  return true
}

/**
 * reaction_counts is a JSON map keyed by reaction name; Firestore used dotted
 * field increments. D1/Drizzle has no per-key atomic op, so read-modify-write
 * the JSON column.
 */
async function adjustReactionCount(ctx: Ctx, postId: string, reaction: string, delta: number) {
  const post = await ctx.db.query.communityPosts.findFirst({
    where: eq(communityPosts.id, postId),
  })
  if (!post) return
  const counts: Record<string, number> = { ...(post.reactionCounts ?? {}) }
  counts[reaction] = (counts[reaction] ?? 0) + delta
  await ctx.db
    .update(communityPosts)
    .set({ reactionCounts: counts, updatedAt: new Date() })
    .where(eq(communityPosts.id, postId))
}

// ── Comments ────────────────────────────────────────────────────────────────

/**
 * Toggle a single emoji reaction on a comment for the current user. Counts are
 * computed on read (getCommentsForPosts), not denormalized. Returns true if the
 * reaction is now on, false if it was removed.
 */
export async function toggleCommentReaction(
  ctx: Ctx,
  commentId: string,
  reaction: string,
) {
  const userId = requireActor(ctx)
  const value = String(reaction ?? '').trim().slice(0, 16)
  if (!commentId || !value) throw new Error('Missing comment or reaction')
  const comment = await ctx.db.query.postComments.findFirst({ where: eq(postComments.id, commentId) })
  if (!comment || comment.isDeleted) throw new Error('Comment not found')
  await requireReadablePost(ctx, comment.postId)

  const existing = await ctx.db.query.commentReactions.findFirst({
    where: and(
      eq(commentReactions.commentId, commentId),
      eq(commentReactions.userId, userId),
      eq(commentReactions.reaction, value),
    ),
  })
  if (existing) {
    await ctx.db.delete(commentReactions).where(eq(commentReactions.id, existing.id))
    return false
  }
  await ctx.db
    .insert(commentReactions)
    .values({ id: crypto.randomUUID(), commentId, userId, reaction: value })
  return true
}

export async function addPostComment(
  ctx: Ctx,
  postId: string,
  _userId: string,
  content: string,
  isAnonymous = false,
  parentId: string | null = null,
) {
  const { userId } = await requireReadablePost(ctx, postId)

  const trimmed = (content ?? '').trim()
  if (!trimmed) throw new Error('Comment cannot be empty')
  if (!postId || !userId) throw new Error('Missing post or user id')

  let parentComment: typeof postComments.$inferSelect | null = null
  if (parentId) {
    parentComment = (await ctx.db.query.postComments.findFirst({
      where: eq(postComments.id, parentId),
    })) ?? null
    if (!parentComment || parentComment.postId !== postId) throw new Error('Parent comment not found')
  }

  const id = crypto.randomUUID()
  await ctx.db
    .insert(postComments)
    .values({ id, postId, parentId, userId, content: trimmed, isAnonymous })

  // Count-bump is a nice-to-have. Do not fail the comment if this update errors.
  try {
    await ctx.db
      .update(communityPosts)
      .set({ commentsCount: sql`${communityPosts.commentsCount} + 1`, updatedAt: new Date() })
      .where(eq(communityPosts.id, postId))
  } catch (error) {
    console.warn('comments_count increment failed (non-fatal):', error)
  }

  // Notify anyone @mentioned in the comment.
  await notifyMentions(ctx, trimmed, userId, { postId, inComment: true })

  if (parentComment && parentComment.userId !== userId && !(await isBlockBetween(ctx.db, userId, parentComment.userId))) {
    await createNotification(ctx.db, parentComment.userId, {
      type: 'comment_reply',
      title: 'Someone replied to your comment',
      body: trimmed.slice(0, 140),
      data: { post_id: postId, comment_id: parentComment.id, reply_id: id },
    })
  }

  return { id }
}

export async function requestGuidePostComment(ctx: Ctx, postId: string, personaId: string | null = 'mira') {
  const { post } = await requireReadablePost(ctx, postId)

  const commentRows = await ctx.db.query.postComments.findMany({
    where: eq(postComments.postId, postId),
  })
  const guideUserId = guidePersonaUserId(personaId)
  if (hasPublicGuideAlreadyCommented(commentRows, guideUserId)) {
    throw new Error('This Guide has already replied to this post.')
  }

  await consumeFeatureQuota(ctx, 'ai_therapy')

  if (!process.env.OPENAI_API_KEY) throw new Error('AI is not configured')

  const group = post.groupId
    ? await ctx.db.query.groups.findFirst({ where: eq(groups.id, post.groupId) })
    : null

  const completion = await getPublicGuideClient().chat.completions.create(
    buildPublicGuideCommentRequest({
      personaId,
      post: {
        id: post.id,
        content: post.content,
        tags: post.tags,
        media: post.media,
        groupName: group?.name ?? null,
      },
      comments: commentRows
        .filter((comment) => !comment.isDeleted)
        .sort(
          (first, second) =>
            (toDate(first.createdAt as never) ?? new Date(0)).getTime() -
            (toDate(second.createdAt as never) ?? new Date(0)).getTime(),
        )
        .slice(-8)
        .map((comment) => ({ content: comment.content })),
    }),
  )
  const content = sanitizePublicGuideComment(completion.choices[0]?.message?.content ?? '')
  if (!content) throw new Error('Guide did not write a comment')

  const guide = await ensureGuidePersonaUser(ctx.db, personaId)
  const id = crypto.randomUUID()
  await ctx.db.insert(postComments).values({
    id,
    postId,
    parentId: null,
    userId: guide.userId,
    content,
    isAnonymous: false,
  })

  await ctx.db
    .update(communityPosts)
    .set({ commentsCount: sql`${communityPosts.commentsCount} + 1`, updatedAt: new Date() })
    .where(eq(communityPosts.id, postId))
    .catch(() => undefined)

  if (post.userId !== guide.userId) {
    await createNotification(ctx.db, post.userId, {
      type: 'guide_comment',
      title: `${guide.persona.name} replied to your post`,
      body: content.slice(0, 140),
      data: { post_id: postId, comment_id: id },
    })
  }

  return { id, content, persona: guide.persona.id }
}

export async function deletePost(ctx: Ctx, postId: string, _userId?: string) {
  const userId = requireActor(ctx)

  const post = await ctx.db.query.communityPosts.findFirst({
    where: eq(communityPosts.id, postId),
  })
  if (!post) return { deleted: false, reason: 'not-found' as const }
  if (post.userId !== userId) throw new Error('Only the post owner can delete it')

  await ctx.db.delete(communityPosts).where(eq(communityPosts.id, postId))

  // Decrement the user’s own post count
  try {
    await ctx.db
      .update(profiles)
      .set({ postsCount: sql`${profiles.postsCount} - 1`, updatedAt: new Date() })
      .where(eq(profiles.userId, userId))
  } catch {
    // non-fatal
  }

  // Best-effort cleanup of per-post relations
  await Promise.all([
    ctx.db.delete(postLikes).where(eq(postLikes.postId, postId)).catch(() => undefined),
    ctx.db
      .delete(postReactions)
      .where(eq(postReactions.postId, postId))
      .catch(() => undefined),
    ctx.db
      .delete(postComments)
      .where(eq(postComments.postId, postId))
      .catch(() => undefined),
  ])

  return { deleted: true }
}

export async function getCommentsForPosts(ctx: Ctx, postIds: string[], limitCount = 3) {
  const uniquePostIds = Array.from(new Set(postIds.filter(Boolean)))
  if (uniquePostIds.length === 0) {
    return new Map<string, Array<Record<string, unknown> & { id: string; profile: unknown }>>()
  }

  const inputIds = new Set(uniquePostIds)
  const postRows = await ctx.db.query.communityPosts.findMany({
    where: inArray(communityPosts.id, uniquePostIds),
  })
  const readablePostIds = new Set((await filterReadablePosts(ctx, postRows)).filter((row) => inputIds.has(row.id)).map((row) => row.id))
  if (readablePostIds.size === 0) {
    return new Map<string, Array<Record<string, unknown> & { id: string; profile: unknown }>>()
  }

  const rows = await ctx.db.query.postComments.findMany({
    where: inArray(postComments.postId, Array.from(readablePostIds)),
  })

  const userIds = rows.map((row) => row.userId)
  const commentIds = rows.map((row) => row.id)
  const profileMap = await getProfileSummaries(ctx.db, userIds)
  const reactionRows = commentIds.length
    ? await ctx.db.query.commentReactions.findMany({
        where: inArray(commentReactions.commentId, commentIds),
      })
    : []

  const countsByComment = new Map<string, Record<string, number>>()
  const mineByComment = new Map<string, string[]>()
  for (const reaction of reactionRows) {
    const counts = countsByComment.get(reaction.commentId) ?? {}
    counts[reaction.reaction] = (counts[reaction.reaction] ?? 0) + 1
    countsByComment.set(reaction.commentId, counts)
    if (ctx.userId && reaction.userId === ctx.userId) {
      const mine = mineByComment.get(reaction.commentId) ?? []
      mine.push(reaction.reaction)
      mineByComment.set(reaction.commentId, mine)
    }
  }

  const reactorUserIds = reactionRows.map((r) => r.userId)
  const reactorProfileMap = await getProfileSummaries(ctx.db, reactorUserIds)

  const reactorsByCommentReaction = new Map<string, string[]>() // keyed by `${commentId}:${emoji}`
  for (const reaction of reactionRows) {
    const profile = reactorProfileMap.get(reaction.userId)
    const name = profile ? (profile.fullName || profile.username) : 'Anonymous'
    const key = `${reaction.commentId}:${reaction.reaction}`
    const list = reactorsByCommentReaction.get(key) ?? []
    if (!list.includes(name)) {
      list.push(name)
    }
    reactorsByCommentReaction.set(key, list)
  }

  const comments = rows.map((row) => {
    const commentId = row.id
    const reactionCounts = countsByComment.get(commentId) ?? {}
    const reactors: Record<string, string[]> = {}
    for (const emoji of Object.keys(reactionCounts)) {
      reactors[emoji] = reactorsByCommentReaction.get(`${commentId}:${emoji}`) ?? []
    }
    return {
      ...row,
      profile: profileMap.get(row.userId) ?? null,
      reaction_counts: reactionCounts,
      my_reactions: mineByComment.get(commentId) ?? [],
      reactors,
    }
  })

  const grouped = new Map<
    string,
    Array<Record<string, unknown> & { id: string; profile: unknown }>
  >()

  comments
    .sort(
      (first, second) =>
        (toDate(first.createdAt as never) ?? new Date(8640000000000000)).getTime() -
        (toDate(second.createdAt as never) ?? new Date(8640000000000000)).getTime(),
    )
    .forEach((comment) => {
      const postId = comment.postId
      if (!postId) return
      const existing = grouped.get(postId) ?? []
      existing.push(comment)
      grouped.set(postId, existing.slice(-limitCount))
    })

  return grouped
}

// ── Direct / room messages ──────────────────────────────────────────────────

export async function sendMessage(
  ctx: Ctx,
  _senderId: string,
  receiverId: string | null,
  roomId: string | null,
  message: string,
  isAI = false,
  sessionId: string | null = null,
) {
  const senderId = requireActor(ctx)

  const id = crypto.randomUUID()
  await ctx.db.insert(chatMessages).values({
    id,
    senderId,
    receiverId,
    roomId,
    sessionId,
    message,
    messageType: 'text',
    isAi: isAI,
    readAt: null,
  })

  return { id }
}

export async function getMessages(ctx: Ctx, roomId: string, limitCount = 50) {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.chatMessages.findMany({
    where: eq(chatMessages.roomId, roomId),
  })

  // Only a participant (sender or receiver of a message in this room) may read it.
  const isParticipant = rows.some((row) => row.senderId === userId || row.receiverId === userId)
  if (!isParticipant) return []

  return rows
    .map((row) => ({ ...row }))
    .sort(
      (first, second) =>
        (toDate(first.createdAt as never) ?? new Date(0)).getTime() -
        (toDate(second.createdAt as never) ?? new Date(0)).getTime(),
    )
    .slice(-limitCount)
}

// ── Direct messages (1:1 DMs) ────────────────────────────────────────────────

/** Deterministic room id for a DM pair, stable regardless of who sends first. */
function dmRoomId(a: string, b: string): string {
  return `dm:${[a, b].sort().join(':')}`
}

/** Send a direct message to another user. Notifies the recipient. */
export async function sendDirectMessage(ctx: Ctx, toUserId: string, message: string) {
  const senderId = requireActor(ctx)
  const body = String(message ?? '').trim().slice(0, 4000)
  if (!toUserId || toUserId === senderId) throw new Error('Invalid recipient')
  if (!body) throw new Error('Message is empty')
  if (await isBlockBetween(ctx.db, senderId, toUserId)) throw new Error("You can't message this person.")

  const roomId = dmRoomId(senderId, toUserId)
  const id = crypto.randomUUID()
  await ctx.db.insert(chatMessages).values({
    id,
    senderId,
    receiverId: toUserId,
    roomId,
    message: body,
    messageType: 'text',
    isAi: false,
    readAt: null,
  })

  const me = await getProfileSummary(ctx.db, senderId)
  await createNotification(ctx.db, toUserId, {
    type: 'dm',
    title: `${me?.isAnonymous ? me?.pseudonym || 'Someone' : me?.fullName || me?.username || 'Someone'} messaged you`,
    body: body.slice(0, 120),
    data: { fromUserId: senderId, roomId },
  })

  return { id, roomId }
}

/** All of the actor’s DM threads: partner profile, last message, unread count. */
export async function getConversations(ctx: Ctx, _userId?: string) {
  const userId = requireActor(ctx)
  const [rows, blocked] = await Promise.all([
    ctx.db.query.chatMessages.findMany({
      where: or(eq(chatMessages.senderId, userId), eq(chatMessages.receiverId, userId)),
    }),
    blockedRelatedIds(ctx.db, userId),
  ])
  const dmRows = rows.filter((row) => (row.roomId ?? '').startsWith('dm:'))

  type Thread = {
    partner_id: string
    last_message: string
    last_at: Date | null
    last_from_me: boolean
    unread: number
  }
  const threads = new Map<string, Thread>()
  for (const row of dmRows) {
    const partnerId = row.senderId === userId ? row.receiverId : row.senderId
    if (!partnerId) continue
    if (blocked.has(partnerId)) continue
    const when = toDate(row.createdAt as never)
    const existing = threads.get(partnerId)
    const isUnread = row.receiverId === userId && !row.readAt
    if (!existing) {
      threads.set(partnerId, {
        partner_id: partnerId,
        last_message: row.message,
        last_at: when,
        last_from_me: row.senderId === userId,
        unread: isUnread ? 1 : 0,
      })
      continue
    }
    if (isUnread) existing.unread += 1
    if (when && (!existing.last_at || when.getTime() > existing.last_at.getTime())) {
      existing.last_at = when
      existing.last_message = row.message
      existing.last_from_me = row.senderId === userId
    }
  }

  const partners = await getProfileSummaries(ctx.db, Array.from(threads.keys()))
  return Array.from(threads.values())
    .map((thread) => ({ ...thread, partner: partners.get(thread.partner_id) ?? null }))
    .sort((a, b) => (b.last_at?.getTime() ?? 0) - (a.last_at?.getTime() ?? 0))
}

/** A DM thread with one user. Marks the actor’s received messages read on open. */
export async function getDirectMessages(ctx: Ctx, otherUserId: string, limitCount = 100) {
  const userId = requireActor(ctx)
  if (!otherUserId) return { partner: null, messages: [] }
  if (await isBlockBetween(ctx.db, userId, otherUserId)) return { partner: null, messages: [], blocked: true }
  const roomId = dmRoomId(userId, otherUserId)

  const rows = await ctx.db.query.chatMessages.findMany({ where: eq(chatMessages.roomId, roomId) })

  // Mark unread messages addressed to the actor as read.
  const unreadIds = rows.filter((row) => row.receiverId === userId && !row.readAt).map((row) => row.id)
  if (unreadIds.length > 0) {
    await ctx.db
      .update(chatMessages)
      .set({ readAt: new Date() })
      .where(inArray(chatMessages.id, unreadIds))
  }

  const partner = await getProfileSummary(ctx.db, otherUserId)
  const messages = rows
    .sort(
      (a, b) =>
        (toDate(a.createdAt as never) ?? new Date(0)).getTime() -
        (toDate(b.createdAt as never) ?? new Date(0)).getTime(),
    )
    .slice(-limitCount)
    .map((row) => ({
      id: row.id,
      message: row.message,
      sender_id: row.senderId,
      from_me: row.senderId === userId,
      created_at: row.createdAt,
    }))

  return { partner, messages }
}

/** Count of unread DMs across all threads for the nav badge. */
export async function getUnreadMessageCount(ctx: Ctx, _userId?: string): Promise<number> {
  const userId = requireActor(ctx)
  const [rows, blocked] = await Promise.all([
    ctx.db.query.chatMessages.findMany({ where: eq(chatMessages.receiverId, userId) }),
    blockedRelatedIds(ctx.db, userId),
  ])
  return rows.filter((row) => (row.roomId ?? '').startsWith('dm:') && !row.readAt && !blocked.has(row.senderId)).length
}

// ── Aggregate community signals ─────────────────────────────────────────────

type Phrase = { label: string; count: number }

function tallyPhrases(
  values: Array<string | Array<string | null | undefined> | null | undefined>,
  limitCount = 6,
): Phrase[] {
  const counts = new Map<string, Phrase>()

  values.forEach((value) => {
    const items = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : typeof value === 'string'
        ? value.split(',').map((item) => item.trim())
        : []

    items
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        const key = item.toLowerCase()
        const current = counts.get(key)
        counts.set(key, {
          label: current?.label || item,
          count: (current?.count || 0) + 1,
        })
      })
  })

  return Array.from(counts.values())
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label))
    .slice(0, limitCount)
}

export async function getCommunitySignals(ctx: Ctx, limitCount = 6) {
  const [profileRows, groupRows, resourceRows] = await Promise.all([
    ctx.db.query.profiles.findMany({ limit: 1000 }),
    ctx.db.query.groups.findMany({ limit: 500 }),
    ctx.db.query.resources.findMany({ limit: 500 }),
  ])

  return {
    topConditions: tallyPhrases(
      profileRows.map((profile) => profile.conditions as string[] | undefined),
      limitCount,
    ),
    // Medications are clinical PHI. Never aggregate or expose them across users.
    topMedications: [] as Phrase[],
    topTopics: tallyPhrases(
      [
        ...groupRows.map((group) => [
          group.category as string | undefined,
          ...((group.tags as string[] | undefined) || []),
        ]),
        ...resourceRows.map((resource) => [
          resource.category as string | undefined,
          ...((resource.tags as string[] | undefined) || []),
        ]),
        ...profileRows.map((profile) => profile.interests as string[] | undefined),
      ],
      limitCount,
    ),
  }
}
