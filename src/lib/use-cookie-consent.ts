import { useSyncExternalStore } from 'react'
import {
  getCookieConsent,
  subscribeCookieConsent,
  type CookieConsent,
} from '@/lib/cookie-consent'

const subscribeToClientReady = () => () => undefined

export function useClientReady() {
  return useSyncExternalStore(subscribeToClientReady, () => true, () => false)
}

export function useCookieConsent(): CookieConsent | null {
  return useSyncExternalStore(subscribeCookieConsent, getCookieConsent, () => null)
}
