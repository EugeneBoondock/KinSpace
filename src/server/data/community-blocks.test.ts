import assert from 'node:assert/strict'
import test from 'node:test'
import { getConversations, getDirectMessages, getUnreadMessageCount } from './community'

const NOW = new Date('2026-06-26T10:00:00Z')

type MessageRow = {
  id: string
  senderId: string
  receiverId: string | null
  roomId: string | null
  message: string
  readAt: Date | null
  createdAt: Date
}

function profile(userId: string, username: string) {
  return {
    userId,
    username,
    fullName: username,
    pseudonym: null,
    isAnonymous: false,
    avatarUrl: null,
    coverImageUrl: null,
    bio: null,
    pronouns: null,
    onboardingComplete: true,
    followers: 0,
    following: 0,
    postsCount: 0,
    spaceTheme: 'forest',
    spaceAccent: 'sage',
    spaceFont: 'clean',
    spaceMotto: null,
    spaceVibe: null,
    spacePinnedNote: null,
    spaceBackgroundImageUrl: null,
    createdAt: NOW,
  }
}

function makeDb({
  messages,
  blocks = [],
}: {
  messages: MessageRow[]
  blocks?: Array<{ blockerId: string; blockedId: string; createdAt?: Date }>
}) {
  let updateCalled = false
  return {
    get updateCalled() {
      return updateCalled
    },
    db: {
      update: () => {
        updateCalled = true
        return {
          set: () => ({
            where: async () => undefined,
          }),
        }
      },
      query: {
        chatMessages: {
          findMany: async () => messages,
        },
        userBlocks: {
          findMany: async () => blocks,
          findFirst: async () => blocks[0] ?? null,
        },
        profiles: {
          findMany: async () => [profile('friend', 'friend')],
          findFirst: async () => profile('friend', 'friend'),
        },
      },
    },
  }
}

test('getConversations hides blocked direct-message threads', async () => {
  const { db } = makeDb({
    messages: [
      {
        id: 'm1',
        senderId: 'blocked',
        receiverId: 'viewer',
        roomId: 'dm:blocked:viewer',
        message: 'blocked message',
        readAt: null,
        createdAt: NOW,
      },
      {
        id: 'm2',
        senderId: 'friend',
        receiverId: 'viewer',
        roomId: 'dm:friend:viewer',
        message: 'friend message',
        readAt: null,
        createdAt: new Date(NOW.getTime() + 1000),
      },
    ],
    blocks: [{ blockerId: 'viewer', blockedId: 'blocked' }],
  })

  const rows = await getConversations({ db, userId: 'viewer' } as never)

  assert.deepEqual(rows.map((row) => row.partner_id), ['friend'])
  assert.deepEqual(rows.map((row) => row.unread), [1])
})

test('getDirectMessages returns no thread for a blocked pair and does not mark read', async () => {
  const store = makeDb({
    messages: [
      {
        id: 'm1',
        senderId: 'blocked',
        receiverId: 'viewer',
        roomId: 'dm:blocked:viewer',
        message: 'blocked message',
        readAt: null,
        createdAt: NOW,
      },
    ],
    blocks: [{ blockerId: 'blocked', blockedId: 'viewer' }],
  })

  const result = await getDirectMessages({ db: store.db, userId: 'viewer' } as never, 'blocked')

  assert.equal(result.partner, null)
  assert.deepEqual(result.messages, [])
  assert.equal((result as { blocked?: boolean }).blocked, true)
  assert.equal(store.updateCalled, false)
})

test('getUnreadMessageCount ignores unread messages from blocked users', async () => {
  const { db } = makeDb({
    messages: [
      {
        id: 'm1',
        senderId: 'blocked',
        receiverId: 'viewer',
        roomId: 'dm:blocked:viewer',
        message: 'blocked message',
        readAt: null,
        createdAt: NOW,
      },
      {
        id: 'm2',
        senderId: 'friend',
        receiverId: 'viewer',
        roomId: 'dm:friend:viewer',
        message: 'friend message',
        readAt: null,
        createdAt: NOW,
      },
    ],
    blocks: [{ blockerId: 'viewer', blockedId: 'blocked' }],
  })

  assert.equal(await getUnreadMessageCount({ db, userId: 'viewer' } as never), 1)
})
