const CACHE_NAME = 'kinspace-v5'
const OFFLINE_URL = '/offline'

const PRECACHE_URLS = [
  '/',
  '/offline',
  '/images/gather_logo.png',
  '/images/gather_logo1.png',
  '/manifest.json',
]

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
    // Re-alert even if a notification with this tag already exists.
    renotify: true,
    // Persistent + buzzing: medication reminders are too easy to swipe away,
    // so for those we keep the notification up until the user acts.
    requireInteraction: Boolean(payload.requireInteraction),
    vibrate: [200, 100, 200, 100, 200],
    actions: Array.isArray(payload.actions) ? payload.actions.slice(0, 2) : [],
    data: { url: payload.url || '/notifications', ...(payload.data || {}) },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}

  // Medication reminder action buttons: acknowledge to the server directly, with
  // no app window needed. "Taken" logs the dose; "Snooze 10m" re-arms it via the
  // reminder cron. Same-origin fetch carries the session cookie.
  if ((event.action === 'taken' || event.action === 'snooze') && data.kind === 'med-reminder' && data.reminderId) {
    event.waitUntil(
      fetch('/api/push/ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: event.action, reminderId: data.reminderId, time: data.time }),
      }).catch(() => undefined)
    )
    return
  }

  // Body tap (or any non-med notification): open/focus the relevant page.
  const targetUrl = data.url || '/dashboard'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl).catch(() => undefined)
          return client.focus()
        }
      }

      if (clients.openWindow) return clients.openWindow(targetUrl)
      return undefined
    })
  )
})
