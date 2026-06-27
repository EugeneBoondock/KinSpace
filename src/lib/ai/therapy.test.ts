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
  accessNeeds: [],
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

test('includes access needs in shared Guide context', () => {
  const request = buildTherapyChatCompletionRequest(
    {
      ...baseContext,
      conditions: ['Fibromyalgia'],
      accessNeeds: ['Rest breaks', 'Low glare'],
    },
    [{ role: 'user', content: 'I need help planning tomorrow.' }],
    { model: 'gpt-5.4' },
  )

  const system = String(request.messages[0]?.content ?? '')
  assert.match(system, /Access and daily-life support they named: Rest breaks, Low glare/)
})

test('does not include access needs when health sharing is off', () => {
  const request = buildTherapyChatCompletionRequest(
    {
      ...baseContext,
      healthShared: false,
      accessNeeds: ['Rest breaks'],
    },
    [{ role: 'user', content: 'Can we talk?' }],
    { model: 'gpt-5.4' },
  )

  const system = String(request.messages[0]?.content ?? '')
  assert.doesNotMatch(system, /Rest breaks/)
  assert.match(system, /chosen to keep their health profile private/)
})

test('includes private Guide memory and the latest handoff', () => {
  const request = buildTherapyChatCompletionRequest(
    {
      ...baseContext,
      personaId: 'mira',
      guideMemory: {
        personaId: 'mira',
        personaName: 'Mira',
        summary: 'Sam has been practicing shorter evening plans.',
        latestSessionSummary: 'The last session ended with Sam choosing to rest before dinner.',
        latestSessionEndedAt: '2026-06-27T16:00:00.000Z',
        sessionCount: 4,
      },
    },
    [{ role: 'user', content: 'Can we pick up from before?' }],
    { model: 'gpt-5.4' },
  )

  const system = String(request.messages[0]?.content ?? '')
  assert.match(system, /Private Guide memory for Mira/)
  assert.match(system, /Sam has been practicing shorter evening plans/)
  assert.match(system, /rest before dinner/)
  assert.match(system, /Sessions remembered: 4/)
})
