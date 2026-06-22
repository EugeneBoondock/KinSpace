import { strict as assert } from 'node:assert'
import test from 'node:test'

import {
  buildTherapyChatCompletionRequest,
  type TherapyContext,
} from './therapy'

const baseContext: TherapyContext = {
  userId: 'user-1',
  displayName: 'Sam',
  conditions: [],
  medications: [],
  comorbidities: [],
  goals: [],
  interests: [],
  conditionInsights: [],
}

test('builds GPT-5 therapy chat requests without custom sampling fields', () => {
  const request = buildTherapyChatCompletionRequest(
    baseContext,
    [{ role: 'user', content: 'I feel flat today.' }],
    { model: 'gpt-5.4', maxCompletionTokens: 600 },
  )

  assert.equal(request.model, 'gpt-5.4')
  assert.equal(request.max_completion_tokens, 600)
  assert.equal(Object.hasOwn(request, 'temperature'), false)
  assert.equal(request.messages[0]?.role, 'system')
  assert.equal(request.messages[1]?.role, 'user')
})
