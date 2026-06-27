import { and, eq, inArray, sql } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor, toDate } from './_shared'
import { polls, pollOptions, pollVotes, communityPosts, profiles, groupMembers } from '@/server/db/schema'
import { filterReadablePosts, requireReadablePost } from './post-access'

const MAX_OPTIONS = 6

type PollOptionDto = { id: string; label: string; votes_count: number }
export type PollDto = {
  id: string
  question: string
  allow_multiple: boolean
  total_votes: number
  closed: boolean
  options: PollOptionDto[]
  my_option_ids: string[]
}

/**
 * Create a community post that carries a poll. The post (type='poll') and its
 * poll + options are written together. Actor comes from the session.
 */
export async function createPollPost(
  ctx: Ctx,
  data: {
    content?: string
    question: string
    options: string[]
    allowMultiple?: boolean
    tags?: string[]
    isAnonymous?: boolean
    groupId?: string | null
  },
) {
  const userId = requireActor(ctx)
  const question = String(data.question || '').trim()
  const options = (data.options || [])
    .map((option) => String(option).trim())
    .filter(Boolean)
    .slice(0, MAX_OPTIONS)

  if (!question) throw new Error('A poll needs a question')
  if (options.length < 2) throw new Error('A poll needs at least two options')

  // A poll posted into a group requires active membership, so it stays scoped to
  // the group feed (mirrors createPost).
  if (data.groupId) {
    const membership = await ctx.db.query.groupMembers.findFirst({
      where: and(eq(groupMembers.groupId, data.groupId), eq(groupMembers.userId, userId)),
    })
    if (!membership || membership.status === 'banned') throw new Error('You are not a member of this group')
    if (membership.status === 'muted') throw new Error('You are muted in this group')
  }

  const postId = crypto.randomUUID()
  await ctx.db.insert(communityPosts).values({
    id: postId,
    userId,
    content: String(data.content ?? '').trim(),
    type: 'poll',
    groupId: data.groupId ?? null,
    tags: data.tags || [],
    media: [],
    likesCount: 0,
    reactionCounts: {},
    commentsCount: 0,
    rekindleCount: 0,
    isAnonymous: Boolean(data.isAnonymous),
  })

  const pollId = crypto.randomUUID()
  await ctx.db.insert(polls).values({
    id: pollId,
    postId,
    question,
    allowMultiple: Boolean(data.allowMultiple),
  })
  await ctx.db.insert(pollOptions).values(
    options.map((label, index) => ({
      id: crypto.randomUUID(),
      pollId,
      label,
      position: index,
      votesCount: 0,
    })),
  )

  await ctx.db
    .update(profiles)
    .set({ postsCount: sql`${profiles.postsCount} + 1`, updatedAt: new Date() })
    .where(eq(profiles.userId, userId))

  return { id: postId, poll_id: pollId }
}

/**
 * Polls for a set of posts, keyed by postId (serialized to an object over RPC).
 * Includes the actor's own selections so the UI can render their vote state.
 */
