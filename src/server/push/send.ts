import { buildPushHTTPRequest } from '@pushforge/builder'

// Server-side Web Push sender. Uses @pushforge/builder (zero-dep, Web Crypto)
// so it runs in the Cloudflare Worker runtime. The VAPID private key + contact
// come from Worker secrets.

export type StoredPushSubscription = {
  endpoint: string
  p256dh: string
  auth: string
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
  /** Push service delivery priority hint. Use high for time-sensitive reminders. */
  urgency?: 'very-low' | 'low' | 'normal' | 'high'
  /** Push service time-to-live in seconds. Defaults to the builder's 24h max. */
  ttl?: number
  /** Notification action buttons (e.g. Taken / Snooze). */
  actions?: Array<{ action: string; title: string }>
  /** Persistent until the user acts (key for medication adherence). */
  requireInteraction?: boolean
  /** Keep alerting when replacing an existing notification with the same tag. */
  renotify?: boolean
  /** Hint for devices that support vibration from Web Push notifications. */
  vibrate?: number[]
  /** Request audible OS behavior where the browser allows it. */
  silent?: boolean
  /** Notification event time shown by supporting platforms. */
  timestamp?: number
  /** Arbitrary data echoed back on notificationclick (e.g. reminderId). */
  data?: Record<string, unknown>
}

export type PushSendResult = { ok: boolean; status: number; gone: boolean; endpoint: string }

function getVapid(): { privateJWK: JsonWebKey; subject: string } | null {
  const raw = process.env.VAPID_PRIVATE_JWK
  const subject = process.env.VAPID_SUBJECT || 'mailto:hello@kinspace.co.za'
  if (!raw) return null
  try {
    return { privateJWK: JSON.parse(raw) as JsonWebKey, subject }
  } catch {
    return null
  }
}

function decodeBase64Url(value: unknown): Uint8Array | null {
  if (typeof value !== 'string' || !value) return null
  try {
    const base64 = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`
      .replace(/-/g, '+')
      .replace(/_/g, '/')
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function vapidPublicKeyFromJwk(jwk: Pick<JsonWebKey, 'x' | 'y'> | null | undefined): string | null {
  const x = decodeBase64Url(jwk?.x)
  const y = decodeBase64Url(jwk?.y)
  if (!x || !y || x.length !== 32 || y.length !== 32) return null

  const publicKey = new Uint8Array(65)
  publicKey[0] = 0x04
  publicKey.set(x, 1)
  publicKey.set(y, 33)
  return encodeBase64Url(publicKey)
}

export function getVapidPublicKey(): string | null {
  const vapid = getVapid()
  return vapid ? vapidPublicKeyFromJwk(vapid.privateJWK) : null
}

export function isPushConfigured(): boolean {
  return getVapidPublicKey() !== null
}

/**
 * Sends one encrypted Web Push. Returns a result rather than throwing so callers
 * can prune dead subscriptions (status 404/410 → `gone`).
 */
export async function sendWebPush(
  subscription: StoredPushSubscription,
  payload: PushPayload,
): Promise<PushSendResult> {
  const vapid = getVapid()
  if (!vapid) return { ok: false, status: 0, gone: false, endpoint: subscription.endpoint }
  const ttl = typeof payload.ttl === 'number' && Number.isFinite(payload.ttl) ? payload.ttl : 24 * 60 * 60

  try {
    const { endpoint, headers, body } = await buildPushHTTPRequest({
      privateJWK: vapid.privateJWK,
      subscription: {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      message: {
        // Plain JSON (also guarantees the payload is fully serializable).
        payload: JSON.parse(JSON.stringify(payload)),
        adminContact: vapid.subject,
        options: {
          urgency: payload.urgency ?? 'normal',
          ttl: Math.max(60, Math.min(24 * 60 * 60, Math.floor(ttl))),
        },
      },
    })

    const res = await fetch(endpoint, { method: 'POST', headers, body })
    const gone = res.status === 404 || res.status === 410
    return { ok: res.ok, status: res.status, gone, endpoint: subscription.endpoint }
  } catch {
    return { ok: false, status: 0, gone: false, endpoint: subscription.endpoint }
  }
}

/** Fan-out to several subscriptions; returns the per-endpoint results. */
export async function sendWebPushToAll(
  subscriptions: StoredPushSubscription[],
  payload: PushPayload,
): Promise<PushSendResult[]> {
  return Promise.all(subscriptions.map((sub) => sendWebPush(sub, payload)))
}
