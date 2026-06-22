import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, tierForPlanCode, type PaystackEvent } from '@/server/billing/paystack'
import { upsertSubscription } from '@/server/billing/repo'
import { getUserByEmail } from '@/server/repos/users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function resolveUserId(event: PaystackEvent): Promise<string | null> {
  const fromMeta = event.data.metadata?.userId
  if (fromMeta) return fromMeta
  const email = event.data.customer?.email
  if (email) {
    const user = await getUserByEmail(email)
    return user?.id ?? null
  }
  return null
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-paystack-signature')

  if (!(await verifyWebhookSignature(rawBody, signature))) {
    return NextResponse.json({ ok: false, error: 'invalid-signature' }, { status: 401 })
  }

  let event: PaystackEvent
  try {
    event = JSON.parse(rawBody) as PaystackEvent
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 })
  }

  const userId = await resolveUserId(event)
  if (!userId) {
    // Acknowledge so Paystack stops retrying, but nothing to apply.
    return NextResponse.json({ ok: true, note: 'no-user' })
  }

  const tier = tierForPlanCode(event.data.plan?.plan_code)
  const periodEnd = event.data.next_payment_date ? new Date(event.data.next_payment_date) : null

  switch (event.event) {
    case 'subscription.create':
    case 'charge.success':
      await upsertSubscription(userId, {
        ...(tier ? { tier } : {}),
        status: 'active',
        paystackCustomerCode: event.data.customer?.customer_code ?? null,
        paystackSubscriptionCode: event.data.subscription_code ?? null,
        paystackEmailToken: event.data.email_token ?? null,
        planCode: event.data.plan?.plan_code ?? null,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      })
      break
    case 'invoice.payment_failed':
      await upsertSubscription(userId, { status: 'past_due' })
      break
    case 'subscription.not_renew':
      await upsertSubscription(userId, { cancelAtPeriodEnd: true })
      break
    case 'subscription.disable':
      await upsertSubscription(userId, { status: 'canceled', cancelAtPeriodEnd: true })
      break
    default:
      break
  }

  return NextResponse.json({ ok: true })
}
