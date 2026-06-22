import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeMoodCheckin } from './moods'

test('normalizes supported mood check-in states', () => {
  assert.equal(normalizeMoodCheckin(' Hopeful '), 'hopeful')
  assert.equal(normalizeMoodCheckin('HEAVY'), 'heavy')
})

test('rejects unsupported mood check-in states', () => {
  assert.throws(() => normalizeMoodCheckin('excited'), /Unsupported mood check-in state/)
  assert.throws(() => normalizeMoodCheckin(null), /Mood check-in must be a string/)
})
