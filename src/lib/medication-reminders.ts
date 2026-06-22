export type MedicationReminderSchedule = {
  id: string
  medication: string
  dose?: string | null
  times: string[]
  active: boolean
}

export type DueMedicationReminderSlot = {
  reminder: MedicationReminderSchedule
  time: string
  ackKey: string
}

export type ReminderTimeSuggestion = {
  times: string[]
  note: string
}

const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function normalizeReminderTimes(times: string[]): string[] {
  const normalized = new Set<string>()

  for (const rawTime of times) {
    const match = rawTime.trim().match(TIME_PATTERN)
    if (!match) continue

    const hour = Number(match[1])
    const minute = Number(match[2])
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) continue
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) continue

    normalized.add(`${pad2(hour)}:${pad2(minute)}`)
  }

  return [...normalized].sort()
}

export function resolveReminderTimesForSave(times: string[], timeInput: string): string[] {
  const savedTimes = normalizeReminderTimes(times)
  const stagedTimes = normalizeReminderTimes([timeInput])

  if (stagedTimes.length === 0) return savedTimes
  if (savedTimes.length <= 1) return stagedTimes

  return normalizeReminderTimes([...savedTimes, stagedTimes[0]])
}

export function medicationProfileKey(value: string): string {
  return value.replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase()
}

export function reconcileProfileMedications(
  currentMedications: string[],
  reminderMedications: string[],
  staleMedications: string[] = [],
): string[] {
  const reminderKeys = new Set(
    reminderMedications
      .map(medicationProfileKey)
      .filter(Boolean),
  )
  const staleKeys = new Set(
    staleMedications
      .map(medicationProfileKey)
      .filter(Boolean),
  )
  const seen = new Set<string>()
  const next: string[] = []

  for (const rawMedication of currentMedications) {
    const medication = String(rawMedication).trim()
    const key = medicationProfileKey(medication)
    if (!medication || !key || seen.has(key)) continue
    if (staleKeys.has(key) && !reminderKeys.has(key)) continue
    seen.add(key)
    next.push(medication)
  }

  for (const rawMedication of reminderMedications) {
    const medication = String(rawMedication).trim()
    const key = medicationProfileKey(medication)
    if (!medication || !key || seen.has(key)) continue
    seen.add(key)
    next.push(medication)
  }

  return next
}

export function buildReminderAckKey(reminderId: string, time: string, date: Date): string {
  return `${localDateKey(date)}:${reminderId}:${time}`
}

export function getDueMedicationReminderSlots(
  reminders: MedicationReminderSchedule[],
  now: Date,
  acknowledgedKeys: Set<string>,
): DueMedicationReminderSlot[] {
  const currentTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
  const due: DueMedicationReminderSlot[] = []

  for (const reminder of reminders) {
    if (!reminder.active) continue

    for (const time of normalizeReminderTimes(reminder.times)) {
      if (time !== currentTime) continue

      const ackKey = buildReminderAckKey(reminder.id, time, now)
      if (acknowledgedKeys.has(ackKey)) continue

      due.push({ reminder, time, ackKey })
    }
  }

  return due
}

export function suggestMedicationReminderTimesFallback({
  frequency,
  timingHint,
}: {
  frequency?: string
  timingHint?: string
}): ReminderTimeSuggestion {
  const text = `${frequency ?? ''} ${timingHint ?? ''}`.toLowerCase()
  let times = ['08:00']

  if (text.includes('before bed') || text.includes('bedtime') || text.includes('night')) {
    times = text.includes('twice') || text.includes('2') ? ['08:00', '21:00'] : ['21:00']
  } else if (text.includes('three') || text.includes('3')) {
    times = ['08:00', '14:00', '20:00']
  } else if (text.includes('twice') || text.includes('2')) {
    times = text.includes('food') || text.includes('meal') ? ['08:00', '18:00'] : ['08:00', '20:00']
  }

  return {
    times,
    note:
      'These are neutral reminder slots. Follow the prescription label and your clinician’s instructions if they say something different.',
  }
}
