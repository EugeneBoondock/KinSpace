'use client'

// Client-side notification surfacing: a warm chime plus a native system pop-up
// (which appears on mobile when the PWA is installed). This handles the
// FOREGROUND case — when the app is open and our poller sees a new notification.
// Background push (app fully closed) would need Web Push + VAPID + a push server;
// that's a separate build. This already gives mobile pop-ups while the app runs.

import { playNotificationChime } from '@/lib/audio/chime'

/** Ask for Notification permission once. Safe to call from a user gesture. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try {
    const result = await Notification.requestPermission()
    return result === 'granted'
  } catch {
    return false
  }
}

/** Whether we can show a native pop-up right now. */
export function canShowSystemNotification(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
}

/**
 * Show a native notification, preferring the service worker registration (works
 * on mobile/installed PWAs) and falling back to the page-level Notification.
 */
export async function showLocalNotification(
  title: string,
  options: { body?: string; data?: Record<string, unknown>; tag?: string } = {},
): Promise<void> {
  if (!canShowSystemNotification()) return
  const payload: NotificationOptions = {
    body: options.body,
    icon: '/images/gather_logo.png',
    badge: '/images/gather_logo.png',
    tag: options.tag,
    data: { url: '/notifications', ...(options.data ?? {}) },
  }
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(title, payload)
      return
    }
  } catch {
    // fall through to the page-level Notification
  }
  try {
    new Notification(title, payload)
  } catch {
    // best-effort only
  }
}

/** Play the chime and, if permitted, raise a native pop-up. */
export async function alertNewNotification(title: string, body?: string, data?: Record<string, unknown>) {
  playNotificationChime()
  await showLocalNotification(title, { body, data, tag: 'kinspace-activity' })
}
