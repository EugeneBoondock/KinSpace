import assert from 'node:assert/strict'
import test from 'node:test'

import * as pushData from './push'

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function makeVapidJwk(): string {
  return JSON.stringify({
    kty: 'EC',
    crv: 'P-256',
    x: base64Url(new Uint8Array(32).fill(1)),
    y: base64Url(new Uint8Array(32).fill(2)),
    d: base64Url(new Uint8Array(32).fill(3)),
  })
}

function makeCtx({
  devices = [],
  reminders = [],
  timezone = 'Africa/Johannesburg',
}: {
  devices?: Array<Record<string, unknown>>
  reminders?: Array<Record<string, unknown>>
  timezone?: string | null
} = {}) {
  return {
    userId: 'user-1',
    db: {
      query: {
        pushSubscriptions: {
          findMany: async () => devices,
        },
        medicationReminders: {
          findMany: async () => reminders,
        },
        profiles: {
          findFirst: async () => (timezone ? { timezone } : null),
        },
      },
    },
  }
}

test('medication reminder delivery status proves closed-app readiness', async () => {
  const previous = process.env.VAPID_PRIVATE_JWK
  process.env.VAPID_PRIVATE_JWK = makeVapidJwk()

  try {
    const getStatus = (
      pushData as typeof pushData & {
        getMedicationReminderDeliveryStatus?: (ctx: unknown) => Promise<Record<string, unknown>>
      }
    ).getMedicationReminderDeliveryStatus

    assert.equal(typeof getStatus, 'function')

    const status = await getStatus(makeCtx({
      devices: [{ id: 'device-1' }, { id: 'device-2' }],
      reminders: [
        { id: 'reminder-1', active: true, times: ['08:00'] },
        { id: 'reminder-2', active: false, times: ['09:00'] },
        { id: 'reminder-3', active: true, times: [] },
      ],
    }))

    assert.deepEqual(status, {
      ok: true,
      push_configured: true,
      device_count: 2,
      active_reminder_count: 1,
      timezone: 'Africa/Johannesburg',
      server_wake_ready: true,
      closed_app_ready: true,
      reason: 'ready',
    })
  } finally {
    if (previous === undefined) delete process.env.VAPID_PRIVATE_JWK
    else process.env.VAPID_PRIVATE_JWK = previous
  }
})

test('medication reminder delivery status explains missing linked devices', async () => {
  const previous = process.env.VAPID_PRIVATE_JWK
  process.env.VAPID_PRIVATE_JWK = makeVapidJwk()

  try {
    const getStatus = (
      pushData as typeof pushData & {
        getMedicationReminderDeliveryStatus?: (ctx: unknown) => Promise<Record<string, unknown>>
      }
    ).getMedicationReminderDeliveryStatus

    assert.equal(typeof getStatus, 'function')

    const status = await getStatus(makeCtx({
      devices: [],
      reminders: [{ id: 'reminder-1', active: true, times: ['08:00'] }],
      timezone: null,
    }))

    assert.equal(status.closed_app_ready, false)
    assert.equal(status.server_wake_ready, false)
    assert.equal(status.reason, 'no-device')
    assert.equal(status.timezone, null)
  } finally {
    if (previous === undefined) delete process.env.VAPID_PRIVATE_JWK
    else process.env.VAPID_PRIVATE_JWK = previous
  }
})
