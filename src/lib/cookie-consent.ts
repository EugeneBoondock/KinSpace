export type CookieConsent = 'accepted' | 'essential'

export const COOKIE_CONSENT_STORAGE_KEY = 'kinspace:cookie-consent'
export const COOKIE_CONSENT_COOKIE_NAME = 'kinspace_cookie_consent'
export const COOKIE_CONSENT_EVENT = 'kinspace:cookie-consent-change'
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export function normalizeCookieConsent(value: unknown): CookieConsent | null {
  return value === 'accepted' || value === 'essential' ? value : null
}

export function buildCookieConsentCookie(value: CookieConsent): string {
  return `${COOKIE_CONSENT_COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax; Secure`
}

function readConsentCookie(cookieString: string): CookieConsent | null {
  const parts = cookieString.split(';').map((part) => part.trim())
  const prefix = `${COOKIE_CONSENT_COOKIE_NAME}=`
  const match = parts.find((part) => part.startsWith(prefix))
  if (!match) return null
  return normalizeCookieConsent(decodeURIComponent(match.slice(prefix.length)))
}

export function getCookieConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = normalizeCookieConsent(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY))
    if (stored) return stored
  } catch {
    // Storage can be blocked. Fall back to the first-party cookie.
  }

  try {
    return readConsentCookie(document.cookie)
  } catch {
    return null
  }
}

export function shouldShowCookieConsent(value: CookieConsent | null): boolean {
  return value === null
}

export function setCookieConsent(value: CookieConsent) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, value)
  } catch {
    // The cookie and in-page event still record the preference for this browser.
  }

  document.cookie = buildCookieConsentCookie(value)
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: value }))
}

export function subscribeCookieConsent(listener: (value: CookieConsent | null) => void) {
  if (typeof window === 'undefined') return () => undefined

  const handleConsentEvent = (event: Event) => {
    listener(normalizeCookieConsent((event as CustomEvent).detail))
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === COOKIE_CONSENT_STORAGE_KEY || event.key === null) {
      listener(normalizeCookieConsent(event.newValue))
    }
  }

  window.addEventListener(COOKIE_CONSENT_EVENT, handleConsentEvent)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsentEvent)
    window.removeEventListener('storage', handleStorage)
  }
}
