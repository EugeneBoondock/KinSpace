import { NextRequest, NextResponse } from 'next/server'
import { verifyItnSignature, validateItnWithPayfast, itnField, payfastConfigured } from '@/server/billing/payfast'
import { upsertSubscription } from '@/server/billing/repo'
import { PLANS, type Tier } from '@/server/billing/tiers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PERIOD_MS = 31 * 24 * 60 * 60 * 1000

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
    const tier = itnField(raw, 'custom_str2') as Tier
    const grossStr = itnField(raw, 'amount_gross') || itnField(raw, 'amount')

    if (status === 'COMPLETE' && userId && (tier === 'plus' || tier === 'pro')) {
      const plan = PLANS.find((p) => p.id === tier)
      const grossCents = Math.round(parseFloat(grossStr || '0') * 100)
      if (plan && grossCents === plan.priceCents) {
        await upsertSubscription(userId, {
          tier,
          status: 'active',
          planCode: 'payfast',
          currentPeriodEnd: new Date(Date.now() + PERIOD_MS),
          cancelAtPeriodEnd: false,
        })
      }
    }
  } catch {
    // Never surface an error to PayFast — just don't activate.
  }
  return new NextResponse('', { status: 200 })
}
