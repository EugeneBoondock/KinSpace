import { strict as assert } from 'node:assert'
import test from 'node:test'

import {
  buildReminderAckKey,
  getDueMedicationReminderSlots,
  normalizeReminderTimes,
  reconcileProfileMedications,
  resolveReminderTimesForSave,
  suggestMedicationReminderTimesFallback,
  type MedicationReminderSchedule,
} from './medication-reminders'

test('normalizes medication reminder times to unique sorted HH:MM values', () => {
  assert.deepEqual(
    normalizeReminderTimes(['8:00', '20:15', '08:00', ' 7:05 ', '24:00', 'nope']),
    ['07:05', '08:00', '20:15'],
  )
})

test('finds active medication reminders due in the current local minute', () => {
  const now = new Date(2026, 5, 21, 8, 30, 15)
  const dueReminder: MedicationReminderSchedule = {
    id: 'med-1',
    medication: 'Sertraline',
    dose: '50 mg',
    times: ['08:30'],
    active: true,
  }
  const inactiveReminder: MedicationReminderSchedule = {
    id: 'med-2',
    medication: 'Vitamin D',
    dose: '',
    times: ['08:30'],
    active: false,
  }

  assert.deepEqual(getDueMedicationReminderSlots([dueReminder, inactiveReminder], now, new Set()), [
    {
      reminder: dueReminder,
      time: '08:30',
      ackKey: '2026-06-21:med-1:08:30',
    },
  ])
})

test('finds medication reminders that became due inside a recent wake window', () => {
  const now = new Date(2026, 5, 21, 8, 34, 15)
  const reminder: MedicationReminderSchedule = {
    id: 'med-1',
    medication: 'Sertraline',
    dose: '50 mg',
    times: ['08:30'],
    active: true,
  }

  assert.deepEqual(getDueMedicationReminderSlots([reminder], now, new Set(), 6), [
    {
      reminder,
      time: '08:30',
      ackKey: '2026-06-21:med-1:08:30',
    },
  ])
})

test('skips medication reminder slots already acknowledged today', () => {
  const now = new Date(2026, 5, 21, 20, 0, 0)
  const reminder: MedicationReminderSchedule = {
    id: 'med-1',
    medication: 'Metformin',
    dose: '500 mg',
    times: ['20:00'],
    active: true,
  }
  const ackKey = buildReminderAckKey(reminder.id, '20:00', now)

  assert.deepEqual(getDueMedicationReminderSlots([reminder], now, new Set([ackKey])), [])
})

test('uses the staged time when saving a single reminder time', () => {
  assert.deepEqual(resolveReminderTimesForSave(['08:00'], '09:30'), ['09:30'])
  assert.deepEqual(resolveReminderTimesForSave([], '7:05'), ['07:05'])
})

test('adds the staged time when saving multiple reminder times', () => {
  assert.deepEqual(resolveReminderTimesForSave(['08:00', '20:00'], '14:30'), [
    '08:00',
    '14:30',
    '20:00',
  ])
})

test('reconciles profile medications after reminder edits', () => {
  assert.deepEqual(
    reconcileProfileMedications(
      ['Acriptega', 'QA Med 123'],
      ['QA Med 123 edited'],
      ['QA Med 123'],
    ),
    ['Acriptega', 'QA Med 123 edited'],
  )
})

test('reconciles profile medications after reminder deletes', () => {
  assert.deepEqual(
    reconcileProfileMedications(
      ['Acriptega', 'QA Med 123 edited'],
      ['Acriptega'],
      ['QA Med 123 edited'],
    ),
    ['Acriptega'],
  )
})

test('keeps a stale medication when another reminder still uses that base name', () => {
  assert.deepEqual(
    reconcileProfileMedications(
      ['Acriptega', 'Metformin'],
      ['Metformin'],
      ['Metformin'],
    ),
    ['Acriptega', 'Metformin'],
  )
})

test('suggests neutral daily reminder slots when AI is unavailable', () => {
  assert.deepEqual(
    suggestMedicationReminderTimesFallback({ frequency: 'twice daily', timingHint: 'with food' }).times,
    ['08:00', '18:00'],
  )
  assert.deepEqual(
    suggestMedicationReminderTimesFallback({ frequency: 'once daily', timingHint: 'before bed' }).times,
    ['21:00'],
  )
  assert.match(
    suggestMedicationReminderTimesFallback({ frequency: 'three times daily' }).note,
    /prescription label/i,
  )
})
