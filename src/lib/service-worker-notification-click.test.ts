import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import vm from 'node:vm'

function loadServiceWorkerContext() {
  const listeners: Record<string, unknown> = {}
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
    setTimeout,
    clearTimeout,
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
        showNotification: () => Promise.resolve(),
      },
      addEventListener: (type: string, handler: unknown) => {
        listeners[type] = handler
      },
      skipWaiting: () => undefined,
    },
  }
  vm.runInNewContext(readFileSync(resolve('public/sw.js'), 'utf8'), context)
  return context as typeof context & {
    resolveNotificationTargetUrl?: (raw: unknown) => string
  }
}

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
