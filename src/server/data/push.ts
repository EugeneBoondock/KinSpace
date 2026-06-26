import { and, eq } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor } from './_shared'
import { pushSubscriptions, profiles } from '@/server/db/schema'
import { sendWebPushToAll, isPushConfigured } from '@/server/push/send'

type IncomingSubscription = {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
}

/** Save (or refresh) a Web Push subscription for the authenticated user's device. */
export async function savePushSubscription(
  ctx: Ctx,
  subscription: IncomingSubscription,
  userAgent?: string,
) {
  const userId = requireActor(ctx)
  const endpoint = subscription?.endpoint
  const p256dh = subscription?.keys?.p256dh
  const auth = subscription?.keys?.auth
  if (!endpoint || !p256dh || !auth) throw new Error('Invalid push subscription')

  // A device endpoint is globally unique; re-subscribing just refreshes the owner/keys.
  const existing = await ctx.db.query.pushSubscriptions.findFirst({
    where: eq(pushSubscriptions.endpoint, endpoint),
  })
  if (existing) {
    await ctx.db
      .update(pushSubscriptions)
      .set({ userId, p256dh, auth, userAgent: userAgent ?? existing.userAgent ?? null })
      .where(eq(pushSubscriptions.endpoint, endpoint))
    return { ok: true, id: existing.id }
  }
  const id = crypto.randomUUID()
  await ctx.db
    .insert(pushSubscriptions)
    .values({ id, userId, endpoint, p256dh, auth, userAgent: userAgent ?? null })
  return { ok: true, id }
}

/** Record the member's IANA timezone so reminders fire at THEIR local dose time. */
export async function setMyTimezone(ctx: Ctx, timezone: string) {
  const userId = requireActor(ctx)
  const tz = String(timezone || '').trim().slice(0, 64)
  if (!tz) return { ok: false }
  await ctx.db.update(profiles).set({ timezone: tz, updatedAt: new Date() }).where(eq(profiles.userId, userId))
  return { ok: true }
}

/** Remove a subscription (on unsubscribe). Scoped to the actor + endpoint. */
export async function deletePushSubscription(ctx: Ctx, endpoint: string) {
  const userId = requireActor(ctx)
  if (!endpoint) return { ok: true }
  await ctx.db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)))
  return { ok: true }
}

/** The authenticated user's own subscriptions (no other user's data). */
export async function getMyPushSubscriptions(ctx: Ctx) {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.pushSubscriptions.findMany({ where: eq(pushSubscriptions.userId, userId) })
  return rows.map((r) => ({ id: r.id, endpoint: r.endpoint, createdAt: r.createdAt }))
}

/** Send a test push to all of the user's devices, verifying their setup works. */
export async function sendTestPush(ctx: Ctx) {
  const userId = requireActor(ctx)
  if (!isPushConfigured()) return { ok: false, error: 'Background reminders are not configured yet.' }

  const rows = await ctx.db.query.pushSubscriptions.findMany({ where: eq(pushSubscriptions.userId, userId) })
  if (rows.length === 0) {
    return { ok: false, error: 'No devices yet. Turn on background reminders first, then try again.' }
  }

  const results = await sendWebPushToAll(
    rows.map((r) => ({ endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth })),
    {
      title: 'KinSpace reminder',
      body: 'Background reminders are working. This is how a medication reminder will reach you.',
      url: '/dashboard?meds=1',
      tag: 'kinspace-test',
      urgency: 'high',
      ttl: 30 * 60,
      requireInteraction: true,
      renotify: true,
      silent: false,
      vibrate: [700, 250, 700, 250, 700, 500, 900],
      timestamp: Date.now(),
      data: { kind: 'med-reminder', alarmTest: true, url: '/dashboard?meds=1' },
    },
  )

  // Prune subscriptions the push service reports as gone (404/410).
  for (const endpoint of results.filter((r) => r.gone).map((r) => r.endpoint)) {
    await ctx.db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
  }

  const delivered = results.filter((r) => r.ok).length
  return { ok: delivered > 0, delivered, total: results.length }
}
