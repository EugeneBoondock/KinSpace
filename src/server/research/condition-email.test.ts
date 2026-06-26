import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildConditionArticleEmail,
  matchArticleConditions,
  notifyConditionMembersForArticle,
  profileMatchesConditions,
  type ResearchArticleEmailInput,
} from './condition-email'

const NOW = new Date('2026-06-26T18:00:00Z')

function condition(overrides: Record<string, unknown>) {
  return {
    slug: 'anxiety',
    name: 'Generalised Anxiety',
    aliases: ['GAD', 'Anxiety Disorder'],
    description: null,
    category: 'mental',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function profile(overrides: Record<string, unknown>) {
  return {
    userId: 'member-1',
    username: 'member',
    fullName: null,
    pseudonym: null,
    isAnonymous: false,
    avatarUrl: null,
    coverImageUrl: null,
    bio: null,
    pronouns: null,
    age: null,
    location: null,
    timezone: null,
    conditions: ['Anxiety'],
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
    notifyResearch: true,
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

const article: ResearchArticleEmailInput = {
  slug: 'ai-anxiety-study',
  title: 'New anxiety study looks at sleep and symptom flares',
  excerpt: 'Researchers studied anxiety symptoms over time.',
  topic: 'Anxiety Research',
  tags: ['anxiety', 'sleep'],
  plainLanguageSummary: 'A new study looked at anxiety symptoms and sleep.',
}

test('matchArticleConditions finds catalog conditions from article topic and tags', () => {
  const matches = matchArticleConditions(article, [
    condition({ slug: 'hiv', name: 'HIV', aliases: ['Human immunodeficiency virus'] }),
    condition({}),
  ] as never)

  assert.deepEqual(matches.map((match) => match.name), ['Generalised Anxiety'])
})

test('profileMatchesConditions matches listed conditions and comorbidities', () => {
  const matches = matchArticleConditions(article, [condition({})] as never)

  assert.deepEqual(profileMatchesConditions(profile({ conditions: [] }) as never, matches), [])
  assert.deepEqual(
    profileMatchesConditions(profile({ conditions: [], comorbidities: ['Anxiety Disorder'] }) as never, matches).map(
      (match) => match.name,
    ),
    ['Generalised Anxiety'],
  )
})

test('profileMatchesConditions matches longer profile phrases that contain the catalog condition', () => {
  const longCovidArticle: ResearchArticleEmailInput = {
    slug: 'ai-long-covid-energy',
    title: 'Long COVID study looks at energy limits after exertion',
    excerpt: 'Researchers studied long COVID symptoms.',
    topic: 'Long COVID',
    tags: ['long covid', 'fatigue'],
    plainLanguageSummary: 'A new study looked at energy limits after long COVID.',
  }
  const matches = matchArticleConditions(longCovidArticle, [
    condition({ slug: 'long-covid', name: 'Long COVID', aliases: ['Post COVID condition'] }),
  ] as never)

  assert.deepEqual(
    profileMatchesConditions(profile({ conditions: ['Long COVID and ME/CFS'] }) as never, matches).map(
      (match) => match.name,
    ),
    ['Long COVID'],
  )
})

test('buildConditionArticleEmail keeps the subject privacy-safe', () => {
  const email = buildConditionArticleEmail(article, 'Generalised Anxiety')

  assert.equal(email.subject, 'New KinSpace article for your health shelf')
  assert.equal(email.subject.includes('Anxiety'), false)
  assert.match(email.html, /Access is part of the story/)
  assert.match(email.html, /mobility/)
  assert.match(email.text, /sensory load/)
  assert.match(email.text, /not medical advice/i)
})

test('notifyConditionMembersForArticle emails active verified matching members who opted in', async () => {
  const sent: Array<{ to: string; subject: string }> = []
  const db = {
    query: {
      conditions: {
        findMany: async () => [condition({})],
      },
      profiles: {
        findMany: async () => [
          profile({ userId: 'match-verified', conditions: ['Anxiety'], notifyResearch: true }),
          profile({ userId: 'match-optout', conditions: ['Anxiety'], notifyResearch: false }),
          profile({ userId: 'match-unverified', conditions: ['Anxiety'], notifyResearch: true }),
          profile({ userId: 'other-condition', conditions: ['HIV'], notifyResearch: true }),
        ],
      },
      users: {
        findMany: async () => [
          { id: 'match-verified', email: 'verified@example.com', emailVerified: true, status: 'active' },
          { id: 'match-optout', email: 'optout@example.com', emailVerified: true, status: 'active' },
          { id: 'match-unverified', email: 'unverified@example.com', emailVerified: false, status: 'active' },
          { id: 'other-condition', email: 'other@example.com', emailVerified: true, status: 'active' },
        ],
      },
    },
  }

  const result = await notifyConditionMembersForArticle(db as never, article, async (payload) => {
    sent.push({ to: payload.to, subject: payload.subject })
    return { ok: true }
  })

  assert.deepEqual(result, {
    matchedConditions: ['Generalised Anxiety'],
    attempted: 1,
    sent: 1,
    failed: 0,
  })
  assert.deepEqual(sent, [{ to: 'verified@example.com', subject: 'New KinSpace article for your health shelf' }])
})
