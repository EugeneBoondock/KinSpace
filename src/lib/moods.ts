export const MOOD_CHECKIN_VALUES = ['grounded', 'hopeful', 'tired', 'stretched', 'heavy'] as const

export type MoodCheckinValue = (typeof MOOD_CHECKIN_VALUES)[number]

const MOOD_CHECKIN_SET = new Set<string>(MOOD_CHECKIN_VALUES)

export function normalizeMoodCheckin(value: unknown): MoodCheckinValue {
  if (typeof value !== 'string') {
    throw new Error('Mood check-in must be a string')
  }

  const mood = value.trim().toLowerCase()
  if (!MOOD_CHECKIN_SET.has(mood)) {
    throw new Error('Unsupported mood check-in state')
  }

  return mood as MoodCheckinValue
}
