import { and, eq, sql } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor, getProfileSummaries, sortByNewest } from './_shared'
import { featureRequests, featureRequestVotes } from '@/server/db/schema'

const STATUS_ORDER: Record<string, number> = { open: 0, planned: 1, in_progress: 2, shipped: 3, declined: 4 }

/** Submit a feature idea. The author is auto-counted as the first vote. */
export async function createFeatureRequest(
  ctx: Ctx,
  data: { title: string; description?: string; category?: string; isAnonymous?: boolean }) {
  const userId = requireActor(ctx)
  const title = String(data.title || '').trim()
  if (!title) throw new Error('Give your idea a title')

  const id = crypto.randomUUID()
  await ctx.db.insert(featureRequests).values({
    id,
    userId,
    title: title.slice(0, 140),
    description: String(data.description ?? '').trim().slice(0, 2000),
    category: (data.category || 'feature').trim().toLowerCase(),
    status: 'open',
    votesCount: 1,
    isAnonymous: Boolean(data.isAnonymous),
  })
  // The author's own vote, so they can't double-vote later.
  await ctx.db.insert(featureRequestVotes).values({ id: crypto.randomUUID(), requestId: id, userId })
  return { id }
}

/** All feature requests, hydrated with author + sorted: status, then most-wanted. */
export async function getFeatureRequests(ctx: Ctx, limitCount = 100) {
  const rows = await ctx.db.query.featureRequests.findMany({ limit: limitCount })
  const authorIds = rows.filter((row) => !row.isAnonymous).map((row) => row.userId)
  const authors = await getProfileSummaries(ctx.db, authorIds)

  const ordered = sortByNewest([...rows]).sort((a, b) => {
    const statusDelta = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
    if (statusDelta !== 0) return statusDelta
    return (b.votesCount ?? 0) - (a.votesCount ?? 0)
  })

  return ordered.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    votes_count: row.votesCount,
    is_anonymous: row.isAnonymous,
    created_at: row.createdAt,
    author: row.isAnonymous ? null : authors.get(row.userId) ?? null,
  }))
}

/** Request ids the actor has upvoted, to render their vote state. */
export async function getMyFeatureVotes(ctx: Ctx): Promise<string[]> {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.featureRequestVotes.findMany({ where: eq(featureRequestVotes.userId, userId) })
  return rows.map((row) => row.requestId)
}

/** Toggle an upvote on a request (idempotent unique index), adjusting the tally. */
export async function toggleFeatureVote(ctx: Ctx, requestId: string): Promise<{ voted: boolean }> {
  const userId = requireActor(ctx)
  if (!requestId) throw new Error('requestId required')

  const existing = await ctx.db.query.featureRequestVotes.findFirst({
    where: and(eq(featureRequestVotes.requestId, requestId), eq(featureRequestVotes.userId, userId)),
  })
  if (existing) {
    await ctx.db.delete(featureRequestVotes).where(eq(featureRequestVotes.id, existing.id))
    await ctx.db
      .update(featureRequests)
      .set({ votesCount: sql`max(0, ${featureRequests.votesCount} - 1)` })
      .where(eq(featureRequests.id, requestId))
    return { voted: false }
  }

  await ctx.db.insert(featureRequestVotes).values({ id: crypto.randomUUID(), requestId, userId })
  await ctx.db
    .update(featureRequests)
    .set({ votesCount: sql`${featureRequests.votesCount} + 1` })
    .where(eq(featureRequests.id, requestId))
  return { voted: true }
}
