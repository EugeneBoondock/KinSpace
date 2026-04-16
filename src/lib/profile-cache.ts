// Small session-scoped profile cache so therapy + other pages don't re-fetch
// the full user profile on every interaction. Lives in sessionStorage so it
// survives route changes but not a full sign-out/sign-in.

import { DatabaseService } from './database'

const CACHE_KEY_PREFIX = 'kinspace:profile:'
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

type CachedProfile = {
  fetchedAt: number
  profile: Record<string, unknown>
}

function storageAvailable(): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.sessionStorage.getItem('_k')
    return true
  } catch {
    return false
  }
}

export async function getCachedProfile(
  userId: string,
  options: { force?: boolean } = {},
): Promise<Record<string, unknown> | null> {
  const key = `${CACHE_KEY_PREFIX}${userId}`

  if (!options.force && storageAvailable()) {
    const raw = window.sessionStorage.getItem(key)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as CachedProfile
        if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) {
          return parsed.profile
        }
      } catch {
        // fall through to re-fetch
      }
    }
  }

  const fresh = (await DatabaseService.getProfile(userId)) as Record<string, unknown> | null
  if (fresh && storageAvailable()) {
    window.sessionStorage.setItem(
      key,
      JSON.stringify({ fetchedAt: Date.now(), profile: fresh } satisfies CachedProfile),
    )
  }
  return fresh
}

export function invalidateCachedProfile(userId: string) {
  if (!storageAvailable()) return
  window.sessionStorage.removeItem(`${CACHE_KEY_PREFIX}${userId}`)
}

export function updateCachedProfile(userId: string, patch: Record<string, unknown>) {
  if (!storageAvailable()) return
  const key = `${CACHE_KEY_PREFIX}${userId}`
  const raw = window.sessionStorage.getItem(key)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as CachedProfile
    window.sessionStorage.setItem(
      key,
      JSON.stringify({
        fetchedAt: parsed.fetchedAt,
        profile: { ...parsed.profile, ...patch },
      } satisfies CachedProfile),
    )
  } catch {
    window.sessionStorage.removeItem(key)
  }
}
