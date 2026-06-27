'use server'

import { requireUser } from '@/server/auth/current-user'
import {
  billingPeriodFromInput,
  planPriceCents,
  GUIDE_CREDIT_PACKS,
  PLANS,
  guideCreditPack,
  type BillingPeriod,
  type Tier,
} from '@/server/billing/tiers'
import { getSubscriptionBillingHandle, upsertSubscription } from '@/server/billing/repo'
import { disableSubscription } from '@/server/billing/paystack'
import { buildCheckoutUrl, cancelPayfastSubscription, payfastConfigured } from '@/server/billing/payfast'

export type CheckoutResult =
  | { ok: true; authorizationUrl: string }
  | { ok: false; error: string }

export async function startCheckoutAction(tier: Tier, period: BillingPeriod = 'monthly'): Promise<CheckoutResult> {
  if (tier === 'free') return { ok: false, error: 'The Free plan needs no checkout.' }
  const billingPeriod = billingPeriodFromInput(period)
  let user
  try {
    user = await requireUser()
  } catch {
    return { ok: false, error: 'Please sign in first.' }
  }

  const plan = PLANS.find((p) => p.id === tier)
  if (!plan || plan.priceCents <= 0) return { ok: false, error: 'Unknown plan.' }
  const amountCents = planPriceCents(plan, billingPeriod)
  if (!payfastConfigured()) {
    return { ok: false, error: 'Payments are not configured yet. Please try again later.' }
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.kinspace.co.za'
    const authorizationUrl = buildCheckoutUrl({
      userId: user.userId,
      email: user.email,
      tier,
      amountCents,
      itemName: `${plan.name} (${billingPeriod})`,
      appUrl,
      purpose: 'plan',
      billingPeriod,
    })
    return { ok: true, authorizationUrl }
  } catch (error) {
    console.error('Checkout failed:', error)
    return { ok: false, error: 'Could not start checkout. Please try again.' }
  }
}

export async function startGuideCreditsCheckoutAction(packId: string): Promise<CheckoutResult> {
  const pack = guideCreditPack(packId)
  if (!pack) return { ok: false, error: 'Unknown credit pack.' }
  let user
  try {
    user = await requireUser()
  } catch {
    return { ok: false, error: 'Please sign in first.' }
  }

  if (!payfastConfigured()) {
    return { ok: false, error: 'Payments are not ready yet. Please try again later.' }
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.kinspace.co.za'
    const authorizationUrl = buildCheckoutUrl({
      userId: user.userId,
      email: user.email,
      tier: 'free',
      amountCents: pack.priceCents,
      itemName: pack.name,
      appUrl,
      purpose: 'guide_credits',
      packId: pack.id,
      credits: pack.credits,
    })
    return { ok: true, authorizationUrl }
  } catch (error) {
    console.error('Guide credit checkout failed:', error)
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

  const handle = await getSubscriptionBillingHandle(user.userId)
  if (handle.provider === 'payfast' && handle.providerSubscriptionId) {
    const cancelled = await cancelPayfastSubscription(handle.providerSubscriptionId)
    if (!cancelled) return { ok: false, error: 'Could not cancel with PayFast. Please try again.' }
    await upsertSubscription(user.userId, {
      cancelAtPeriodEnd: true,
      providerSubscriptionStatus: 'cancelled',
    })
    return { ok: true }
  }

  if (handle.legacyCode && handle.legacyToken) {
    await disableSubscription(handle.legacyCode, handle.legacyToken).catch(() => false)
  }
  await upsertSubscription(user.userId, { cancelAtPeriodEnd: true })
  return { ok: true }
}

export async function resumeSubscriptionAction(): Promise<ActionResult> {
  let user
  try {
    user = await requireUser()
  } catch {
    return { ok: false, error: 'Please sign in first.' }
  }

  const handle = await getSubscriptionBillingHandle(user.userId)
  if (handle.provider === 'payfast' && handle.providerSubscriptionStatus === 'cancelled') {
    return { ok: false, error: 'This plan was cancelled with PayFast. Choose a plan again to renew.' }
  }
  await upsertSubscription(user.userId, { cancelAtPeriodEnd: false })
  return { ok: true }
}

export async function getGuideCreditPacksAction() {
  return GUIDE_CREDIT_PACKS
}
