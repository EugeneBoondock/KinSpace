import { strict as assert } from 'node:assert'
import test from 'node:test'

import { crisisMessage, detectCrisis, detectCrisisInMessages, MEDICAL_DISCLAIMER } from './safety'

const OLD_TEXT_ARTIFACTS = new RegExp('\\u2014|\\u2022|\\u00e2')
const OLD_DASH_ARTIFACTS = new RegExp('\\u2014|\\u00e2')

test('detects passive crisis language in the server safety helper', () => {
  assert.equal(detectCrisis('everyone would be better off without me'), true)
  assert.equal(detectCrisisInMessages([{ role: 'user', content: 'I can’t go on' }]), true)
})

test('uses the shared SA-first crisis response without old text artifacts', () => {
  const message = crisisMessage()

  assert.match(message, /0800 567 567/)
  assert.match(message, /0800 12 13 14/)
  assert.match(message, /10111/)
  assert.doesNotMatch(message, OLD_TEXT_ARTIFACTS)
  assert.doesNotMatch(MEDICAL_DISCLAIMER, OLD_DASH_ARTIFACTS)
})
