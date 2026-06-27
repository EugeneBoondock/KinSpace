import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addPostComment,
  getCommentsForPosts,
  getCommunityPosts,
  toggleCommentReaction,
  togglePostReaction,
} from './community'
import { getPollsForPosts, votePoll } from './polls'

const NOW = new Date('2026-06-27T10:00:00Z')

type PostRow = {
  id: string
  userId: string
  content: string
  type: string
  groupId: string | null
  tags: string[]
  media: unknown[]
  likesCount: number
  reactionCounts: Record<string, number>
  commentsCount: number
  rekindleCount: number
  isAnonymous: boolean
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
}

type CommentRow = {
  id: string
  postId: string
  parentId: string | null
  userId: string
  content: string
  isAnonymous: boolean
  isDeleted: boolean
  createdAt: Date
}

function post(id: string, groupId: string | null): PostRow {
  return {
    id,
    userId: 'author',
    content: id,
    type: 'discussion',
    groupId,
    tags: [],
    media: [],
    likesCount: 0,
    reactionCounts: {},
    commentsCount: 0,
    rekindleCount: 0,
    isAnonymous: false,
    isDeleted: false,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

function profile(userId: string) {
  return {
    userId,
    username: userId,
    fullName: userId,
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
    createdAt: NOW,
  }
}

function makeDb({
  posts,
  memberships = [],
  comments = [],
}: {
  posts: PostRow[]
  memberships?: Array<{ groupId: string; userId: string; status: string; role?: string }>
  comments?: CommentRow[]
}) {
  const inserted: Array<Record<string, unknown>> = []
  const deleted: string[] = []
  const updated: string[] = []
  const pollRows = [{ id: 'poll-1', postId: 'shared-group-post', question: 'Question', allowMultiple: false, expiresAt: null }]
  const optionRows = [{ id: 'option-1', pollId: 'poll-1', label: 'Yes', position: 0, votesCount: 0 }]

  return {
    inserted,
    deleted,
    updated,
    db: {
      insert: () => ({
        values: async (payload: Record<string, unknown>) => {
          inserted.push(payload)
        },
      }),
      delete: () => ({
        where: async () => {
          deleted.push('row')
        },
      }),
      update: () => ({
        set: () => ({
          where: async () => {
            updated.push('row')
          },
        }),
      }),
      query: {
        communityPosts: {
          findMany: async () => posts,
          findFirst: async () => posts[0] ?? null,
        },
        groupMembers: {
          findMany: async () => memberships,
          findFirst: async () => memberships[0] ?? null,
        },
        groups: {
          findMany: async () => [],
          findFirst: async () => null,
        },
        profiles: {
          findMany: async () => [profile('author'), profile('viewer')],
          findFirst: async () => profile('author'),
        },
        postReactions: {
          findMany: async () => [],
          findFirst: async () => null,
        },
        postComments: {
          findMany: async () => comments,
          findFirst: async () => comments[0] ?? null,
        },
        commentReactions: {
          findMany: async () => [],
          findFirst: async () => null,
        },
        userBlocks: {
          findMany: async () => [],
          findFirst: async () => null,
        },
        polls: {
          findMany: async () => pollRows,
          findFirst: async () => pollRows[0] ?? null,
        },
        pollOptions: {
          findMany: async () => optionRows,
          findFirst: async () => optionRows[0] ?? null,
        },
        pollVotes: {
          findMany: async () => [],
        },
      },
    },
  }
}

test('profile post feed shows public posts and shared group posts only', async () => {
  const store = makeDb({
    posts: [post('public-post', null), post('shared-group-post', 'shared-group'), post('hidden-group-post', 'hidden-group')],
    memberships: [{ groupId: 'shared-group', userId: 'viewer', status: 'active' }],
  })

  const rows = await getCommunityPosts({ db: store.db, userId: 'viewer' } as never, 20, { userId: 'author' })

  assert.deepEqual(rows.map((row) => row.id), ['public-post', 'shared-group-post'])
})

test('profile post feed hides group posts from signed-out viewers', async () => {
  const store = makeDb({
    posts: [post('public-post', null), post('hidden-group-post', 'hidden-group')],
  })

  const rows = await getCommunityPosts({ db: store.db, userId: null } as never, 20, { userId: 'author' })

  assert.deepEqual(rows.map((row) => row.id), ['public-post'])
})

test('post reactions reject group posts outside the viewer membership', async () => {
  const store = makeDb({ posts: [post('hidden-group-post', 'hidden-group')] })

  await assert.rejects(
    () => togglePostReaction({ db: store.db, userId: 'viewer' } as never, 'hidden-group-post', 'viewer', '💚'),
    /Not authorized/,
  )
  assert.equal(store.inserted.length, 0)
})

test('comments reject group posts outside the viewer membership', async () => {
  const store = makeDb({ posts: [post('hidden-group-post', 'hidden-group')] })

  await assert.rejects(
    () => addPostComment({ db: store.db, userId: 'viewer' } as never, 'hidden-group-post', 'viewer', 'Reply'),
    /Not authorized/,
  )
  assert.equal(store.inserted.length, 0)
})

test('comment reactions reject comments on hidden group posts', async () => {
  const store = makeDb({
    posts: [post('hidden-group-post', 'hidden-group')],
    comments: [
      {
        id: 'comment-1',
        postId: 'hidden-group-post',
        parentId: null,
        userId: 'author',
        content: 'Hidden comment',
        isAnonymous: false,
        isDeleted: false,
        createdAt: NOW,
      },
    ],
  })

  await assert.rejects(
    () => toggleCommentReaction({ db: store.db, userId: 'viewer' } as never, 'comment-1', '💚'),
    /Not authorized/,
  )
  assert.equal(store.inserted.length, 0)
})

test('comment reads hide hidden group post threads', async () => {
  const store = makeDb({
    posts: [post('hidden-group-post', 'hidden-group')],
    comments: [
      {
        id: 'comment-1',
        postId: 'hidden-group-post',
        parentId: null,
        userId: 'author',
        content: 'Hidden comment',
        isAnonymous: false,
        isDeleted: false,
        createdAt: NOW,
      },
    ],
  })

  const rows = await getCommentsForPosts({ db: store.db, userId: 'viewer' } as never, ['hidden-group-post'], 50)

  assert.equal(rows.size, 0)
})

test('poll reads and votes require access to the poll post', async () => {
  const hidden = post('shared-group-post', 'shared-group')
  const store = makeDb({ posts: [hidden] })

  assert.deepEqual(await getPollsForPosts({ db: store.db, userId: 'viewer' } as never, [hidden.id]), {})
  await assert.rejects(
    () => votePoll({ db: store.db, userId: 'viewer' } as never, 'poll-1', 'option-1'),
    /Not authorized/,
  )
  assert.equal(store.inserted.length, 0)
})
