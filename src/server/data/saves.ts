import { and, eq, inArray } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor, getProfileSummaries, sortByNewest } from './_shared'
import { bookmarks, communityPosts } from '@/server/db/schema'
import { filterReadablePosts, requireReadablePost } from './post-access'

/** Idempotent private save/unsave. Toggle on a unique (user, post) index, no
 *  public counters, no fan-out, so it is effectively free on D1 and never KV. */
export async function toggleBookmark(ctx: Ctx, postId: string): Promise<{ saved: boolean }> {
  const userId = requireActor(ctx)
  if (!postId) throw new Error('postId required')
  const existing = await ctx.db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.userId, userId), eq(bookmarks.postId, postId)),
  })
  if (existing) {
    await ctx.db.delete(bookmarks).where(eq(bookmarks.id, existing.id))
    return { saved: false }
  }
  await requireReadablePost(ctx, postId)
  await ctx.db.insert(bookmarks).values({ id: crypto.randomUUID(), userId, postId })
  return { saved: true }
}

/** Post ids the actor has saved, for marking the save button across feeds. */
export async function getBookmarkedPostIds(ctx: Ctx): Promise<string[]> {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.bookmarks.findMany({ where: eq(bookmarks.userId, userId) })
  return rows.map((row) => row.postId)
}

/** The actor's saved posts, newest-saved first, hydrated with public authors. */
export async function getBookmarks(ctx: Ctx, limitCount = 50) {
  const userId = requireActor(ctx)
  const rows = sortByNewest([...(await ctx.db.query.bookmarks.findMany({ where: eq(bookmarks.userId, userId) }))])
  const ids = rows.map((row) => row.postId).slice(0, limitCount)
  if (ids.length === 0) return []

  const posts = await filterReadablePosts(ctx, await ctx.db.query.communityPosts.findMany({ where: inArray(communityPosts.id, ids) }))
  const byId = new Map(posts.map((post) => [post.id, post]))
  const authorIds = posts.filter((post) => !post.isAnonymous).map((post) => post.userId)
  const authors = await getProfileSummaries(ctx.db, authorIds)

  return ids
    .map((id) => byId.get(id))
    .filter((post): post is NonNullable<typeof post> => Boolean(post) && !post!.isDeleted)
    .map((post) => ({
      id: post.id,
      content: post.content,
      type: post.type,
      media: post.media ?? [],
      tags: post.tags ?? [],
      likes_count: post.likesCount,
      comments_count: post.commentsCount,
      reaction_counts: post.reactionCounts ?? {},
      is_anonymous: post.isAnonymous,
      created_at: post.createdAt,
      author: post.isAnonymous ? null : authors.get(post.userId) ?? null,
    }))
}
