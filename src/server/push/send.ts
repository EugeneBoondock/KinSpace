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
  /** Notification action buttons (e.g. Taken / Snooze). */
  actions?: Array<{ action: string; title: string }>
  /** Persistent until the user acts (key for medication adherence). */
  requireInteraction?: boolean
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

export function isPushConfigured(): boolean {
  return getVapid() !== null
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
