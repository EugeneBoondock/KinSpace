import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor, sortByNewest } from './_shared'
import { notifications } from '@/server/db/schema'

/** The authenticated user's notifications, newest first. */
export async function getNotifications(ctx: Ctx, _userId?: string, limitCount = 40) {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.notifications.findMany({ where: eq(notifications.userId, userId) })
  return sortByNewest([...rows]).slice(0, limitCount)
}

/** Count of the actor's unread notifications, for the nav badge. */
export async function getUnreadNotificationCount(ctx: Ctx, _userId?: string): Promise<number> {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.notifications.findMany({
    where: and(eq(notifications.userId, userId), isNull(notifications.readAt)),
  })
  return rows.length
}

/**
 * Mark notifications read for the actor. With no ids, marks all of theirs read.
 * Always scoped to the actor so one user can never touch another's notifications.
 */
export async function markNotificationsRead(ctx: Ctx, ids?: string[]) {
  const userId = requireActor(ctx)
  const now = new Date()
  if (ids && ids.length > 0) {
    await ctx.db
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.userId, userId), inArray(notifications.id, ids)))
  } else {
    await ctx.db
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
  }
  return { ok: true }
}
