import { eq } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { medicationReminders, profiles, pushSubscriptions } from '@/server/db/schema'
import { normalizeReminderTimes } from '@/lib/medication-reminders'
import { dueSlotsInWindow, localMinutesInTimeZone, localDateKeyInTimeZone } from './cron-core'
import { sendWebPushToAll, isPushConfigured } from './send'

// SA-first default when a member hasn't recorded a timezone (set on push opt-in).
const DEFAULT_TZ = 'Africa/Johannesburg'
// Slightly wider than the 5-minute cron so a slot is never skipped between ticks.
const WINDOW_MIN = 6
const DEDUP_TTL_SECONDS = 60 * 60 * 26 // ~1 day; clears for the next day's dose

type ReminderRow = typeof medicationReminders.$inferSelect

type KvLike = {
  get: (key: string) => Promise<string | null>
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>
}

/**
 * Finds medication reminders due right now (per each member's local timezone),
 * de-dupes per dose/day via KV, and sends a persistent Web Push to that member's
 * devices. Safe to run every ~5 minutes. Returns a summary for the cron caller.
 */
export async function runDueMedicationReminders(now: Date) {
  if (!isPushConfigured()) return { ok: false, reason: 'push-not-configured' as const }

  const db = getDb()
  let kv: KvLike | undefined
  try {
    kv = getCloudflareContext().env.KV as unknown as KvLike | undefined
  } catch {
    kv = undefined
  }

  const reminders = (await db.query.medicationReminders.findMany({
    where: eq(medicationReminders.active, true),
  })) as ReminderRow[]
  if (reminders.length === 0) return { ok: true, due: 0, sent: 0 }

  const byUser = new Map<string, ReminderRow[]>()
  for (const reminder of reminders) {
    const list = byUser.get(reminder.userId) ?? []
    list.push(reminder)
    byUser.set(reminder.userId, list)
  }

  let dueCount = 0
  let sentCount = 0

  for (const [userId, userReminders] of byUser) {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
      columns: { timezone: true },
    })
    const tz = profile?.timezone || DEFAULT_TZ
    const nowMinutes = localMinutesInTimeZone(now, tz)
    const dateKey = localDateKeyInTimeZone(now, tz)

    const dueForUser: Array<{ reminder: ReminderRow; time: string }> = []
    for (const reminder of userReminders) {
      for (const time of dueSlotsInWindow(normalizeReminderTimes(reminder.times ?? []), nowMinutes, WINDOW_MIN)) {
        dueForUser.push({ reminder, time })
      }
    }
    if (dueForUser.length === 0) continue

    // Drop slots already handled today (KV dedup).
    const fresh: Array<{ reminder: ReminderRow; time: string; key: string }> = []
    for (const item of dueForUser) {
      const key = `medpush:${item.reminder.id}:${dateKey}:${item.time}`
      if (kv && (await kv.get(key))) continue
      fresh.push({ ...item, key })
    }
    if (fresh.length === 0) continue
    dueCount += fresh.length

    const subs = await db.query.pushSubscriptions.findMany({ where: eq(pushSubscriptions.userId, userId) })
    const subList = subs.map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }))

    for (const item of fresh) {
      if (subList.length > 0) {
        const dose = item.reminder.dose ? `, ${item.reminder.dose}` : ''
        const results = await sendWebPushToAll(subList, {
          title: `Time for ${item.reminder.medication}`,
          body: `${item.reminder.medication}${dose} at ${item.time}. Tap Taken once you have.`,
          url: '/dashboard?meds=1',
          tag: `med-${item.reminder.id}-${item.time}`,
          requireInteraction: true,
          actions: [
            { action: 'taken', title: 'Taken' },
            { action: 'snooze', title: 'Snooze 10m' },
          ],
          data: { kind: 'med-reminder', reminderId: item.reminder.id, time: item.time },
        })
        if (results.some((r) => r.ok)) sentCount += 1
        for (const endpoint of results.filter((r) => r.gone).map((r) => r.endpoint)) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
        }
      }
      // Mark handled regardless (no devices → don't recompute endlessly today).
      if (kv) await kv.put(item.key, '1', { expirationTtl: DEDUP_TTL_SECONDS })
    }
  }

  return { ok: true, due: dueCount, sent: sentCount }
}
