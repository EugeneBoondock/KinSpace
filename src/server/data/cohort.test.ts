import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildMatchSignalLanes,
  buildMemberActivitySignals,
  buildSimilarMemberMatches,
  buildSocialStarterLiveness,
} from './cohort'

const viewer = {
  userId: 'viewer',
  onboardingComplete: true,
  visibility: 'community',
  age: 33,
  location: 'Cape Town, Western Cape',
  conditions: ['Anxiety'],
  comorbidities: ['Migraine'],
  interests: ['yoga'],
  mentalHealthGoals: ['sleep'],
}

const candidates = [
  {
    userId: 'match',
    onboardingComplete: true,
    visibility: 'community',
    age: 35,
    location: 'Cape Town',
    conditions: ['Anxiety'],
    comorbidities: ['Migraine'],
    interests: ['Yoga'],
    mentalHealthGoals: ['Sleep'],
  },
  {
    userId: 'hidden-report-match',
    onboardingComplete: true,
    visibility: 'community',
    age: 34,
    location: 'Cape Town',
    conditions: ['Anxiety'],
    comorbidities: ['Migraine'],
    interests: ['Yoga'],
    mentalHealthGoals: ['Sleep'],
  },
  {
    userId: 'private-profile',
    onboardingComplete: true,
    visibility: 'private',
    age: 34,
    location: 'Cape Town',
    conditions: ['Anxiety'],
    comorbidities: ['Migraine'],
    interests: ['Yoga'],
    mentalHealthGoals: ['Sleep'],
  },
  {
    userId: 'wrong-age-band',
    onboardingComplete: true,
    visibility: 'community',
    age: 48,
    location: 'Cape Town',
    conditions: ['Anxiety'],
    comorbidities: ['Migraine'],
    interests: ['Yoga'],
    mentalHealthGoals: ['Sleep'],
  },
]

const reports = [
  {
    userId: 'viewer',
    conditionSlug: 'anxiety',
    symptoms: ['Fatigue', 'Brain fog'],
    treatments: [{ slug: 'cbt', name: 'CBT', effectiveness: 4, side_effects: [] }],
    isSearchVisible: false,
    completionState: 'complete',
  },
  {
    userId: 'match',
    conditionSlug: 'anxiety',
    symptoms: ['Fatigue'],
    treatments: [{ slug: 'cbt', name: 'CBT', effectiveness: 4, side_effects: [] }],
    isSearchVisible: true,
    completionState: 'complete',
  },
  {
    userId: 'hidden-report-match',
    conditionSlug: 'anxiety',
    symptoms: ['Fatigue'],
    treatments: [{ slug: 'cbt', name: 'CBT', effectiveness: 4, side_effects: [] }],
    isSearchVisible: false,
    completionState: 'complete',
  },
  {
    userId: 'wrong-age-band',
    conditionSlug: 'anxiety',
    symptoms: ['Fatigue'],
    treatments: [{ slug: 'cbt', name: 'CBT', effectiveness: 4, side_effects: [] }],
    isSearchVisible: true,
    completionState: 'complete',
  },
]

test('builds similar member matches from visible health data without returning private fields', () => {
  const results = buildSimilarMemberMatches(viewer, candidates, reports, {
    conditionSlug: 'anxiety',
    symptom: 'fatigue',
    treatment: 'cbt',
    ageBand: '30s',
    location: 'Cape Town',
  })

  assert.equal(results.length, 1)
  assert.equal(results[0].userId, 'match')
  assert.equal(Object.hasOwn(results[0], 'age'), false)
  assert.equal(Object.hasOwn(results[0], 'location'), false)
  assert.deepEqual(results[0].shared.conditions, [])
  assert.deepEqual(results[0].shared.comorbidities, [])
  assert.deepEqual(results[0].shared.symptoms, [])
  assert.deepEqual(results[0].shared.treatments, [])
  assert.equal(results[0].starter_prompt, 'You have something in common. Say hello and find out what.')
  assert.equal(results[0].message_prompt_allowed, false)
  assert.ok(results[0].match_reasons.includes('same area'))
})

