'use client'

import { getVapidPublicKey } from './vapid'
import { DatabaseService } from '@/lib/database'

export type PushStatus =
  | 'unsupported'
  | 'denied'
  | 'default'
  | 'granted-subscribed'
  | 'granted-refresh-needed'
  | 'granted-unsubscribed'
  | 'server-unconfigured'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

function bufferSourceToUint8Array(value: ArrayBuffer | ArrayBufferView | null | undefined): Uint8Array | null {
  if (!value) return null
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
}

function byteArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function subscriptionMatchesKey(subscription: PushSubscription, applicationServerKey: Uint8Array): boolean {
  const currentKey = bufferSourceToUint8Array(subscription.options?.applicationServerKey)
  if (!currentKey) return true
  return byteArraysEqual(currentKey, applicationServerKey)
}

async function currentApplicationServerKey(): Promise<Uint8Array> {
  return urlBase64ToUint8Array(await getVapidPublicKey())
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission === 'default') return 'default'
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return 'granted-unsubscribed'

    try {
      const applicationServerKey = await currentApplicationServerKey()
      return subscriptionMatchesKey(subscription, applicationServerKey) ? 'granted-subscribed' : 'granted-refresh-needed'
    } catch {
      return 'server-unconfigured'
    }
  } catch {
    return 'granted-unsubscribed'
  }
}

/** Request permission, subscribe via the push service, and store the subscription. */
export async function enablePush(options: { requestPermission?: boolean } = {}): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { ok: false, error: 'This browser does not support background reminders.' }
  }
  try {
    const permission =
      options.requestPermission === false && Notification.permission !== 'default'
        ? Notification.permission
        : await Notification.requestPermission()
    if (permission !== 'granted') {
      return { ok: false, error: 'Notifications are blocked. Enable them in your browser settings to get reminders.' }
    }
    const applicationServerKey = await currentApplicationServerKey()
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()
    if (subscription && !subscriptionMatchesKey(subscription, applicationServerKey)) {
      const endpoint = subscription.endpoint
      await subscription.unsubscribe().catch(() => undefined)
      await DatabaseService.deletePushSubscription(endpoint).catch(() => undefined)
      subscription = null
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })
    }
    const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    await DatabaseService.savePushSubscription({ endpoint: json.endpoint, keys: json.keys }, navigator.userAgent)
    // Remember this device's timezone so reminders fire at the user's local dose time.
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (tz) await DatabaseService.setMyTimezone(tz)
    } catch {
      // best-effort; the cron falls back to a sensible default timezone
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not enable background reminders.' }
  }
}

/** Unsubscribe this device and remove it server-side. */
export async function disablePush(): Promise<{ ok: boolean }> {
  if (!isPushSupported()) return { ok: true }
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      const endpoint = subscription.endpoint
      await subscription.unsubscribe().catch(() => undefined)
      await DatabaseService.deletePushSubscription(endpoint).catch(() => undefined)
    }
    return { ok: true }
  } catch {
    return { ok: true }
  }
}
