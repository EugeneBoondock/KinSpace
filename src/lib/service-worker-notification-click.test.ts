import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import vm from 'node:vm'

function loadServiceWorkerContext() {
  const listeners: Record<string, unknown> = {}
  const shownNotifications: Array<{ title: string; options: Record<string, unknown> }> = []
  const clients = {
    claim: () => Promise.resolve(),
    matchAll: () => Promise.resolve([]),
    openWindow: () => Promise.resolve(undefined),
  }
  const context = {
    URL,
    console,
    Promise,
    Response,
    setTimeout: (callback: () => void) => {
      callback()
      return 0
    },
    clearTimeout,
    __listeners: listeners,
    __shownNotifications: shownNotifications,
    clients,
    caches: {
      open: () => Promise.resolve({ addAll: () => Promise.resolve(), put: () => Promise.resolve() }),
      keys: () => Promise.resolve([]),
      match: () => Promise.resolve(undefined),
    },
    fetch: () => Promise.resolve({ status: 200, type: 'basic', clone: () => ({}) }),
    self: {
      clients,
      location: { origin: 'https://www.kinspace.co.za' },
      registration: {
        getNotifications: () => Promise.resolve([]),
        showNotification: (title: string, options: Record<string, unknown>) => {
          shownNotifications.push({ title, options })
          return Promise.resolve()
        },
      },
      addEventListener: (type: string, handler: unknown) => {
        listeners[type] = handler
      },
      skipWaiting: () => undefined,
    },
  }
  vm.runInNewContext(readFileSync(resolve('public/sw.js'), 'utf8'), context)
  return context as typeof context & {
    __listeners: Record<string, (event: unknown) => void>
    __shownNotifications: Array<{ title: string; options: Record<string, unknown> }>
    resolveNotificationTargetUrl?: (raw: unknown) => string
  }
}

test('service worker cache name is bumped for the latest notification handler', () => {
  const source = readFileSync(resolve('public/sw.js'), 'utf8')

  assert.match(source, /const CACHE_NAME = 'kinspace-v8'/)
})

test('service worker notification clicks resolve internal paths to absolute URLs', () => {
  const context = loadServiceWorkerContext()

  assert.equal(typeof context.resolveNotificationTargetUrl, 'function')
  assert.equal(
    context.resolveNotificationTargetUrl?.('/groups/group-123'),
    'https://www.kinspace.co.za/groups/group-123',
  )
})

test('service worker notification clicks reject external targets', () => {
  const context = loadServiceWorkerContext()

  assert.equal(
    context.resolveNotificationTargetUrl?.('https://example.com/groups/group-123'),
    'https://www.kinspace.co.za/dashboard',
  )
})

test('service worker renders medication pushes as persistent alarm-style notifications', async () => {
  const context = loadServiceWorkerContext()
  const waitUntil: Promise<unknown>[] = []
  const push = context.__listeners.push
  assert.equal(typeof push, 'function')

  push({
    data: {
      json: () => ({
        title: 'Time for Metformin',
        body: 'Metformin, 500 mg at 08:00. Tap Taken once you have.',
        url: '/dashboard?meds=1',
        tag: 'med-reminder-1-08:00',
        requireInteraction: true,
        renotify: true,
        silent: false,
        vibrate: [700, 250, 700],
        actions: [
          { action: 'taken', title: 'Taken' },
          { action: 'snooze', title: 'Snooze 10m' },
        ],
        data: {
          kind: 'med-reminder',
          reminderId: 'reminder-1',
          time: '08:00',
          dateKey: '2026-06-28',
        },
      }),
    },
    waitUntil: (promise: Promise<unknown>) => waitUntil.push(promise),
  })

  await Promise.all(waitUntil)

  assert.equal(context.__shownNotifications.length, 1)
  const first = context.__shownNotifications[0]
  assert.equal(first.title, 'Time for Metformin')
  assert.equal(first.options.requireInteraction, true)
  assert.equal(first.options.renotify, true)
  assert.equal(first.options.silent, false)
  assert.deepEqual(JSON.parse(JSON.stringify(first.options.vibrate)), [700, 250, 700])
  assert.deepEqual(JSON.parse(JSON.stringify(first.options.actions)), [
    { action: 'taken', title: 'Taken' },
    { action: 'snooze', title: 'Snooze 10m' },
  ])
  assert.deepEqual(JSON.parse(JSON.stringify(first.options.data)), {
    url: '/dashboard?meds=1',
    kind: 'med-reminder',
    reminderId: 'reminder-1',
    time: '08:00',
    dateKey: '2026-06-28',
    alarmKey: 'med-reminder-1-08:00:reminder-1:2026-06-28:08:00',
  })
})
