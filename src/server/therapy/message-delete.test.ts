import { strict as assert } from 'node:assert'
import test from 'node:test'

import { canDeleteGuideRoomMessage } from './message-delete'

test('allows deleting Guide replies in the user private Guide room', () => {
  const allowed = canDeleteGuideRoomMessage(
    'user-1',
    { roomId: 'guided-support-user-1', sessionId: 'session-1' },
    { id: 'session-1', userId: 'user-1' },
  )

  assert.equal(allowed, true)
})

test('blocks messages outside the user private Guide room', () => {
  const allowed = canDeleteGuideRoomMessage(
    'user-1',
    { roomId: 'guided-support-user-2', sessionId: 'session-1' },
    { id: 'session-1', userId: 'user-1' },
  )

  assert.equal(allowed, false)
})

test('blocks messages linked to another user session', () => {
  const allowed = canDeleteGuideRoomMessage(
    'user-1',
    { roomId: 'guided-support-user-1', sessionId: 'session-2' },
    { id: 'session-2', userId: 'user-2' },
  )

  assert.equal(allowed, false)
})

test('allows cleanup when a private Guide message has no session row', () => {
  const allowed = canDeleteGuideRoomMessage(
    'user-1',
    { roomId: 'guided-support-user-1', sessionId: 'missing-session' },
    null,
  )

  assert.equal(allowed, true)
})
