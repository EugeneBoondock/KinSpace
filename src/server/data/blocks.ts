import { and, eq } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor, getProfileSummaries } from './_shared'
import { userBlocks } from '@/server/db/schema'

/**
 * Blocking a user hides their posts/comments from your feeds (both directions)
 * and stops direct messages between you. One-way action; the other person isn't
 * told. Feed filtering lives in community hydratePosts; DM gating in
 * sendDirectMessage; both use src/server/social/blocks.ts helpers.
 */
export async function blockUser(ctx: Ctx, targetId: string) {
  const me = requireActor(ctx)
  const target = String(targetId || '')
  if (!target || target === me) throw new Error('Invalid user to block.')
  const existing = await ctx.db.query.userBlocks.findFirst({
    where: and(eq(userBlocks.blockerId, me), eq(userBlocks.blockedId, target)),
  })
  if (!existing) {
    await ctx.db.insert(userBlocks).values({ id: crypto.randomUUID(), blockerId: me, blockedId: target })
  }
  return { ok: true }
}

export async function unblockUser(ctx: Ctx, targetId: string) {
  const me = requireActor(ctx)
  await ctx.db
    .delete(userBlocks)
    .where(and(eq(userBlocks.blockerId, me), eq(userBlocks.blockedId, String(targetId || ''))))
  return { ok: true }
}

export async function getMyBlockedUserIds(ctx: Ctx): Promise<string[]> {
  if (!ctx.userId) return []
  const rows = await ctx.db.query.userBlocks.findMany({ where: eq(userBlocks.blockerId, ctx.userId) })
  return rows.map((r) => r.blockedId)
}

export async function isUserBlocked(ctx: Ctx, targetId: string): Promise<boolean> {
  if (!ctx.userId || !targetId) return false
  const row = await ctx.db.query.userBlocks.findFirst({
    where: and(eq(userBlocks.blockerId, ctx.userId), eq(userBlocks.blockedId, String(targetId))),
  })
  return Boolean(row)
}

/** The actor's blocked accounts with public profile info — for the settings list. */
export async function getBlockedUsers(ctx: Ctx) {
  const me = requireActor(ctx)
  const rows = await ctx.db.query.userBlocks.findMany({ where: eq(userBlocks.blockerId, me) })
  const profiles = await getProfileSummaries(ctx.db, rows.map((r) => r.blockedId))
  return rows
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .map((r) => ({ user_id: r.blockedId, blocked_at: r.createdAt, profile: profiles.get(r.blockedId) ?? null }))
}
