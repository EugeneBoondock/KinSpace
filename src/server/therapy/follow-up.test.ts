import assert from 'node:assert/strict'
import test from 'node:test'

import { buildGuideFollowUpMessage } from './follow-up'

test('Guide follow-up copy is persona-led and links to the session', () => {
  const message = buildGuideFollowUpMessage({
    personaId: 'mira',
    sessionId: 'session-1',
    appUrl: 'https://www.kinspace.co.za',
    reason: 'idle',
  })

  assert.match(message.title, /Mira/)
  assert.match(message.body, /saved/)
  assert.equal(message.url, '/therapy?session=session-1&source=guide-follow-up')
  assert.match(message.emailText, /https:\/\/www\.kinspace\.co\.za\/therapy\?session=session-1&source=guide-follow-up/)
  assert.match(message.emailHtml, /https:\/\/www\.kinspace\.co\.za\/therapy\?session=session-1&amp;source=guide-follow-up/)
  assert.match(message.sessionMemory, /Mira/)
})

test('Guide follow-up copy never includes private hints', () => {
  const message = buildGuideFollowUpMessage({
    personaId: 'finn',
    sessionId: 'session-2',
    appUrl: 'https://www.kinspace.co.za',
    reason: 'quiet',
    privateHints: ['Sertraline', 'fibromyalgia'] as never,
  })
  const allCopy = `${message.title}\n${message.body}\n${message.emailText}\n${message.sessionMemory}`

  assert.doesNotMatch(allCopy, /Sertraline/)
  assert.doesNotMatch(allCopy, /fibromyalgia/)
})
