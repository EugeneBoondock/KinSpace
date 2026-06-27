import assert from 'node:assert/strict'
import test from 'node:test'
import { ensureConditionCatalogEntries, slugForConditionCatalogName } from './catalog'

function makeCtx(existingConditions: Array<Record<string, unknown>> = []) {
  const inserts: Array<Record<string, unknown>> = []
  return {
    inserts,
    ctx: {
      userId: 'member-1',
      db: {
        query: {
          conditions: {
            findMany: async () => existingConditions,
          },
          researchRequests: {
            findFirst: async () => null,
          },
        },
        insert: () => ({
          values: async (value: Record<string, unknown>) => {
            inserts.push(value)
          },
        }),
      },
    } as never,
  }
}

test('slugForConditionCatalogName creates stable catalog slugs', () => {
  assert.equal(slugForConditionCatalogName('  Long COVID / PEM  '), 'long-covid-pem')
  assert.equal(slugForConditionCatalogName('Ménière’s disease'), 'meniere-s-disease')
})

test('ensureConditionCatalogEntries creates missing conditions and queues research once per label', async () => {
  const { ctx, inserts } = makeCtx()

  const result = await ensureConditionCatalogEntries(ctx, 'member-1', [
    '  Long COVID  ',
    'long covid',
    'Mobility disability',
    '',
  ])

  assert.deepEqual(result.createdConditionSlugs, ['long-covid', 'mobility-disability'])

  const conditionRows = inserts.filter((row) => 'slug' in row)
  assert.equal(conditionRows.length, 2)
  assert.equal(conditionRows[0].slug, 'long-covid')
  assert.equal(conditionRows[0].name, 'Long COVID')
  assert.equal(conditionRows[1].category, 'disability')

  const requestRows = inserts.filter((row) => 'request' in row)
  assert.equal(requestRows.length, 2)
  assert.equal(requestRows[0].userId, 'member-1')
  assert.match(String(requestRows[0].request), /Long COVID/)
  assert.match(String(requestRows[0].request), /disability and access/)
})

test('ensureConditionCatalogEntries respects existing names and aliases', async () => {
  const { ctx, inserts } = makeCtx([
    {
      slug: 'cptsd',
      name: 'Complex trauma',
      aliases: ['Complex PTSD'],
      description: '',
      category: 'mental',
    },
  ])

  const result = await ensureConditionCatalogEntries(ctx, 'member-1', ['Complex PTSD'])

  assert.deepEqual(result.createdConditionSlugs, [])
  assert.equal(inserts.length, 0)
})
