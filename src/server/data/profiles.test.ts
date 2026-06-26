import assert from 'node:assert/strict'
import test from 'node:test'
import { getStrandSummary, searchPeople } from './profiles'

const NOW = new Date('2026-06-25T12:00:00Z')

function profile(overrides: Record<string, unknown>) {
  return {
    userId: 'member',
    username: 'member',
    fullName: 'Member Name',
    pseudonym: null,
    isAnonymous: false,
    avatarUrl: '/avatar.png',
    coverImageUrl: null,
    bio: 'Profile bio',
    pronouns: null,
    age: null,
    location: 'Cape Town',
    timezone: null,
    conditions: [],
    comorbidities: [],
    medications: [],
    status: null,
    interests: [],
    mentalHealthGoals: [],
    preferredCommunication: 'chat',
    emergencyContact: null,
    emergencyPhone: null,
    followers: 0,
    following: 0,
    postsCount: 0,
    dailyMood: null,
    moodUpdatedAt: null,
    therapistPersona: null,
    onboardingComplete: true,
    onboardingStatus: null,
    visibility: 'community',
    notifyMatches: true,
    notifyMessages: true,
    notifyGroups: true,
    shareHealthWithGuide: true,
    anonymousProfileVisibility: 'connections',
    hideConditionsOnHome: false,
    hideConditionsOnProfile: false,
    spaceTheme: 'forest',
    spaceAccent: 'sage',
    spaceFont: 'clean',
    spaceMotto: null,
    spaceVibe: null,
    spacePinnedNote: null,
    spaceBackgroundImageUrl: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeCtx(rows: Array<ReturnType<typeof profile>>) {
  return {
    userId: 'viewer',
    db: {
      query: {
        profiles: {
          findMany: async () => rows,
        },
        connectionRequests: {
          findMany: async () => [],
        },
        userBlocks: {
          findMany: async () => [],
        },
      },
    },
  } as never
}

test('searchPeople treats an @ prefix as part of username search', async () => {
  const rows = [
    profile({ userId: 'sapphire', username: 'sapphirespring', onboardingComplete: false }),
    profile({ userId: 'other', username: 'river_walker' }),
  ]

  const results = await searchPeople(makeCtx(rows), '@sapphirespring')

  assert.deepEqual(results.map((row) => row.username), ['sapphirespring'])
})

test('searchPeople treats SQL wildcard characters as literal text', async () => {
  const rows = [
    profile({ userId: 'sapphire', username: 'sapphirespring' }),
    profile({ userId: 'river', username: 'riverwalker' }),
  ]

  assert.deepEqual(await searchPeople(makeCtx(rows), 'sapp%'), [])
  assert.deepEqual(await searchPeople(makeCtx(rows), 'river_'), [])
})

test('searchPeople finds usernames when separators are omitted or mistyped', async () => {
  const rows = [
    profile({ userId: 'baretta', username: 'big_g_baretta' }),
    profile({ userId: 'spring', username: 'sapphire.spring' }),
    profile({ userId: 'river', username: 'river-walker' }),
  ]

  assert.deepEqual(
    (await searchPeople(makeCtx(rows), 'biggbaretta')).map((row) => row.username),
    ['big_g_baretta'],
  )
  assert.deepEqual(
    (await searchPeople(makeCtx(rows), '@sapphire spring')).map((row) => row.username),
    ['sapphire.spring'],
  )
  assert.deepEqual(
    (await searchPeople(makeCtx(rows), 'river walker')).map((row) => row.username),
    ['river-walker'],
  )
})

test('searchPeople ignores punctuation-only handle searches', async () => {
  const rows = [
    profile({ userId: 'sapphire', username: 'sapphirespring' }),
    profile({ userId: 'river', username: 'riverwalker' }),
  ]

  assert.deepEqual(await searchPeople(makeCtx(rows), '___'), [])
  assert.deepEqual(await searchPeople(makeCtx(rows), '@..'), [])
})

test('searchPeople returns anonymous username matches as redacted results', async () => {
  const rows = [
    profile({
      userId: 'sapphire',
      username: 'sapphirespring',
      fullName: 'Private Name',
      isAnonymous: true,
      avatarUrl: '/private.png',
      bio: 'Private bio',
      location: 'Private City',
      onboardingComplete: false,
    }),
  ]

  const [result] = await searchPeople(makeCtx(rows), 'sapphire')

  assert.equal(result.username, 'sapphirespring')
  assert.equal(result.isAnonymous, true)
  assert.equal(result.fullName, null)
  assert.equal(result.avatarUrl, null)
  assert.equal(result.bio, null)
  assert.equal(result.location, null)
})

test('searchPeople does not discover anonymous profiles by private fields', async () => {
  const rows = [
    profile({
      userId: 'sapphire',
      username: 'sapphirespring',
      fullName: 'Hidden Person',
      isAnonymous: true,
      location: 'Secret City',
    }),
  ]

  assert.deepEqual(await searchPeople(makeCtx(rows), 'Secret City'), [])
  assert.deepEqual(await searchPeople(makeCtx(rows), 'Hidden Person'), [])
})

test('getStrandSummary hides blocked strand rows', async () => {
  const sent = [
    {
      id: 'sent-blocked',
      requesterId: 'viewer',
      targetUserId: 'blocked',
      status: 'pending',
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: 'sent-friend',
      requesterId: 'viewer',
      targetUserId: 'friend',
      status: 'accepted',
      createdAt: NOW,
      updatedAt: NOW,
    },
  ]
  const received = [
    {
      id: 'received-blocked',
      requesterId: 'blocked',
      targetUserId: 'viewer',
      status: 'pending',
      createdAt: NOW,
      updatedAt: NOW,
    },
  ]
  const requestResults = [sent, received]
  const ctx = {
    userId: 'viewer',
    db: {
      query: {
        connectionRequests: {
          findMany: async () => requestResults.shift() ?? [],
        },
        userBlocks: {
          findMany: async () => [{ blockerId: 'viewer', blockedId: 'blocked' }],
        },
        profiles: {
          findFirst: async () => null,
        },
      },
    },
  } as never

  const summary = await getStrandSummary(ctx)

  assert.deepEqual(summary.pendingSent.map((row) => row.id), [])
  assert.deepEqual(summary.pendingReceived.map((row) => row.id), [])
  assert.deepEqual(summary.accepted.map((row) => row.id), ['sent-friend'])
})
