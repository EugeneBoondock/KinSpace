import { strict as assert } from 'node:assert'
import test from 'node:test'

import {
  buildAiPrivacyAuditEvent,
  formatAiPrivacyAuditEvent,
  sanitiseAiAuditMeta,
  type AiAuditAction,
} from './ai-audit'

test('sanitiseAiAuditMeta keeps only safe counters and labels', () => {
  const meta = sanitiseAiAuditMeta({
    personaId: 'mira',
    personaName: 'Mira',
    healthShared: true,
    conditionCount: 3,
    medicationCount: 2,
    accessNeedCount: 1,
    priorSessionCount: 4,
    hasGuideMemory: true,
    format: 'pdf',
    surface: 'community',
    postScope: 'public',
    postId: 'post-1',
    commentId: 'comment-1',
    conditions: ['Private condition'],
    medications: ['Private medicine'],
    summary: 'Private summary',
    message: 'Private message',
  })

  assert.deepEqual(meta, {
    personaId: 'mira',
    personaName: 'Mira',
    healthShared: true,
    conditionCount: 3,
    medicationCount: 2,
    accessNeedCount: 1,
    priorSessionCount: 4,
    hasGuideMemory: true,
    format: 'pdf',
    surface: 'community',
    postScope: 'public',
    postId: 'post-1',
    commentId: 'comment-1',
  })
})

test('buildAiPrivacyAuditEvent writes only ai actions with safe metadata', () => {
  const event = buildAiPrivacyAuditEvent({
    actorId: 'user-1',
    action: 'ai.guide.context_read',
    targetId: 'mira',
    meta: {
      personaId: 'mira',
      conditionCount: 2,
      content: 'Do not store this',
    },
  })

  assert.equal(event.actorId, 'user-1')
  assert.equal(event.action, 'ai.guide.context_read')
  assert.equal(event.targetType, 'guide')
  assert.equal(event.targetId, 'mira')
  assert.deepEqual(event.meta, { personaId: 'mira', conditionCount: 2 })
})

test('formatAiPrivacyAuditEvent produces member-facing copy', () => {
  const action: AiAuditAction = 'ai.guide.memory_exported'
  const item = formatAiPrivacyAuditEvent({
    id: 'event-1',
    action,
    targetType: 'guide',
    targetId: 'mira',
    meta: { personaName: 'Mira', format: 'docx' },
    createdAt: new Date('2026-06-27T10:00:00.000Z'),
  })

  assert.equal(item.id, 'event-1')
  assert.equal(item.title, 'Guide memory downloaded')
  assert.match(item.body, /Mira/)
  assert.match(item.body, /DOCX/)
  assert.equal(item.createdAt, '2026-06-27T10:00:00.000Z')
})

test('formatAiPrivacyAuditEvent reports public Guide community replies without private content', () => {
  const action: AiAuditAction = 'ai.guide.public_comment_posted'
  const item = formatAiPrivacyAuditEvent({
    id: 'event-2',
    action,
    targetType: 'guide',
    targetId: 'mira',
    meta: {
      personaName: 'Mira',
      surface: 'community',
      postScope: 'group',
      postId: 'post-1',
      commentId: 'comment-1',
      content: 'private post text',
      medications: 'private meds',
    },
    createdAt: new Date('2026-06-27T10:00:00.000Z'),
  })

  assert.equal(item.id, 'event-2')
  assert.equal(item.title, 'Public Guide reply posted')
  assert.match(item.body, /Mira/)
  assert.match(item.body, /community/)
  assert.match(item.body, /group/)
  assert.doesNotMatch(item.body, /private post text/)
  assert.doesNotMatch(item.body, /private meds/)
  assert.deepEqual(item.meta, {
    personaName: 'Mira',
    surface: 'community',
    postScope: 'group',
    postId: 'post-1',
    commentId: 'comment-1',
  })
})
