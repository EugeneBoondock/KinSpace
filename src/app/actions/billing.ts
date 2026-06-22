'use server'

import { requireUser } from '@/server/auth/current-user'
import { PLANS, type Tier } from '@/server/billing/tiers'
import { upsertSubscription, getPaystackHandles } from '@/server/billing/repo'
import { disableSubscription } from '@/server/billing/paystack'
import { buildCheckoutUrl, payfastConfigured } from '@/server/billing/payfast'

export type CheckoutResult =
  | { ok: true; authorizationUrl: string }
  | { ok: false; error: string }

export async function startCheckoutAction(tier: Tier): Promise<CheckoutResult> {
  if (tier === 'free') return { ok: false, error: 'The Free plan needs no checkout.' }
  let user
  try {
    user = await requireUser()
  } catch {
    return { ok: false, error: 'Please sign in first.' }
  }

  const plan = PLANS.find((p) => p.id === tier)
  if (!plan || plan.priceCents <= 0) return { ok: false, error: 'Unknown plan.' }
  if (!payfastConfigured()) {
    return { ok: false, error: 'Payments are not configured yet. Please try again later.' }
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.kinspace.co.za'
    const authorizationUrl = buildCheckoutUrl({
      userId: user.userId,
      email: user.email,
      tier,
      amountCents: plan.priceCents,
      itemName: `${plan.name} (monthly)`,
      appUrl,
    })
    return { ok: true, authorizationUrl }
  } catch (error) {
    console.error('Checkout failed:', error)
    return { ok: false, error: 'Could not start checkout. Please try again.' }
  }
}

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function cancelSubscriptionAction(): Promise<ActionResult> {
  let user
  try {
    user = await requireUser()
  } catch {
    return { ok: false, error: 'Please sign in first.' }
  }

  const { code, token } = await getPaystackHandles(user.userId)
  if (code && token) {
    await disableSubscription(code, token).catch(() => false)
  }
  await upsertSubscription(user.userId, { cancelAtPeriodEnd: true })
  return { ok: true }
}
