import { useSyncExternalStore } from 'react'
import {
  getTrackingConsent,
  subscribeTrackingConsent,
  type TrackingConsent,
} from '@/lib/tracking-consent'

const subscribeToClientReady = () => () => undefined

export function useClientReady() {
  return useSyncExternalStore(subscribeToClientReady, () => true, () => false)
}

export function useTrackingConsent(): TrackingConsent | null {
  return useSyncExternalStore(subscribeTrackingConsent, getTrackingConsent, () => null)
}
