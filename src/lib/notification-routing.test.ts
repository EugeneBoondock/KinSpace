import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSystemNotificationData, notificationAction } from './notification-routing'

test('group join requests route admins to the group review page', () => {
  const action = notificationAction({
    type: 'group_join_request',
    data: { group_id: 'group-123', requester_id: 'user-456' },
  })

  assert.deepEqual(action, { label: 'Review request', href: '/groups/group-123' })
})

test('system notification data keeps the group route and requester details', () => {
  const data = buildSystemNotificationData({
    type: 'group_join_request',
    data: { group_id: 'group-123', requester_id: 'user-456' },
  })

  assert.equal(data.url, '/groups/group-123')
  assert.equal(data.group_id, 'group-123')
  assert.equal(data.requester_id, 'user-456')
  assert.equal(data.type, 'group_join_request')
})

test('unknown notifications still open the notifications page', () => {
  const data = buildSystemNotificationData({
    type: 'unknown',
    data: { something: 'else' },
  })

  assert.equal(data.url, '/notifications')
  assert.equal(data.something, 'else')
})
