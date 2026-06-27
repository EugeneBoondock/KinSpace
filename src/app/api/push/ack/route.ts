import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getDb } from '@/server/db/client'
import { medicationReminders } from '@/server/db/schema'
import { getSessionUserId } from '@/server/http/auth'
import { markMedicationReminderTaken } from '@/server/data/wellness'
import { acknowledgeReminderSlot } from '@/server/push/ack'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// How long "Snooze" pushes a medication reminder out. The */5 cron re-fires it
// once `until` has passed (see runDueMedicationReminders' snooze pass).
const SNOOZE_MINUTES = 10

type AckBody = { action?: string; reminderId?: string; time?: string | null; dateKey?: string | null }

/**
 * Acknowledge a medication reminder push from the Service Worker's notification
 * actions, no app window required. "Taken" logs the dose (idempotent per day);
 * "Snooze" re-arms the reminder via KV for the cron to re-fire shortly.
 */
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId(request)
  if (!userId) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 })

  let body: AckBody
  try {
    body = (await request.json()) as AckBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 })
  }

  const action = body.action
  const reminderId = String(body.reminderId ?? '')
  if (!reminderId || (action !== 'taken' && action !== 'snooze')) {
    return NextResponse.json({ ok: false, error: 'Invalid action.' }, { status: 400 })
  }

  const db = getDb()
  const reminder = await db.query.medicationReminders.findFirst({
    where: eq(medicationReminders.id, reminderId),
  })
  if (!reminder || reminder.userId !== userId) {
    return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 })
  }

  const dateKey = typeof body.dateKey === 'string' ? body.dateKey : ''
  const time = typeof body.time === 'string' ? body.time : ''
  await acknowledgeReminderSlot(reminderId, dateKey, time)

  if (action === 'taken') {
    await markMedicationReminderTaken({ db, userId }, userId, reminderId)
    return NextResponse.json({ ok: true, action: 'taken' })
  }

  // snooze: re-arm via KV. The cron's snooze pass re-sends once `until` passes,
  // then clears the key (fires once). Degrades silently if KV is unavailable.
  try {
    const kv = getCloudflareContext().env.KV as unknown as
      | { put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void> }
      | undefined
    if (kv) {
      const until = Date.now() + SNOOZE_MINUTES * 60 * 1000
      await kv.put(
        `medsnooze:${reminderId}`,
        JSON.stringify({ until, time: body.time ?? null, dateKey: body.dateKey ?? null }),
        { expirationTtl: SNOOZE_MINUTES * 60 + 180 },
      )
    }
  } catch {
    // KV not bound (e.g. local dev), snooze is best-effort, not fatal.
  }
  return NextResponse.json({ ok: true, action: 'snooze' })
}
