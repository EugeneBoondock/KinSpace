import assert from 'node:assert/strict'
import test from 'node:test'
import { studyConfidenceLabel } from './health'

test('labels condition study samples by report count', () => {
  assert.equal(studyConfidenceLabel(0), 'Early signal')
  assert.equal(studyConfidenceLabel(4), 'Early signal')
  assert.equal(studyConfidenceLabel(5), 'Growing signal')
  assert.equal(studyConfidenceLabel(19), 'Growing signal')
  assert.equal(studyConfidenceLabel(20), 'Well reported')
})