test('prioritizes shared visible report symptoms and treatments over profile-only overlap', () => {
  const results = buildSimilarMemberMatches(
    viewer,
    [
      {
        userId: 'profile-only',
        onboardingComplete: true,
        visibility: 'community',
        age: 35,
        location: 'Cape Town',
        conditions: ['Anxiety'],
        comorbidities: [],
        interests: [],
        mentalHealthGoals: [],
      },
      {
        userId: 'report-rich',
        onboardingComplete: true,
        visibility: 'community',
        age: 45,
        location: 'Durban',
        conditions: [],
        comorbidities: [],
        interests: [],
        mentalHealthGoals: [],
      },
      {
        userId: 'hidden-report-only',
        onboardingComplete: true,
        visibility: 'community',
        age: 35,
        location: 'Cape Town',
        conditions: [],
        comorbidities: [],
        interests: [],
        mentalHealthGoals: [],
      },
    ],
    [
      {
        userId: 'viewer',
        conditionSlug: 'anxiety',
        symptoms: ['Fatigue'],
        treatments: [{ slug: 'cbt', name: 'CBT', effectiveness: 4, side_effects: [] }],
        isSearchVisible: false,
        completionState: 'complete',
      },
      {
        userId: 'report-rich',
        conditionSlug: 'anxiety',
        symptoms: ['Fatigue'],
        treatments: [{ slug: 'cbt', name: 'CBT', effectiveness: 5, side_effects: [] }],
        isSearchVisible: true,
        completionState: 'complete',
      },
      {
        userId: 'hidden-report-only',
        conditionSlug: 'anxiety',
        symptoms: ['Fatigue'],
        treatments: [{ slug: 'cbt', name: 'CBT', effectiveness: 5, side_effects: [] }],
        isSearchVisible: false,
        completionState: 'complete',
      },
    ],
  )

  assert.equal(results[0].userId, 'report-rich')
  assert.deepEqual(results[0].shared.conditions, [])
  assert.deepEqual(results[0].shared.symptoms, [])
  assert.deepEqual(results[0].shared.treatments, [])
  assert.equal(results[0].starter_prompt, 'You have something in common. Say hello and find out what.')
  assert.ok(results[0].match_reasons.includes('shared symptom'))
  assert.equal(results.some((entry) => entry.userId === 'hidden-report-only'), false)
})

test('builds privacy-safe social liveness counts from live community signals', () => {
  const now = new Date('2026-06-22T12:00:00Z')
  const result = buildSocialStarterLiveness({
    actorId: 'viewer',
    now,
    membersCount: 4,
    supportPresence: [
      { userId: 'support-a', availableUntil: new Date('2026-06-22T12:15:00Z') },
      { userId: 'viewer', availableUntil: new Date('2026-06-22T12:15:00Z') },
      { userId: 'expired', availableUntil: new Date('2026-06-22T11:59:00Z') },
    ],
    supportRequests: [
      { seekerId: 'seeker-a', status: 'open', expiresAt: new Date('2026-06-22T12:10:00Z') },
      { seekerId: 'viewer', status: 'open', expiresAt: new Date('2026-06-22T12:10:00Z') },
      { seekerId: 'seeker-b', status: 'matched', expiresAt: new Date('2026-06-22T12:10:00Z') },
      { seekerId: 'seeker-c', status: 'open', expiresAt: new Date('2026-06-22T11:50:00Z') },
    ],
    posts: [
      { createdAt: new Date('2026-06-22T11:00:00Z') },
      { createdAt: new Date('2026-06-12T11:00:00Z') },
    ],
    activities: [
      { status: 'upcoming', scheduledAt: new Date('2026-06-23T12:00:00Z') },
      { status: 'cancelled', scheduledAt: new Date('2026-06-23T12:00:00Z') },
      { status: 'upcoming', scheduledAt: new Date('2026-06-21T12:00:00Z') },
    ],
  })

  assert.deepEqual(result, {
    close_matches_count: 4,
    available_supporters_count: 1,
    open_lanterns_count: 1,
    recent_posts_count: 1,
    upcoming_activities_count: 1,
  })
})

