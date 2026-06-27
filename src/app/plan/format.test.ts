import assert from 'node:assert/strict'
import test from 'node:test'
import { formatPlanDateLabel, formatPlanQuotaLabel } from './format'

test('formatPlanDateLabel accepts database date strings without throwing', () => {
  assert.equal(formatPlanDateLabel('2026-07-27T10:00:00.000Z'), '27 Jul 2026')
})

test('formatPlanDateLabel treats missing or invalid dates as not set', () => {
  assert.equal(formatPlanDateLabel(null), 'Not set')
  assert.equal(formatPlanDateLabel(''), 'Not set')
  assert.equal(formatPlanDateLabel('not a date'), 'Not set')
})

test('formatPlanQuotaLabel renders unlimited quotas plainly', () => {
  assert.equal(formatPlanQuotaLabel(Number.MAX_SAFE_INTEGER, Number.POSITIVE_INFINITY), 'Unlimited')
})
