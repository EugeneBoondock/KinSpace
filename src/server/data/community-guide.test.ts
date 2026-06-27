import assert from 'node:assert/strict'
import test from 'node:test'

import { requestGuidePostComment } from './community'

const NOW = new Date('2026-06-27T10:00:00Z')

function makeDb() {
  const inserts: Array<Record<string, unknown>> = []

  return {
    inserts,
    db: {
      insert: () => ({
        values: async (payload: Record<string, unknown>) => {
          inserts.push(payload)
        },
      }),
      query: {
        communityPosts: {
          findFirst: async () => ({
            id: 'post-1',
            userId: 'author',
            content: 'I could use a grounded reply.',
            type: 'discussion',
            groupId: null,
            tags: [],
            media: [],
            likesCount: 0,
            reactionCounts: {},
            commentsCount: 1,
            rekindleCount: 0,
            isAnonymous: false,
            isDeleted: false,
            createdAt: NOW,
            updatedAt: NOW,
          }),
        },
        groupMembers: {
          findMany: async () => [],
        },
        userBlocks: {
          findFirst: async () => null,
        },
        postComments: {
          findMany: async () => [
            {
              id: 'comment-1',
              postId: 'post-1',
              parentId: null,
              userId: 'guide-mira',
              content: 'A public Guide reply already exists.',
              isAnonymous: false,
              isDeleted: false,
              createdAt: NOW,
            },
          ],
        },
        groups: {
          findFirst: async () => null,
        },
      },
    },
  }
}

test('requestGuidePostComment rejects a repeat Guide reply before AI is called', async () => {
  const previousApiKey = process.env.OPENAI_API_KEY
  delete process.env.OPENAI_API_KEY

  const { db, inserts } = makeDb()
  try {
    await assert.rejects(
      () => requestGuidePostComment({ db, userId: 'viewer' } as never, 'post-1', 'mira'),
      /already replied/,
    )
    assert.equal(inserts.length, 0)
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.OPENAI_API_KEY
    } else {
      process.env.OPENAI_API_KEY = previousApiKey
    }
  }
})
