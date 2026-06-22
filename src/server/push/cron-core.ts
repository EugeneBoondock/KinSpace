// Pure helpers for the medication-reminder scheduler. No I/O, no Cloudflare
// bindings — so the matching/timezone logic is unit-testable.

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

/**
 * Of `times` (HH:MM), the ones that just became due — i.e. occurred within the
 * last `windowMin` minutes relative to `nowMinutes`. The window (slightly larger
 * than the cron interval) means a 5-minute cron never skips a slot, and the
 * once-per-day dedup key prevents a slot firing twice.
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
