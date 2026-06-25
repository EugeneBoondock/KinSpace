import assert from 'node:assert/strict'
import test from 'node:test'
import { searchPeople } from './profiles'

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
