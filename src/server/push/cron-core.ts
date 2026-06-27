// Pure helpers for the medication-reminder scheduler. No I/O, no Cloudflare
// bindings, so the matching/timezone logic is unit-testable.

/** Minutes-since-midnight for `date` rendered in an IANA timezone. */
export function localMinutesInTimeZone(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date)
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
    return hour * 60 + minute
  } catch {
    return date.getUTCHours() * 60 + date.getUTCMinutes()
  }
}

/** YYYY-MM-DD for `date` in an IANA timezone (used for once-per-day dedup keys). */
export function localDateKeyInTimeZone(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)
    const year = parts.find((p) => p.type === 'year')?.value
    const month = parts.find((p) => p.type === 'month')?.value
    const day = parts.find((p) => p.type === 'day')?.value
    if (year && month && day) return `${year}-${month}-${day}`
  } catch {
    // fall through
  }
  return date.toISOString().slice(0, 10)
}

export function timeToMinutes(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return hour * 60 + minute
}

export type ReminderAlertState = {
  attempts: number
  lastSentAt: number | null
}

export type MedicationReminderNotification = {
  type: 'medication_reminder'
  title: string
  body: string
}

export const REMINDER_ALERT_WINDOW_MINUTES = 31
export const REMINDER_ALERT_GAP_MINUTES = 4
export const REMINDER_ALERT_MAX_ATTEMPTS = 4

export function reminderDeliveryWindowMinutes(_hasPersistentState: boolean): number {
  return REMINDER_ALERT_WINDOW_MINUTES
}

export function parseReminderAlertState(raw: string | null): ReminderAlertState {
  if (!raw) return { attempts: 0, lastSentAt: null }

  if (/^\d+$/.test(raw.trim())) {
    return { attempts: Math.max(0, Number(raw)), lastSentAt: null }
  }

  try {
    const parsed = JSON.parse(raw) as { attempts?: unknown; lastSentAt?: unknown }
    const attempts =
      typeof parsed.attempts === 'number' && Number.isFinite(parsed.attempts)
        ? Math.max(0, Math.floor(parsed.attempts))
        : 0
    const lastSentAt =
      typeof parsed.lastSentAt === 'number' && Number.isFinite(parsed.lastSentAt) ? parsed.lastSentAt : null
    return { attempts, lastSentAt }
  } catch {
    return { attempts: 0, lastSentAt: null }
  }
}

export function serializeReminderAlertState(state: ReminderAlertState): string {
  return JSON.stringify({
    attempts: Math.max(0, Math.floor(state.attempts)),
    lastSentAt: state.lastSentAt,
  })
}

export function reminderAlertStateKey(reminderId: string, dateKey: string, time: string): string {
  return `medpush:${reminderId}:${dateKey}:${time}`
}

export function reminderSlotAckKey(reminderId: string, dateKey: string, time: string): string {
  return `medack:${reminderId}:${dateKey}:${time}`
}

export function nextReminderAlertAttempt({
  time,
  nowMinutes,
  nowMs,
  state,
  acknowledged = false,
  taken = false,
  windowMinutes = REMINDER_ALERT_WINDOW_MINUTES,
  gapMinutes = REMINDER_ALERT_GAP_MINUTES,
  maxAttempts = REMINDER_ALERT_MAX_ATTEMPTS,
}: {
  time: string
  nowMinutes: number
  nowMs: number
  state: ReminderAlertState
  acknowledged?: boolean
  taken?: boolean
  windowMinutes?: number
  gapMinutes?: number
  maxAttempts?: number
}): number | null {
  if (acknowledged || taken) return null

  const slotMinutes = timeToMinutes(time)
  if (slotMinutes === null) return null

  const delta = nowMinutes - slotMinutes
  if (delta < 0 || delta >= windowMinutes) return null

  const attempts = Math.max(0, Math.floor(state.attempts))
  if (attempts >= maxAttempts) return null

  if (state.lastSentAt !== null) {
    const elapsedMs = nowMs - state.lastSentAt
    if (elapsedMs < gapMinutes * 60 * 1000) return null
  }

  return attempts + 1
}

export function wasReminderSlotTaken(
  lastTakenAt: Date | null | undefined,
  dateKey: string,
  time: string,
  timeZone: string,
): boolean {
  if (!lastTakenAt) return false

  const slotMinutes = timeToMinutes(time)
  if (slotMinutes === null) return false
  if (localDateKeyInTimeZone(lastTakenAt, timeZone) !== dateKey) return false

  return localMinutesInTimeZone(lastTakenAt, timeZone) >= slotMinutes
}

export function buildMedicationReminderNotification({
  medication,
  dose,
  time,
  snoozed = false,
}: {
  medication: string
  dose?: string | null
  time?: string | null
  snoozed?: boolean
}): MedicationReminderNotification {
  const cleanMedication = medication.trim() || 'Medication'
  const cleanDose = dose?.trim() ? `, ${dose.trim()}` : ''
  const cleanTime = time?.trim()
  return {
    type: 'medication_reminder',
    title: snoozed ? `Snoozed reminder: ${cleanMedication}` : `Time for ${cleanMedication}`,
    body: snoozed
      ? `${cleanMedication}${cleanDose} is due again. Mark it taken when you can.`
      : `${cleanMedication}${cleanDose}${cleanTime ? ` was due at ${cleanTime}` : ' is due'}. Mark it taken when you can.`,
  }
}

/**
 * Of `times` (HH:MM), the ones that just became due, meaning occurred within the
 * last `windowMin` minutes relative to `nowMinutes`. The caller decides whether
 * to skip, send, or re-alert that slot.
 */
export function dueSlotsInWindow(times: string[], nowMinutes: number, windowMin: number): string[] {
  const due: string[] = []
  for (const time of times) {
    const slot = timeToMinutes(time)
    if (slot === null) continue
    const delta = nowMinutes - slot
    if (delta >= 0 && delta < windowMin) due.push(time)
  }
  return due
}
