import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BILLING_PERIODS,
  billingPeriodFromPlanCode,
  billingPeriodEndFrom,
  billingPeriodMonths,
  billingPeriodPlanCode,
  planEntitlementsForTier,
  planForTier,
  planPriceCents,
  publicPlanBadgeForTier,
  tierFromInput,
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
  const organisation = planForTier('organisation')

  assert.equal(planPriceCents(plus, 'monthly'), 9900)
  assert.equal(planPriceCents(plus, 'quarterly'), 29700)
  assert.equal(planPriceCents(plus, 'annual'), 118800)
  assert.equal(planPriceCents(pro, 'quarterly'), 74700)
  assert.equal(planPriceCents(pro, 'annual'), 298800)
  assert.equal(planPriceCents(organisation, 'monthly'), 69900)
  assert.equal(planPriceCents(organisation, 'quarterly'), 209700)
  assert.equal(planPriceCents(organisation, 'annual'), 838800)
})

test('organisation plan exposes org-level badge and profile perks', () => {
  const organisation = planForTier('organisation')

  assert.equal(organisation.name, 'KinSpace Organisation')
  assert.equal(organisation.priceCents, 69900)
  assert.equal(publicPlanBadgeForTier('pro')?.label, 'Verified facilitator')
  assert.equal(publicPlanBadgeForTier('organisation')?.label, 'Verified organisation')
  assert.deepEqual(planEntitlementsForTier('organisation').spaceTools, [
    'Branded My Space background',
    'Program and resource showcase',
    'Pinned organisation note',
  ])
})

test('tierFromInput accepts organisation and rejects unknown tiers', () => {
  assert.equal(tierFromInput('organisation'), 'organisation')
  assert.equal(tierFromInput('pro'), 'pro')
  assert.equal(tierFromInput('enterprise'), 'free')
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
