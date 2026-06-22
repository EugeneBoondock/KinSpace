import { strict as assert } from 'node:assert'
import test from 'node:test'

import {
  formatAskContextForPrompt,
  isUsableAskSource,
  type AskContext,
} from './ask'

test('formats Ask context without private profile health fields', () => {
  const output = formatAskContextForPrompt({
    relatedQuestions: [{ id: 'q1', question: 'How do I prepare for therapy?' }],
    conditions: ['migraine'],
    medications: ['sertraline'],
    age: 44,
  } as unknown as AskContext)

  assert.match(output, /How do I prepare for therapy/)
  assert.doesNotMatch(output, /migraine/i)
  assert.doesNotMatch(output, /sertraline/i)
  assert.doesNotMatch(output, /age/i)
})

test('formats server-labeled KinSpace structured sources for Ask', () => {
  const output = formatAskContextForPrompt({
    relatedQuestions: [],
    structuredSources: [
      {
        label: 'Private timeline',
        source: 'KinSpace timeline',
        summary: '2 symptom events and 1 medication event from the signed-in member.',
      },
    ],
  })

  assert.match(output, /Private timeline/)
  assert.match(output, /KinSpace timeline/)
  assert.match(output, /2 symptom events/)
})

test('rejects blocked pages as Ask sources', () => {
  assert.equal(
    isUsableAskSource({
      title: 'Sorry, you have been blocked',
      snippet: 'Access denied',
      excerpt: 'Please verify you are human before continuing.',
    }),
    false,
  )
})

test('accepts normal Ask source pages', () => {
  assert.equal(
    isUsableAskSource({
      title: 'Anxiety self-care guidance',
      snippet: 'Evidence-informed guidance for managing anxiety symptoms.',
      excerpt: 'This page explains symptoms, self-care steps, and when to seek medical support.',
    }),
    true,
  )
})
