import { getEnv } from '../env'
import type { Tier } from './tiers'

const BASE = 'https://api.paystack.co'

function secret(): string {
  const key = getEnv().PAYSTACK_SECRET_KEY
  if (!key) throw new Error('PAYSTACK_SECRET_KEY not configured')
  return key
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${secret()}`, 'Content-Type': 'application/json' }
}

export type InitParams = {
  email: string
  amountCents: number
  planCode?: string
  callbackUrl: string
  metadata?: Record<string, unknown>
}

export async function initTransaction(
  params: InitParams,
): Promise<{ authorizationUrl: string; reference: string }> {
  const body: Record<string, unknown> = {
    email: params.email,
    amount: params.amountCents,
    currency: 'ZAR',
    callback_url: params.callbackUrl,
    metadata: params.metadata ?? {},
  }
  if (params.planCode) body.plan = params.planCode

  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as {
    status: boolean
    message: string
    data?: { authorization_url: string; reference: string }
  }
  if (!data.status || !data.data) throw new Error(data.message || 'Paystack initialization failed')
  return { authorizationUrl: data.data.authorization_url, reference: data.data.reference }
}

export async function disableSubscription(code: string, emailToken: string): Promise<boolean> {
  const res = await fetch(`${BASE}/subscription/disable`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ code, token: emailToken }),
  })
  const data = (await res.json()) as { status: boolean }
  return Boolean(data.status)
}

/** Maps a Paystack plan code back to a KinSpace tier using configured env codes. */
export function tierForPlanCode(planCode: string | null | undefined): Tier | null {
  if (!planCode) return null
  const env = getEnv()
  if (planCode === env.PAYSTACK_PLAN_PLUS) return 'plus'
  if (planCode === env.PAYSTACK_PLAN_PRO) return 'pro'
  return null
}

/** Verifies the X-Paystack-Signature (HMAC-SHA512 of the raw body). */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false
  const key = getEnv().PAYSTACK_SECRET_KEY
  if (!key) return false
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(rawBody))
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  if (hex.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i += 1) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i)
  return diff === 0
}

export type PaystackEvent = {
  event: string
  data: {
    metadata?: { userId?: string } & Record<string, unknown>
    customer?: { email?: string; customer_code?: string }
    plan?: { plan_code?: string }
    subscription_code?: string
    email_token?: string
    next_payment_date?: string
    status?: string
  }
}
