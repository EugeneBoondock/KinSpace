import { describe, it, expect } from 'vitest'
import { timeToMinutes, dueSlotsInWindow, localMinutesInTimeZone, localDateKeyInTimeZone } from './cron-core'

describe('timeToMinutes', () => {
  it('parses valid HH:MM', () => {
    expect(timeToMinutes('08:00')).toBe(480)
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('23:59')).toBe(1439)
  })
  it('rejects invalid input', () => {
    expect(timeToMinutes('24:00')).toBeNull()
    expect(timeToMinutes('8')).toBeNull()
    expect(timeToMinutes('')).toBeNull()
    expect(timeToMinutes('aa:bb')).toBeNull()
  })
})

describe('dueSlotsInWindow', () => {
  it('returns a slot at exactly now', () => {
    expect(dueSlotsInWindow(['08:00'], 480, 5)).toEqual(['08:00'])
  })
  it('returns a slot up to (window-1) minutes ago', () => {
    expect(dueSlotsInWindow(['08:00'], 484, 5)).toEqual(['08:00']) // 4 min ago
  })
  it('excludes a slot exactly window minutes ago (already covered by prior tick)', () => {
    expect(dueSlotsInWindow(['08:00'], 485, 5)).toEqual([]) // 5 min ago
  })
  it('excludes future slots', () => {
    expect(dueSlotsInWindow(['08:00'], 479, 5)).toEqual([])
  })
  it('matches each due slot once across times', () => {
    expect(dueSlotsInWindow(['08:00', '20:00'], 480, 5)).toEqual(['08:00'])
    expect(dueSlotsInWindow(['08:00', '20:00'], 1200, 5)).toEqual(['20:00'])
  })
  it('ignores malformed times', () => {
    expect(dueSlotsInWindow(['nope', '08:00'], 480, 5)).toEqual(['08:00'])
  })
})

describe('timezone helpers', () => {
  it('computes local minutes for a known instant', () => {
    // 2026-06-22T06:00:00Z = 08:00 in Africa/Johannesburg (UTC+2).
    const d = new Date('2026-06-22T06:00:00Z')
    expect(localMinutesInTimeZone(d, 'Africa/Johannesburg')).toBe(8 * 60)
    expect(localMinutesInTimeZone(d, 'UTC')).toBe(6 * 60)
  })
  it('computes the local date key', () => {
    // 22:30Z on the 22nd is 00:30 on the 23rd in Johannesburg.
    const d = new Date('2026-06-22T22:30:00Z')
    expect(localDateKeyInTimeZone(d, 'Africa/Johannesburg')).toBe('2026-06-23')
    expect(localDateKeyInTimeZone(d, 'UTC')).toBe('2026-06-22')
  })
})
