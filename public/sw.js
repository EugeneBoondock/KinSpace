const CACHE_NAME = 'kinspace-v4'
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
  // "Snooze" just dismisses for now; the in-app shelf re-surfaces it, and a full
  // server-side snooze re-schedule is wired with the reminder scheduler.
  if (event.action === 'snooze') return

  const data = event.notification.data || {}
  // "Taken" deep-links into the shelf so the dose can be logged in one tap.
  const targetUrl = event.action === 'taken' ? '/dashboard?meds=1' : data.url || '/dashboard'

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
