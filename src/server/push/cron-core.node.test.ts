import assert from 'node:assert/strict'
import test from 'node:test'

import {
  REMINDER_ALERT_WINDOW_MINUTES,
  nextReminderAlertAttempt,
  reminderDeliveryWindowMinutes,
} from './cron-core'

test('medication reminder delivery keeps the full alert window without KV state', () => {
  assert.equal(reminderDeliveryWindowMinutes(false), REMINDER_ALERT_WINDOW_MINUTES)
})

test('a late scheduled tick can still start a closed-app medication alert', () => {
  const windowMinutes = reminderDeliveryWindowMinutes(false)

  assert.equal(
    nextReminderAlertAttempt({
      time: '22:00',
      nowMinutes: 22 * 60 + 9,
      nowMs: Date.parse('2026-06-27T20:09:00.000Z'),
      state: { attempts: 0, lastSentAt: null },
      windowMinutes,
    }),
    1,
  )
})
