import assert from 'node:assert/strict'
import test from 'node:test'
import {
  effectiveTierFromSubscription,
  featureUsageStatus,
} from './access'

const NOW = new Date('2026-06-27T10:00:00Z')
const FUTURE = new Date('2026-07-27T10:00:00Z')
const PAST = new Date('2026-06-20T10:00:00Z')

function subscription(overrides: Record<string, unknown>) {
  return {
    tier: 'plus',
    status: 'active',
    trialEndsAt: null,
    currentPeriodEnd: FUTURE,
    ...overrides,
  }
}

test('paid tier requires an active paid or trialing status', () => {
  assert.equal(effectiveTierFromSubscription(subscription({ status: 'none' }), NOW), 'free')
  assert.equal(effectiveTierFromSubscription(subscription({ status: 'past_due' }), NOW), 'free')
  assert.equal(effectiveTierFromSubscription(subscription({ status: 'canceled' }), NOW), 'free')
})

test('active paid tier expires when the billing period is over', () => {
  assert.equal(effectiveTierFromSubscription(subscription({ currentPeriodEnd: FUTURE }), NOW), 'plus')
  assert.equal(effectiveTierFromSubscription(subscription({ currentPeriodEnd: PAST }), NOW), 'free')
})

test('trialing tier requires a future trial end date', () => {
  assert.equal(
    effectiveTierFromSubscription(subscription({ status: 'trialing', trialEndsAt: FUTURE, currentPeriodEnd: null }), NOW),
    'plus',
  )
  assert.equal(
    effectiveTierFromSubscription(subscription({ status: 'trialing', trialEndsAt: PAST, currentPeriodEnd: FUTURE }), NOW),
    'free',
  )
})

test('featureUsageStatus denies unavailable and exhausted plan features', () => {
  assert.deepEqual(featureUsageStatus('free', 'journal', 0), { allowed: false, limit: 0, remaining: 0 })
  assert.deepEqual(featureUsageStatus('free', 'saved_resources', 20), { allowed: false, limit: 20, remaining: 0 })
  assert.deepEqual(featureUsageStatus('free', 'saved_resources', 19), { allowed: true, limit: 20, remaining: 1 })
})
