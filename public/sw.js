const CACHE_NAME = 'kinspace-v7'
const OFFLINE_URL = '/offline'

const PRECACHE_URLS = [
  '/',
  '/offline',
  '/images/gather_logo.png',
  '/images/gather_logo1.png',
  '/manifest.json',
]

const MED_REMINDER_REPEAT_DELAY_MS = 9 * 1000
const MED_REMINDER_REPEAT_LIMIT = 8
const activeMedicationAlarms = new Set()

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function medicationAlarmKey(options) {
  const data = options.data || {}
  return [options.tag || 'kinspace-activity', data.reminderId || '', data.dateKey || '', data.time || ''].join(':')
}

function resolveNotificationTargetUrl(raw) {
  try {
    const url = new URL(raw || '/dashboard', self.location.origin)
    if (url.origin !== self.location.origin) return new URL('/dashboard', self.location.origin).href
    return url.href
  } catch {
    return new URL('/dashboard', self.location.origin).href
  }
}

async function showMedicationAlarm(title, options) {
  const alarmKey = medicationAlarmKey(options)
  const alarmOptions = {
    ...options,
    data: { ...(options.data || {}), alarmKey },
  }

  activeMedicationAlarms.add(alarmKey)
  try {
    await self.registration.showNotification(title, alarmOptions)

    for (let attempt = 1; attempt <= MED_REMINDER_REPEAT_LIMIT; attempt += 1) {
      await sleep(MED_REMINDER_REPEAT_DELAY_MS)
      if (!activeMedicationAlarms.has(alarmKey)) break

      const visible = await self.registration.getNotifications({ tag: alarmOptions.tag })
      if (visible.length === 0) break

      await self.registration.showNotification(title, {
        ...alarmOptions,
        timestamp: Date.now(),
        data: { ...(alarmOptions.data || {}), repeat: attempt },
      })
    }
  } finally {
    activeMedicationAlarms.delete(alarmKey)
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(OFFLINE_URL).then((response) => response || caches.match('/'))
      )
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }

          const responseClone = response.clone()
          const url = new URL(event.request.url)

          if (
            url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|woff2?)$/) ||
            url.pathname.startsWith('/_next/static/')
          ) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone)
            })
          }

          return response
        })
        .catch(() => {
          if (event.request.destination === 'image') {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#6B8A83">Offline</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            )
          }
          return new Response('Offline', { status: 503 })
        })
    })
  )
})

// Web Push entry point (used once a push backend with VAPID is wired up). Payload
// shape: { title, body, url }. Falls back to a generic KinSpace message.
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (err) {
    payload = { body: event.data && event.data.text ? event.data.text() : '' }
  }
  const title = payload.title || 'KinSpace'
  const options = {
    body: payload.body || 'You have new activity.',
    icon: '/images/gather_logo.png',
    badge: '/images/gather_logo.png',
    tag: payload.tag || 'kinspace-activity',
    timestamp: typeof payload.timestamp === 'number' ? payload.timestamp : Date.now(),
    silent: Boolean(payload.silent) && !payload.requireInteraction,
    // Re-alert even if a notification with this tag already exists.
    renotify: payload.renotify !== false,
    // Persistent + buzzing: medication reminders are too easy to swipe away,
    // so for those we keep the notification up until the user acts.
    requireInteraction: Boolean(payload.requireInteraction),
    vibrate: Array.isArray(payload.vibrate) ? payload.vibrate : [700, 250, 700, 250, 700, 500, 900],
    actions: Array.isArray(payload.actions) ? payload.actions.slice(0, 2) : [],
    data: { url: payload.url || '/notifications', ...(payload.data || {}) },
  }
  const isMedicationReminder = options.data && options.data.kind === 'med-reminder'
  event.waitUntil(isMedicationReminder ? showMedicationAlarm(title, options) : self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {}
  if (data.alarmKey) activeMedicationAlarms.delete(data.alarmKey)
  event.notification.close()

  // Medication reminder action buttons: acknowledge to the server directly, with
  // no app window needed. "Taken" logs the dose; "Snooze 10m" re-arms it via the
  // reminder cron. Same-origin fetch carries the session cookie.
  if ((event.action === 'taken' || event.action === 'snooze') && data.kind === 'med-reminder' && data.reminderId) {
    event.waitUntil(
      fetch('/api/push/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: event.action, reminderId: data.reminderId, time: data.time, dateKey: data.dateKey }),
      }).catch(() => undefined)
    )
    return
  }

  // Body tap (or any non-med notification): open/focus the relevant page.
  const targetUrl = resolveNotificationTargetUrl(data.url)
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('navigate' in client) {
          return client
            .navigate(targetUrl)
            .then((targetClient) => {
              const focusTarget = targetClient || client
              return 'focus' in focusTarget ? focusTarget.focus() : undefined
            })
            .catch(() => ('focus' in client ? client.focus() : undefined))
        }
        if ('focus' in client) {
          return client.focus()
        }
      }

      if (clients.openWindow) return clients.openWindow(targetUrl)
      return undefined
    })
  )
})
