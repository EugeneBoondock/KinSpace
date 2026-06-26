import { strict as assert } from 'node:assert'
import test from 'node:test'

import {
  buildCrisisAskAnswer,
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

test('builds a deterministic Ask crisis answer for active risk', () => {
  const answer = buildCrisisAskAnswer('I want to die and I do not feel safe tonight')

  assert.ok(answer)
  assert.match(answer.answer_markdown, /0800 567 567/)
  assert.match(answer.answer_markdown, /0800 12 13 14/)
  assert.match(answer.answer_markdown, /10111/)
  assert.match(answer.plain_language_summary, /real person/)
  assert.deepEqual(answer.sources, [])
  assert.deepEqual(answer.reddit_threads, [])
  assert.doesNotMatch(answer.answer_markdown, /\[[0-9]+\]/)
})

test('builds a deterministic Ask crisis answer for passive risk', () => {
  const answer = buildCrisisAskAnswer('everyone would be better off without me')

  assert.ok(answer)
  assert.match(answer.answer_markdown, /not be alone/)
  assert.match(answer.answer_markdown, /findahelpline/)
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
