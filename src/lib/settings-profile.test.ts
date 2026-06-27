import assert from 'node:assert/strict'
import test from 'node:test'
import { buildBooleanProfilePatch, buildTagAddPatch, buildTagRemovePatch } from './settings-profile'

test('buildTagAddPatch returns the next values and a persisted patch', () => {
  const result = buildTagAddPatch('conditions', ['Migraine'], '  Fibromyalgia  ')

  assert.deepEqual(result, {
    values: ['Migraine', 'Fibromyalgia'],
    patch: { conditions: ['Migraine', 'Fibromyalgia'] },
  })
})

test('buildTagAddPatch ignores empty and duplicate values', () => {
  assert.equal(buildTagAddPatch('conditions', ['Migraine'], '  '), null)
  assert.equal(buildTagAddPatch('conditions', ['Migraine'], 'Migraine'), null)
})

test('buildTagRemovePatch removes by index and returns a persisted patch', () => {
  const result = buildTagRemovePatch('conditions', ['Migraine', 'Fibromyalgia'], 0)

  assert.deepEqual(result, {
    values: ['Fibromyalgia'],
    patch: { conditions: ['Fibromyalgia'] },
  })
})

test('buildTagRemovePatch ignores invalid indexes', () => {
  assert.equal(buildTagRemovePatch('conditions', ['Migraine'], -1), null)
  assert.equal(buildTagRemovePatch('conditions', ['Migraine'], 1), null)
})

test('buildBooleanProfilePatch toggles a boolean profile field', () => {
  assert.deepEqual(buildBooleanProfilePatch('hide_conditions_on_profile', false), {
    value: true,
    patch: { hide_conditions_on_profile: true },
  })
})
