import { NextRequest, NextResponse } from 'next/server'
import { verifyItnSignature, validateItnWithPayfast, itnField, payfastConfigured } from '@/server/billing/payfast'
import { grantGuideCredits, upsertSubscription } from '@/server/billing/repo'
import {
  billingPeriodEndFrom,
  billingPeriodFromInput,
  billingPeriodPlanCode,
  PLANS,
  guideCreditPack,
  planPriceCents,
  type Tier,
} from '@/server/billing/tiers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PayFast ITN (Instant Transaction Notification) handler. PayFast POSTs here
 * server-to-server after a payment. We ALWAYS reply 200 (so PayFast stops
 * retrying) but only activate a subscription when every check passes:
 * signature, merchant id, PayFast's own confirmation, COMPLETE status, and an
 * exact amount match against the plan price (guards against tampering).
 */
export async function POST(request: NextRequest) {
  const raw = await request.text()
  try {
    if (!payfastConfigured()) return new NextResponse('', { status: 200 })
    if (!verifyItnSignature(raw)) return new NextResponse('', { status: 200 })

    const merchantId = itnField(raw, 'merchant_id')
    if (merchantId !== (process.env.PAYFAST_MERCHANT_ID ?? '').trim()) return new NextResponse('', { status: 200 })

    const valid = await validateItnWithPayfast(raw)
    if (!valid) return new NextResponse('', { status: 200 })

    const status = itnField(raw, 'payment_status')
    const userId = itnField(raw, 'custom_str1')
    const tierOrPurpose = itnField(raw, 'custom_str2')
    const tier = tierOrPurpose as Tier
    const packId = itnField(raw, 'custom_str3')
    const billingPeriod = billingPeriodFromInput(packId)
    const creditCount = Number(itnField(raw, 'custom_str4') || '0')
    const grossStr = itnField(raw, 'amount_gross') || itnField(raw, 'amount')
    const grossCents = Math.round(parseFloat(grossStr || '0') * 100)
    const providerReference = itnField(raw, 'pf_payment_id') || itnField(raw, 'm_payment_id')
    const providerSubscriptionId = itnField(raw, 'token') || itnField(raw, 'subscription_id')

    if (status === 'COMPLETE' && userId && tierOrPurpose === 'guide_credits') {
      const pack = guideCreditPack(packId)
      if (pack && grossCents === pack.priceCents && creditCount === pack.credits && providerReference) {
        await grantGuideCredits(userId, {
          credits: pack.credits,
          amountCents: pack.priceCents,
          providerReference,
          provider: 'payfast',
        })
      }
      return new NextResponse('', { status: 200 })
    }

    if (status === 'COMPLETE' && userId && (tier === 'plus' || tier === 'pro')) {
      const plan = PLANS.find((p) => p.id === tier)
      if (plan && grossCents === planPriceCents(plan, billingPeriod)) {
        await upsertSubscription(userId, {
          tier,
          status: 'active',
          paymentProvider: 'payfast',
          providerSubscriptionId: providerSubscriptionId || null,
          providerSubscriptionStatus: providerSubscriptionId ? 'active' : null,
          providerReference,
          planCode: billingPeriodPlanCode(billingPeriod),
          currentPeriodEnd: billingPeriodEndFrom(new Date(), billingPeriod),
          cancelAtPeriodEnd: false,
        })
      }
    }
  } catch {
    // Never surface an error to PayFast. Just do not activate.
  }
  return new NextResponse('', { status: 200 })
}
