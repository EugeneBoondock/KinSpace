import { strict as assert } from 'node:assert'
import test from 'node:test'

import {
  buildGuideMemoryDocx,
  buildGuideMemoryFromSessions,
  buildGuideMemoryPdf,
  expandGuideMemory,
  formatGuideMemoryPreview,
  formatGuideMemoryMarkdown,
  resetGuideMemorySnapshot,
  type GuideMemorySnapshot,
} from './guide-memory'

test('expands guide memory with a new ended session', () => {
  const merged = expandGuideMemory({
    existingSummary: [
      '## Session notes',
      '',
      '<!-- guide-session:old-session -->',
      '### Session on 2026-06-20',
      'Old entry about pacing.',
      '<!-- /guide-session:old-session -->',
    ].join('\n'),
    sessionId: 'new-session',
    sessionSummary: 'Sam ended by naming that sleep worry was still loud.',
    keyThemes: ['sleep worry', 'pacing'],
    endedAt: new Date('2026-06-27T10:00:00.000Z'),
  })

  assert.match(merged, /guide-session:old-session/)
  assert.match(merged, /Old entry about pacing/)
  assert.match(merged, /guide-session:new-session/)
  assert.match(merged, /Themes: sleep worry, pacing/)
  assert.match(merged, /sleep worry was still loud/)
})

test('rebuilds guide memory from surviving session notes', () => {
  const rebuilt = buildGuideMemoryFromSessions([
    {
      sessionId: 'session-1',
      summary: 'The user talked about pain pacing.',
      keyThemes: ['pain pacing'],
      endedAt: new Date('2026-06-24T12:00:00.000Z'),
    },
    {
      sessionId: 'session-3',
      summary: 'The user closed by naming a next check-in.',
      keyThemes: ['check-in'],
      endedAt: new Date('2026-06-27T12:00:00.000Z'),
    },
  ])

  assert.match(rebuilt, /guide-session:session-1/)
  assert.match(rebuilt, /guide-session:session-3/)
  assert.doesNotMatch(rebuilt, /session-2/)
})

test('formats guide memory downloads as markdown, pdf, and docx', () => {
  const snapshot: GuideMemorySnapshot = {
    personaId: 'mira',
    personaName: 'Mira',
    summary: 'The user is practicing shorter evening plans.',
    latestSessionSummary: 'The last session ended with a plan to rest before dinner.',
    latestSessionId: 'session-2',
    latestSessionEndedAt: new Date('2026-06-27T16:00:00.000Z'),
    keyThemes: ['evening pacing'],
    sessionCount: 2,
    updatedAt: new Date('2026-06-27T16:01:00.000Z'),
  }

  const markdown = formatGuideMemoryMarkdown(snapshot)
  assert.match(markdown, /# Mira Guide memory/)
  assert.match(markdown, /Sessions remembered: 2/)
  assert.match(markdown, /The user is practicing shorter evening plans/)

  const pdf = buildGuideMemoryPdf(markdown)
  assert.match(new TextDecoder().decode(pdf.slice(0, 8)), /^%PDF-1\./)

  const docx = buildGuideMemoryDocx(markdown)
  const decoded = new TextDecoder().decode(docx)
  assert.match(decoded, /word\/document.xml/)
  assert.match(decoded, /\[Content_Types\]\.xml/)
})

test('formats a clean guide memory preview for the app', () => {
  const snapshot: GuideMemorySnapshot = {
    personaId: 'mira',
    personaName: 'Mira',
    summary: [
      '<!-- guide-session:s1 -->',
      '### Session on 2026-06-26',
      'The user named a hard evening rhythm.',
      '<!-- /guide-session:s1 -->',
    ].join('\n'),
    latestSessionSummary: 'The last session ended with a softer plan for dinner.',
    latestSessionId: 's1',
    latestSessionEndedAt: new Date('2026-06-26T18:00:00.000Z'),
    keyThemes: ['evening rhythm'],
    sessionCount: 1,
    updatedAt: new Date('2026-06-27T12:00:00.000Z'),
  }

  const preview = formatGuideMemoryPreview(snapshot)
  assert.equal(preview.hasMemory, true)
  assert.equal(preview.personaName, 'Mira')
  assert.match(preview.summary, /hard evening rhythm/)
  assert.doesNotMatch(preview.summary, /guide-session/)
  assert.equal(preview.latestSessionEndedAt, '2026-06-26T18:00:00.000Z')
})

test('reset guide memory snapshot has no remembered content', () => {
  const preview = formatGuideMemoryPreview(resetGuideMemorySnapshot('mira'))

  assert.equal(preview.personaId, 'mira')
  assert.equal(preview.personaName, 'Mira')
  assert.equal(preview.hasMemory, false)
  assert.equal(preview.summary, '')
  assert.equal(preview.sessionCount, 0)
})
