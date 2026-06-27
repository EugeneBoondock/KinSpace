import assert from 'node:assert/strict'
import test from 'node:test'

import { refundConsumedUsageInDb, type QuotaResult } from './repo'

function makeDb() {
  const updates: Array<Record<string, unknown>> = []
  const inserts: Array<Record<string, unknown>> = []

  return {
    updates,
    inserts,
    db: {
      update: () => ({
        set: (payload: Record<string, unknown>) => ({
          where: () => ({
            returning: async () => {
              updates.push(payload)
              return [{ count: 0 }]
            },
          }),
        }),
      }),
      insert: () => ({
        values: (payload: Record<string, unknown>) => {
          inserts.push(payload)
          return {
            onConflictDoUpdate: async () => undefined,
          }
        },
      }),
    },
  }
}

test('refundConsumedUsageInDb returns a monthly quota slot', async () => {
  const { db, updates, inserts } = makeDb()
  const usage: QuotaResult = { allowed: true, limit: 4, remaining: 3, tier: 'free', metered: 'quota' }

  await refundConsumedUsageInDb(db as never, 'member-1', 'ai_therapy', usage)

  assert.equal(updates.length, 1)
  assert.equal(inserts.length, 0)
})

test('refundConsumedUsageInDb returns a Guide credit', async () => {
  const { db, updates, inserts } = makeDb()
  const usage: QuotaResult = { allowed: true, limit: 4, remaining: 0, tier: 'free', metered: 'credit' }

  await refundConsumedUsageInDb(db as never, 'member-1', 'ai_therapy', usage)

  assert.equal(updates.length, 0)
  assert.deepEqual(inserts[0], { userId: 'member-1', feature: 'ai_therapy', credits: 1 })
})

test('refundConsumedUsageInDb ignores unmetered or denied quota results', async () => {
  const { db, updates, inserts } = makeDb()

  await refundConsumedUsageInDb(
    db as never,
    'member-1',
    'ai_therapy',
    { allowed: true, limit: Infinity, remaining: Number.MAX_SAFE_INTEGER, tier: 'plus', metered: 'none' },
  )
  await refundConsumedUsageInDb(
    db as never,
    'member-1',
    'ai_therapy',
    { allowed: false, limit: 4, remaining: 0, tier: 'free' },
  )

  assert.equal(updates.length, 0)
  assert.equal(inserts.length, 0)
})
