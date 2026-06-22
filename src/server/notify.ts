import type { Database } from './db/client'
import { notifications } from './db/schema'

/**
 * Create a notification for a user. This is an INTERNAL helper — it is NOT in the
 * `src/server/data/*` RPC registry, so clients cannot call it to spam others. It
 * is invoked from server-side data methods (a new DM, a connection request, etc.)
 * after they have authenticated the actor.
 */
export async function createNotification(
  db: Database,
  userId: string,
  payload: { type: string; title: string; body?: string | null; data?: Record<string, unknown> | null },
): Promise<void> {
  if (!userId) return
  try {
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? null,
      data: payload.data ?? null,
      readAt: null,
    })
  } catch {
    // Notifications are best-effort — never fail the originating action over one.
  }
}
