import assert from 'node:assert/strict'
import test from 'node:test'

import { showLocalNotification } from './notify-client'

test('page-level notification fallback opens the target URL when clicked', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const originalNotification = Object.getOwnPropertyDescriptor(globalThis, 'Notification')
  const created: Array<{ onclick?: () => void }> = []
  let focused = false

  class FakeNotification {
    static permission = 'granted'

    onclick?: () => void

    constructor(_title: string, _options: NotificationOptions) {
      created.push(this)
    }
  }

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      Notification: FakeNotification,
      focus: () => {
        focused = true
      },
      location: { href: '/current' },
    },
  })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} })
  Object.defineProperty(globalThis, 'Notification', { configurable: true, value: FakeNotification })

  try {
    await showLocalNotification('Join request', { data: { url: '/groups/group-123' } })
    assert.equal(created.length, 1)

    created[0]?.onclick?.()

    assert.equal(focused, true)
    assert.equal((globalThis.window as unknown as { location: { href: string } }).location.href, '/groups/group-123')
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else delete (globalThis as { window?: unknown }).window
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
    else delete (globalThis as { navigator?: unknown }).navigator
    if (originalNotification) Object.defineProperty(globalThis, 'Notification', originalNotification)
    else delete (globalThis as { Notification?: unknown }).Notification
  }
})
