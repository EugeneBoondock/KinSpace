export type TrackingConsent = 'granted' | 'denied'

export const TRACKING_CONSENT_STORAGE_KEY = 'kinspace:tracking-consent'
export const TRACKING_CONSENT_EVENT = 'kinspace:tracking-consent-change'

function normalizeTrackingConsent(value: unknown): TrackingConsent | null {
  return value === 'granted' || value === 'denied' ? value : null
}

export function getTrackingConsent(): TrackingConsent | null {
  if (typeof window === 'undefined') return null

  try {
    return normalizeTrackingConsent(window.localStorage.getItem(TRACKING_CONSENT_STORAGE_KEY))
  } catch {
    return null
  }
}

export function setTrackingConsent(value: TrackingConsent) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(TRACKING_CONSENT_STORAGE_KEY, value)
  } catch {
    // Keep the in-page signal working even if storage is blocked.
  }

  window.dispatchEvent(new CustomEvent(TRACKING_CONSENT_EVENT, { detail: value }))
}

export function subscribeTrackingConsent(listener: (value: TrackingConsent | null) => void) {
  if (typeof window === 'undefined') return () => undefined

  const handleConsentEvent = (event: Event) => {
    listener(normalizeTrackingConsent((event as CustomEvent).detail))
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === TRACKING_CONSENT_STORAGE_KEY || event.key === null) {
      listener(normalizeTrackingConsent(event.newValue))
    }
  }

  window.addEventListener(TRACKING_CONSENT_EVENT, handleConsentEvent)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(TRACKING_CONSENT_EVENT, handleConsentEvent)
    window.removeEventListener('storage', handleStorage)
  }
}
