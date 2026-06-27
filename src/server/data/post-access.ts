import { and, eq } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor } from './_shared'
import { communityPosts, groupMembers } from '@/server/db/schema'
import { isBlockBetween } from '@/server/social/blocks'

export type CommunityPostRow = typeof communityPosts.$inferSelect

function canUseGroupPost(status: string | null | undefined): boolean {
  return Boolean(status && status !== 'banned' && status !== 'pending')
}

export async function readableGroupIdsForActor(ctx: Ctx): Promise<Set<string>> {
  const actor = ctx.userId
  if (!actor) return new Set()
  const memberships = await ctx.db.query.groupMembers.findMany({ where: eq(groupMembers.userId, actor) })
  return new Set(memberships.filter((row) => canUseGroupPost(row.status)).map((row) => row.groupId))
}

export function canReadPostWithGroups(post: CommunityPostRow, actor: string | null | undefined, groupIds: Set<string>): boolean {
  if (post.isDeleted) return false
  if (!post.groupId) return true
  if (actor && post.userId === actor) return true
  return Boolean(actor && groupIds.has(post.groupId))
}

export async function filterReadablePosts(ctx: Ctx, rows: CommunityPostRow[]): Promise<CommunityPostRow[]> {
  const groupIds = await readableGroupIdsForActor(ctx)
  return rows.filter((row) => canReadPostWithGroups(row, ctx.userId, groupIds))
}

export async function canReadPost(ctx: Ctx, post: CommunityPostRow): Promise<boolean> {
  if (!canReadPostWithGroups(post, ctx.userId, await readableGroupIdsForActor(ctx))) return false
  if (ctx.userId && post.userId !== ctx.userId && (await isBlockBetween(ctx.db, ctx.userId, post.userId))) return false
  return true
}

export async function requireReadablePost(ctx: Ctx, postId: string): Promise<{ userId: string; post: CommunityPostRow }> {
  const userId = requireActor(ctx)
  const post = await ctx.db.query.communityPosts.findFirst({ where: eq(communityPosts.id, postId) })
  if (!post || post.isDeleted) throw new Error('Post not found')
  if (!(await canReadPost(ctx, post))) throw new Error('Not authorized')
  return { userId, post }
}

export async function canCreateGroupContent(ctx: Ctx, groupId: string, userId: string): Promise<boolean> {
  const membership = await ctx.db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
  })
  return canUseGroupPost(membership?.status)
}
