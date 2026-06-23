import assert from 'node:assert/strict'
import test from 'node:test'
import { formatReactionActorSummary, getReactionActorList } from './social'

test('getReactionActorList returns trimmed unique reactor names for a visible list', () => {
  assert.deepEqual(getReactionActorList([' Amina ', 'Thabo', 'Amina', '']), ['Amina', 'Thabo'])
})

test('formatReactionActorSummary uses a compact count label instead of joining names', () => {
  assert.equal(formatReactionActorSummary(['Amina']), '1 person reacted')
  assert.equal(formatReactionActorSummary(['Amina', 'Thabo']), '2 people reacted')
  assert.equal(formatReactionActorSummary([]), 'No reactions yet')
})
