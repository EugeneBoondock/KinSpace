import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCommunityReplyQueue } from './community'

const NOW = new Date('2026-06-22T12:00:00Z')

function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000)
}

function post(overrides: Record<string, unknown>) {
  return {
    id: 'post',
    userId: 'author',
    content: 'Checking in with the group',
    type: 'discussion',
    tags: [],
    groupId: null,
    commentsCount: 0,
    isDeleted: false,
    createdAt: hoursAgo(6),
    profile: {
      id: 'author',
      userId: 'author',
      username: 'author',
      fullName: 'Author',
      pseudonym: null,
      isAnonymous: false,
      avatarUrl: null,
      conditions: ['Private condition'],
      medications: ['Private medication'],
    },
    ...overrides,
  }
}

test('buildCommunityReplyQueue prioritizes unanswered health matches', () => {
  const results = buildCommunityReplyQueue({
    actorId: 'viewer',
    viewerSignals: {
      conditions: ['Long covid'],
      symptoms: ['Fatigue', 'Brain fog'],
      treatments: ['Pacing'],
      interests: ['sleep'],
    },
    posts: [
      post({
        id: 'generic',
        userId: 'peer-1',
        content: 'New here and hoping to meet people.',
        createdAt: hoursAgo(3),
      }),
      post({
        id: 'matched',
        userId: 'peer-2',
        content: 'Fatigue after pacing has been rough this week.',
        tags: ['Long covid'],
        createdAt: hoursAgo(2),
      }),
      post({
        id: 'answered',
        userId: 'peer-3',
        content: 'Brain fog and pacing notes from yesterday.',
        tags: ['Long covid'],
        commentsCount: 6,
        createdAt: hoursAgo(8),
      }),
    ],
    now: NOW,
    limit: 3,
  })

  assert.equal(results[0].id, 'matched')
  assert.ok(results[0].reasons.includes('No replies yet'))
  assert.ok(results[0].reasons.includes('Matches your health notes'))
  assert.ok(results[0].reasons.includes('Fresh post'))
  assert.equal(results[0].urgency, 'new')
})

test('buildCommunityReplyQueue excludes own posts and closed groups outside membership', () => {
  const results = buildCommunityReplyQueue({
    actorId: 'viewer',
    actorGroupIds: ['joined-group'],
    viewerSignals: { conditions: [], symptoms: [], treatments: [], interests: [] },
    posts: [
      post({ id: 'own', userId: 'viewer' }),
      post({ id: 'outside-group', userId: 'peer-1', groupId: 'other-group' }),
      post({ id: 'joined-group-post', userId: 'peer-2', groupId: 'joined-group' }),
      post({ id: 'public-post', userId: 'peer-3', groupId: null, createdAt: hoursAgo(5) }),
    ],
    now: NOW,
    limit: 5,
  })

  assert.deepEqual(results.map((item) => item.id), ['joined-group-post', 'public-post'])
})

test('buildCommunityReplyQueue returns only browser-safe author fields', () => {
  const [item] = buildCommunityReplyQueue({
    actorId: 'viewer',
    viewerSignals: { conditions: ['Long covid'], symptoms: [], treatments: [], interests: [] },
    posts: [
      post({
        id: 'safe',
        userId: 'peer-1',
        content: 'Long covid flare today.',
      }),
    ],
    now: NOW,
    limit: 1,
  })

  assert.deepEqual(Object.keys(item.author ?? {}).sort(), [
    'avatarUrl',
    'fullName',
    'id',
    'isAnonymous',
    'pseudonym',
    'userId',
    'username',
  ].sort())
  assert.equal('conditions' in (item.author ?? {}), false)
  assert.equal('medications' in (item.author ?? {}), false)
  assert.equal('viewerSignals' in item, false)
  assert.equal('matchedTerms' in item, false)
})
