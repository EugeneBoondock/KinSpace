import assert from 'node:assert/strict'
import test from 'node:test'

import {
  REMINDER_ALERT_WINDOW_MINUTES,
  dueSlotsInWindowWithDate,
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

test('a scheduled tick after midnight still finds late previous-day slots', () => {
  assert.deepEqual(
    dueSlotsInWindowWithDate(['23:58', '00:01', '00:04'], 2, 5, '2026-06-28'),
    [
      { time: '23:58', dateKey: '2026-06-27', minutesAgo: 4 },
      { time: '00:01', dateKey: '2026-06-28', minutesAgo: 1 },
    ],
  )
})

test('a scheduled tick after midnight can start the previous-day alert run', () => {
  assert.equal(
    nextReminderAlertAttempt({
      time: '23:58',
      nowMinutes: 2,
      nowMs: Date.parse('2026-06-27T22:02:00.000Z'),
      state: { attempts: 0, lastSentAt: null },
      windowMinutes: 5,
    }),
    1,
  )
})
