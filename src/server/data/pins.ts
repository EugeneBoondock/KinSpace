import { and, eq, ne } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor } from './_shared'
import {
  postComments,
  communityPosts,
  groups,
  groupMembers,
  userPinnedPosts,
} from '@/server/db/schema'

// ── 1) Pin a comment (post author pins one comment to the top) ───────────────

/**
 * Pin a comment to the top of its post's comment thread. Only the AUTHOR OF THE
 * POST the comment belongs to may pin. At most one comment per post stays
 * pinned, so any previously pinned comment on the same post is cleared first.
 */
export async function pinComment(ctx: Ctx, commentId: string): Promise<{ pinned: boolean }> {
  const actor = requireActor(ctx)
  if (!commentId) throw new Error('commentId required')

  const comment = await ctx.db.query.postComments.findFirst({ where: eq(postComments.id, commentId) })
  if (!comment) throw new Error('Comment not found')

  const post = await ctx.db.query.communityPosts.findFirst({ where: eq(communityPosts.id, comment.postId) })
  if (!post) throw new Error('Post not found')
  if (post.userId !== actor) throw new Error('Not authorized')

  // Only one pinned comment per post: clear any others, then pin this one.
  await ctx.db
    .update(postComments)
    .set({ pinnedAt: null })
    .where(and(eq(postComments.postId, comment.postId), ne(postComments.id, commentId)))

  await ctx.db
    .update(postComments)
    .set({ pinnedAt: new Date(), updatedAt: new Date() })
    .where(eq(postComments.id, commentId))

  return { pinned: true }
}

/**
 * Unpin a comment. Only the AUTHOR OF THE POST the comment belongs to may unpin.
 */
export async function unpinComment(ctx: Ctx, commentId: string): Promise<{ pinned: boolean }> {
  const actor = requireActor(ctx)
  if (!commentId) throw new Error('commentId required')

  const comment = await ctx.db.query.postComments.findFirst({ where: eq(postComments.id, commentId) })
  if (!comment) throw new Error('Comment not found')

  const post = await ctx.db.query.communityPosts.findFirst({ where: eq(communityPosts.id, comment.postId) })
  if (!post) throw new Error('Post not found')
  if (post.userId !== actor) throw new Error('Not authorized')

  await ctx.db
    .update(postComments)
    .set({ pinnedAt: null, updatedAt: new Date() })
    .where(eq(postComments.id, commentId))

  return { pinned: false }
}

// ── 2) Pin a post to a group (group admin/owner pins to top of group feed) ────

/** True if the actor may moderate the group: an active admin member, or its creator. */
async function canManageGroup(ctx: Ctx, groupId: string, actor: string): Promise<boolean> {
  const group = await ctx.db.query.groups.findFirst({ where: eq(groups.id, groupId) })
  if (!group) return false
  if (group.createdBy === actor) return true
  const membership = await ctx.db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, actor)),
  })
  return Boolean(membership && membership.role === 'admin' && membership.status !== 'banned')
}

/**
 * Pin a post to the top of its group's feed. Allowed only when the post belongs
 * to a group AND the actor is an admin of that group (active admin membership)
 * OR the group's creator.
 */
export async function pinPostToGroup(ctx: Ctx, postId: string): Promise<{ pinned: boolean }> {
  const actor = requireActor(ctx)
  if (!postId) throw new Error('postId required')

  const post = await ctx.db.query.communityPosts.findFirst({ where: eq(communityPosts.id, postId) })
  if (!post) throw new Error('Post not found')
  if (!post.groupId) throw new Error('Post is not in a group')
  if (!(await canManageGroup(ctx, post.groupId, actor))) throw new Error('Not authorized')

  await ctx.db
    .update(communityPosts)
    .set({ pinnedInGroupAt: new Date(), updatedAt: new Date() })
    .where(eq(communityPosts.id, postId))

  return { pinned: true }
}

/**
 * Unpin a post from its group's feed. Same authorization as pinPostToGroup.
 */
export async function unpinPostToGroup(ctx: Ctx, postId: string): Promise<{ pinned: boolean }> {
  const actor = requireActor(ctx)
  if (!postId) throw new Error('postId required')

  const post = await ctx.db.query.communityPosts.findFirst({ where: eq(communityPosts.id, postId) })
  if (!post) throw new Error('Post not found')
  if (!post.groupId) throw new Error('Post is not in a group')
  if (!(await canManageGroup(ctx, post.groupId, actor))) throw new Error('Not authorized')

  await ctx.db
    .update(communityPosts)
    .set({ pinnedInGroupAt: null, updatedAt: new Date() })
    .where(eq(communityPosts.id, postId))

  return { pinned: false }
}

// ── 3) Personal pin on the community page (per-user, local view only) ─────────

/**
 * Pin a post to the top of the actor's OWN community feed. Idempotent on the
 * unique (user, post) index. This is private — it never affects other viewers.
 */
export async function pinPostForMe(ctx: Ctx, postId: string): Promise<{ pinned: boolean }> {
  const userId = requireActor(ctx)
  if (!postId) throw new Error('postId required')

  const existing = await ctx.db.query.userPinnedPosts.findFirst({
    where: and(eq(userPinnedPosts.userId, userId), eq(userPinnedPosts.postId, postId)),
  })
  if (existing) return { pinned: true }

  await ctx.db.insert(userPinnedPosts).values({ id: crypto.randomUUID(), userId, postId })
  return { pinned: true }
}

/** Remove the actor's personal pin from a post. Idempotent. */
export async function unpinPostForMe(ctx: Ctx, postId: string): Promise<{ pinned: boolean }> {
  const userId = requireActor(ctx)
  if (!postId) throw new Error('postId required')

  await ctx.db
    .delete(userPinnedPosts)
    .where(and(eq(userPinnedPosts.userId, userId), eq(userPinnedPosts.postId, postId)))
  return { pinned: false }
}

/** Post ids the actor has personally pinned, for floating them to the top of their feed. */
export async function getMyPinnedPostIds(ctx: Ctx): Promise<string[]> {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.userPinnedPosts.findMany({ where: eq(userPinnedPosts.userId, userId) })
  return rows.map((row) => row.postId)
}
