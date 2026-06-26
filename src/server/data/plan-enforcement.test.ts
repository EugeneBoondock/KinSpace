import assert from 'node:assert/strict'
import test from 'node:test'
import { createGroup } from './groups'
import { toggleSavedResource } from './resources'

function freePlanQueries(extra: Record<string, unknown> = {}) {
  return {
    users: {
      findFirst: async () => ({ id: 'member', role: 'member' }),
    },
    subscriptions: {
      findFirst: async () => null,
    },
    ...extra,
  }
}

test('toggleSavedResource rejects a free member above the saved resource cap', async () => {
  let inserted = false
  const savedRows = Array.from({ length: 20 }, (_, index) => ({
    id: `saved-${index}`,
    userId: 'member',
    resourceId: `resource-${index}`,
  }))

  const db = {
    query: freePlanQueries({
      resources: {
        findFirst: async () => ({ slug: 'new-resource' }),
      },
      savedResources: {
        findFirst: async () => null,
        findMany: async () => savedRows,
      },
    }),
    insert: () => ({
      values: async () => {
        inserted = true
      },
    }),
  }

  await assert.rejects(
    () => toggleSavedResource({ db, userId: 'member' } as never, 'member', 'new-resource'),
    /PLAN_REQUIRED/,
  )
  assert.equal(inserted, false)
})

test('toggleSavedResource still allows removing a saved item over the cap', async () => {
  let deleted = false
  const db = {
    query: freePlanQueries({
      resources: {
        findFirst: async () => ({ slug: 'existing-resource' }),
      },
      savedResources: {
        findFirst: async () => ({ id: 'saved-1', userId: 'member', resourceId: 'existing-resource' }),
        findMany: async () => [],
      },
    }),
    delete: () => ({
      where: async () => {
        deleted = true
      },
    }),
  }

  const result = await toggleSavedResource({ db, userId: 'member' } as never, 'member', 'existing-resource')

  assert.deepEqual(result, { saved: false })
  assert.equal(deleted, true)
})

test('createGroup rejects members without support circle access', async () => {
  let inserted = false
  const db = {
    query: freePlanQueries(),
    insert: () => ({
      values: async () => {
        inserted = true
      },
    }),
  }

  await assert.rejects(
    () =>
      createGroup({ db, userId: 'member' } as never, 'member', {
        name: 'Circle',
        description: 'A private circle',
        category: 'support',
      }),
    /PLAN_REQUIRED/,
  )
  assert.equal(inserted, false)
})
