import { isCrisisText, SA_CRISIS_REPLY } from './crisis-detect'

export type TimestampLike =
  | Date
  | string
  | number
  | { seconds?: number; toDate?: () => Date }
  | null
  | undefined
  | unknown

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function toDate(value: TimestampLike): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  if (typeof value === 'object') {
    const maybeTimestamp = value as { toDate?: () => Date; seconds?: number }
    if (typeof maybeTimestamp.toDate === 'function') return maybeTimestamp.toDate()
    if (typeof maybeTimestamp.seconds === 'number') return new Date(maybeTimestamp.seconds * 1000)
  }
  return null
}

export function formatRelativeTime(value: TimestampLike): string {
  const date = toDate(value)
  if (!date) return 'Recently'

  const diffMs = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) return 'Just now'
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))}m ago`
  if (diffMs < day) return `${Math.max(1, Math.floor(diffMs / hour))}h ago`
  if (diffMs < 7 * day) return `${Math.max(1, Math.floor(diffMs / day))}d ago`

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (!value) return '0'

  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function getInitials(value: string | null | undefined, fallback = '?') {
  if (!value?.trim()) return fallback

  const initials = value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase())
    .join('')

  return initials || fallback
}

export function normalizeKeywords(...values: Array<string | string[] | null | undefined>) {
  const keywords = new Set<string>()

  values.forEach((value) => {
    if (!value) return

    const items = Array.isArray(value) ? value : value.split(/[,\s]+/)
    items
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length >= 2)
      .forEach((item) => keywords.add(item))
  })

  return Array.from(keywords)
}

export function getDistanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const earthRadiusKm = 6371

  const latitudeDelta = toRadians(latitudeB - latitudeA)
  const longitudeDelta = toRadians(longitudeB - longitudeA)

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a))
}

interface SupportReply {
  text: string
  mood: 'steady' | 'supportive' | 'urgent'
}

export function detectConcern(message: string) {
  const lower = message.toLowerCase()

  // Crisis detection (incl. passive ideation) lives in one shared module.
  if (isCrisisText(message)) {
    return 'crisis'
  }
  if (/(panic|anxious|anxiety|nervous|overwhelmed)/.test(lower)) {
    return 'anxiety'
  }
  if (/(sad|depress|empty|hopeless|worthless)/.test(lower)) {
    return 'depression'
  }
  if (/(grief|grieving|loss|passed away|died|bereave)/.test(lower)) {
    return 'grief'
  }
  if (/(pain|flare|fatigue|exhausted|burnout|drained)/.test(lower)) {
    return 'fatigue'
  }

  return 'general'
}

export function buildGuidedSupportReply(message: string, historyLength = 0): SupportReply {
  const concern = detectConcern(message)

  if (concern === 'crisis') {
    return {
      mood: 'urgent',
      text: SA_CRISIS_REPLY,
    }
  }

  if (concern === 'anxiety') {
    return {
      mood: 'supportive',
      text:
        'Let us slow this down together. Try one thing first: unclench your jaw, drop your shoulders, and take one longer exhale than inhale. If you want, tell me what feels most intense right now and we can break it into one manageable next step.',
    }
  }

  if (concern === 'depression') {
    return {
      mood: 'supportive',
      text:
        'Thank you for staying in the conversation with me. When everything feels heavy, the goal is not to fix the whole day at once. Pick one tiny action you can finish in five minutes, and then tell me how it felt so we can build from there.',
    }
  }

  if (concern === 'grief') {
    return {
      mood: 'supportive',
      text:
        'Grief does not need to make sense to deserve care. You do not have to tidy it up here. If it feels okay, tell me what you are carrying today or share one memory you want to keep close.',
    }
  }

  if (concern === 'fatigue') {
    return {
      mood: 'steady',
      text:
        'That sounds exhausting. Before we talk solutions, it may help to separate what is urgent from what is simply loud. Tell me the one thing that most needs your energy today, and we can protect it first.',
    }
  }

  return {
    mood: 'steady',
    text:
      historyLength > 2
        ? 'I am with you. From what you have shared so far, it sounds like this has been weighing on you for a while. What part of it feels most important to name clearly right now?'
        : 'I am here with you. Tell me a little more about what is going on, and we can work through it one piece at a time.',
  }
}