test('builds match lanes from viewer reports and visible peer reports only', () => {
  const lanes = buildMatchSignalLanes({
    viewerId: 'viewer',
    candidates: [
      ...candidates,
      {
        userId: 'match-two',
        onboardingComplete: true,
        visibility: 'community',
        age: 37,
        location: 'Cape Town',
        conditions: ['Anxiety'],
        comorbidities: [],
        interests: [],
        mentalHealthGoals: [],
      },
    ],
    reports: [
      ...reports,
      {
        userId: 'viewer',
        conditionSlug: 'anxiety',
        symptoms: ['Fatigue'],
        treatments: [{ slug: 'mindfulness', name: 'Mindfulness', effectiveness: 3, side_effects: [] }],
        isSearchVisible: false,
        completionState: 'complete',
      },
      {
        userId: 'match-two',
        conditionSlug: 'anxiety',
        symptoms: ['Fatigue', 'Brain fog'],
        treatments: [{ slug: 'cbt', name: 'CBT', effectiveness: 5, side_effects: [] }],
        isSearchVisible: true,
        completionState: 'complete',
      },
      {
        userId: 'private-profile',
        conditionSlug: 'anxiety',
        symptoms: ['Fatigue'],
        treatments: [{ slug: 'cbt', name: 'CBT', effectiveness: 5, side_effects: [] }],
        isSearchVisible: true,
        completionState: 'complete',
      },
    ],
  })

  assert.deepEqual(
    lanes.slice(0, 2).map((lane) => ({
      kind: lane.kind,
      label: lane.label,
      matchCount: lane.match_count,
    })),
    [
      { kind: 'symptom', label: 'Fatigue', matchCount: 3 },
      { kind: 'treatment', label: 'CBT', matchCount: 3 },
    ],
  )
  assert.equal(lanes.some((lane) => lane.label === 'Mindfulness'), false)
  assert.equal(Object.hasOwn(lanes[0], 'userIds'), false)
  assert.equal(Object.hasOwn(lanes[0], 'reports'), false)
  assert.deepEqual(lanes[0].condition_labels, [])
})

test('uses coarse live activity as a tie-breaker without exposing exact times', () => {
  const now = new Date('2026-06-22T12:00:00Z')
  const activity = buildMemberActivitySignals({
    actorId: 'viewer',
    now,
    supportPresence: [
      { userId: 'active-match', availableUntil: new Date('2026-06-22T12:20:00Z') },
      { userId: 'viewer', availableUntil: new Date('2026-06-22T12:20:00Z') },
      { userId: 'expired-match', availableUntil: new Date('2026-06-22T11:50:00Z') },
    ],
    posts: [
      { userId: 'posted-match', createdAt: new Date('2026-06-21T12:00:00Z') },
      { userId: 'old-match', createdAt: new Date('2026-05-21T12:00:00Z') },
    ],
  })
  const results = buildSimilarMemberMatches(
    viewer,
    [
      {
        userId: 'quiet-match',
        onboardingComplete: true,
        visibility: 'community',
        age: 35,
        location: 'Cape Town',
        conditions: ['Anxiety'],
        comorbidities: [],
        interests: [],
        mentalHealthGoals: [],
      },
      {
        userId: 'active-match',
        onboardingComplete: true,
        visibility: 'community',
        age: 35,
        location: 'Cape Town',
        conditions: ['Anxiety'],
        comorbidities: [],
        interests: [],
        mentalHealthGoals: [],
      },
    ],
    [],
    {},
    activity,
  )

  assert.equal(results[0].userId, 'active-match')
  assert.deepEqual(results[0].activity_labels, ['Available now'])
  assert.equal(results[0].starter_prompt, 'They are around now. A simple hello goes a long way.')
  assert.equal(Object.hasOwn(results[0], 'availableUntil'), false)
  assert.equal(activity.has('viewer'), false)
})
