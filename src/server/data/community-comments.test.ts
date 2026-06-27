import assert from 'node:assert/strict'
import test from 'node:test'
import { addPostComment } from './community'

function makeDb(parentUserId: string) {
  const inserts: Array<Record<string, unknown>> = []
  return {
    inserts,
    db: {
      insert: () => ({
        values: async (payload: Record<string, unknown>) => {
          inserts.push(payload)
        },
      }),
      update: () => ({
        set: () => ({
          where: async () => undefined,
        }),
      }),
      query: {
        postComments: {
          findFirst: async () => ({
            id: 'parent-comment',
            postId: 'post-1',
            userId: parentUserId,
            content: 'Parent comment',
            isAnonymous: false,
          }),
        },
        communityPosts: {
          findFirst: async () => ({
            id: 'post-1',
            userId: 'post-author',
            content: 'Post',
            isAnonymous: false,
            groupId: null,
            isDeleted: false,
          }),
        },
        groupMembers: {
          findMany: async () => [],
        },
        profiles: {
          findMany: async () => [],
          findFirst: async () => null,
        },
        userBlocks: {
          findFirst: async () => null,
        },
      },
    },
  }
}

test('addPostComment notifies the parent commenter when a different member replies', async () => {
  const { db, inserts } = makeDb('parent-user')

  await addPostComment({ db, userId: 'reply-user' } as never, 'post-1', 'reply-user', 'Reply body', false, 'parent-comment')

  const notification = inserts.find((insert) => insert.userId === 'parent-user')
  assert.ok(notification, 'parent commenter should receive a notification')
  assert.equal(notification.type, 'comment_reply')
  assert.equal(notification.title, 'Someone replied to your comment')
  const data = notification.data as Record<string, unknown>
  assert.equal(data.post_id, 'post-1')
  assert.equal(data.comment_id, 'parent-comment')
  assert.equal(typeof data.reply_id, 'string')
})

test('addPostComment does not notify the author for their own reply', async () => {
  const { db, inserts } = makeDb('reply-user')

  await addPostComment({ db, userId: 'reply-user' } as never, 'post-1', 'reply-user', 'Reply body', false, 'parent-comment')

  assert.equal(inserts.some((insert) => insert.type === 'comment_reply'), false)
})
