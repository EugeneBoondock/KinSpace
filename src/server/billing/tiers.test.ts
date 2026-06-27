import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BILLING_PERIODS,
  billingPeriodFromPlanCode,
  billingPeriodEndFrom,
  billingPeriodMonths,
  billingPeriodPlanCode,
  planForTier,
  planPriceCents,
} from './tiers'

test('billing periods cover monthly quarterly and annual choices', () => {
  assert.deepEqual(BILLING_PERIODS.map((period) => period.id), ['monthly', 'quarterly', 'annual'])
  assert.equal(billingPeriodMonths('monthly'), 1)
  assert.equal(billingPeriodMonths('quarterly'), 3)
  assert.equal(billingPeriodMonths('annual'), 12)
})

test('planPriceCents prices paid periods from the monthly plan amount', () => {
  const plus = planForTier('plus')
  const pro = planForTier('pro')

  assert.equal(planPriceCents(plus, 'monthly'), 9900)
  assert.equal(planPriceCents(plus, 'quarterly'), 29700)
  assert.equal(planPriceCents(plus, 'annual'), 118800)
  assert.equal(planPriceCents(pro, 'quarterly'), 74700)
  assert.equal(planPriceCents(pro, 'annual'), 298800)
})

test('billingPeriodFromPlanCode reads PayFast period codes and defaults to monthly', () => {
  assert.equal(billingPeriodPlanCode('quarterly'), 'payfast:quarterly')
  assert.equal(billingPeriodFromPlanCode('payfast:annual'), 'annual')
  assert.equal(billingPeriodFromPlanCode('PAYFAST:QUARTERLY'), 'quarterly')
  assert.equal(billingPeriodFromPlanCode('legacy-paystack-code'), 'monthly')
  assert.equal(billingPeriodFromPlanCode(null), 'monthly')
})

test('billingPeriodEndFrom advances access by the paid period', () => {
  const start = new Date('2026-06-15T12:00:00.000Z')

  assert.equal(billingPeriodEndFrom(start, 'monthly').toISOString(), '2026-07-15T12:00:00.000Z')
  assert.equal(billingPeriodEndFrom(start, 'quarterly').toISOString(), '2026-09-15T12:00:00.000Z')
  assert.equal(billingPeriodEndFrom(start, 'annual').toISOString(), '2027-06-15T12:00:00.000Z')
})
