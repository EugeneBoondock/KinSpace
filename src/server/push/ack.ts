import { getCloudflareContext } from '@opennextjs/cloudflare'
import { reminderSlotAckKey, timeToMinutes } from './cron-core'

const REMINDER_SLOT_ACK_TTL_SECONDS = 60 * 60 * 26

type KvLike = {
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>
}

export async function acknowledgeReminderSlot(reminderId: string, dateKey: string, time: string): Promise<void> {
  if (!reminderId || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || timeToMinutes(time) === null) return

  try {
    const kv = getCloudflareContext().env.KV as unknown as KvLike | undefined
    if (kv) {
      await kv.put(reminderSlotAckKey(reminderId, dateKey, time), '1', {
        expirationTtl: REMINDER_SLOT_ACK_TTL_SECONDS,
      })
    }
  } catch {
    // Missing KV should never block a medication action.
  }
}