export async function getPollsForPosts(ctx: Ctx, postIds: string[]): Promise<Record<string, PollDto>> {
  if (!postIds || postIds.length === 0) return {}
  const userId = ctx.userId ?? null
  const uniquePostIds = Array.from(new Set(postIds.filter(Boolean)))
  if (uniquePostIds.length === 0) return {}
  const postRows = await ctx.db.query.communityPosts.findMany({ where: inArray(communityPosts.id, uniquePostIds) })
  const readablePostIds = new Set((await filterReadablePosts(ctx, postRows)).map((post) => post.id))
  if (readablePostIds.size === 0) return {}

  const pollRows = (await ctx.db.query.polls.findMany({ where: inArray(polls.postId, Array.from(readablePostIds)) })).filter((poll) =>
    readablePostIds.has(poll.postId),
  )
  if (pollRows.length === 0) return {}

  const pollIds = pollRows.map((poll) => poll.id)
  const optionRows = await ctx.db.query.pollOptions.findMany({ where: inArray(pollOptions.pollId, pollIds) })
  const myVotes = userId
    ? await ctx.db.query.pollVotes.findMany({
        where: and(inArray(pollVotes.pollId, pollIds), eq(pollVotes.userId, userId)),
      })
    : []

  const myByPoll = new Map<string, string[]>()
  for (const vote of myVotes) {
    const list = myByPoll.get(vote.pollId) ?? []
    list.push(vote.optionId)
    myByPoll.set(vote.pollId, list)
  }
  const optsByPoll = new Map<string, typeof optionRows>()
  for (const option of optionRows) {
    const list = optsByPoll.get(option.pollId) ?? []
    list.push(option)
    optsByPoll.set(option.pollId, list)
  }

  const now = Date.now()
  const result: Record<string, PollDto> = {}
  for (const poll of pollRows) {
    const opts = (optsByPoll.get(poll.id) ?? []).sort((a, b) => a.position - b.position)
    const total = opts.reduce((sum, option) => sum + (option.votesCount ?? 0), 0)
    const closed = Boolean(poll.expiresAt && (toDate(poll.expiresAt as never)?.getTime() ?? 0) < now)
    result[poll.postId] = {
      id: poll.id,
      question: poll.question,
      allow_multiple: poll.allowMultiple,
      total_votes: total,
      closed,
      options: opts.map((option) => ({ id: option.id, label: option.label, votes_count: option.votesCount })),
      my_option_ids: myByPoll.get(poll.id) ?? [],
    }
  }
  return result
}

/**
 * Cast or toggle a vote. Single-choice polls switch to the new option (or clear
 * it if the same one is tapped again); multiple-choice polls toggle that option.
 * Tallies are kept correct with atomic deltas. Returns the fresh poll DTO.
 */
export async function votePoll(ctx: Ctx, pollId: string, optionId: string): Promise<PollDto | null> {
  const userId = requireActor(ctx)

  const poll = await ctx.db.query.polls.findFirst({ where: eq(polls.id, pollId) })
  if (!poll) throw new Error('Poll not found')
  await requireReadablePost(ctx, poll.postId)
  if (poll.expiresAt && (toDate(poll.expiresAt as never)?.getTime() ?? 0) < Date.now()) {
    throw new Error('This poll has closed')
  }
  const option = await ctx.db.query.pollOptions.findFirst({
    where: and(eq(pollOptions.id, optionId), eq(pollOptions.pollId, pollId)),
  })
  if (!option) throw new Error('Invalid option')

  const existing = await ctx.db.query.pollVotes.findMany({
    where: and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId)),
  })
  const alreadyOnThis = existing.find((vote) => vote.optionId === optionId)

  async function removeVote(id: string, optId: string) {
    await ctx.db.delete(pollVotes).where(eq(pollVotes.id, id))
    await ctx.db
      .update(pollOptions)
      .set({ votesCount: sql`max(0, ${pollOptions.votesCount} - 1)` })
      .where(eq(pollOptions.id, optId))
  }
  async function addVote(optId: string) {
    await ctx.db.insert(pollVotes).values({ id: crypto.randomUUID(), pollId, optionId: optId, userId })
    await ctx.db
      .update(pollOptions)
      .set({ votesCount: sql`${pollOptions.votesCount} + 1` })
      .where(eq(pollOptions.id, optId))
  }

  if (poll.allowMultiple) {
    if (alreadyOnThis) await removeVote(alreadyOnThis.id, optionId)
    else await addVote(optionId)
  } else {
    // Clear any prior single-choice vote first.
    for (const vote of existing) await removeVote(vote.id, vote.optionId)
    // Tapping the same option again just clears it (toggle off).
    if (!alreadyOnThis) await addVote(optionId)
  }

  const map = await getPollsForPosts(ctx, [poll.postId])
  return map[poll.postId] ?? null
}
