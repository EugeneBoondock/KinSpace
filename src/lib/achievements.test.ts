import assert from 'node:assert/strict'
import test from 'node:test'
import * as achievements from './achievements'

type DailyQuestBuilder = (input: {
  date: string
  checkinDone: boolean
  communityActions: number
  gamesPlayed: number
  guideSessions: number
  profileSignalCount: number
  points: number
  level: number
  levelTitle: string
  levelFloor: number
  nextLevelPoints: number | null
  checkinStreak: number
}) => {
  date: string
  completed_count: number
  total_count: number
  progress: number
  points_available: number
  points_earned: number
  level_progress: number
  next_action: { id: string; href: string } | null
  tasks: Array<{ id: string; completed: boolean; reward_points: number }>
}

function dailyQuestBuilder(): DailyQuestBuilder {
  const build = (achievements as unknown as Record<string, unknown>).buildDailyQuestState
  assert.equal(typeof build, 'function')
  return build as DailyQuestBuilder
}

test('builds a daily loop from existing member activity', () => {
  const quest = dailyQuestBuilder()({
    date: '2026-06-26',
    checkinDone: true,
    communityActions: 0,
    gamesPlayed: 2,
    guideSessions: 0,
    profileSignalCount: 3,
    points: 64,
    level: 2,
    levelTitle: 'Sprout',
    levelFloor: 50,
    nextLevelPoints: 150,
    checkinStreak: 4,
  })

  assert.equal(quest.date, '2026-06-26')
  assert.equal(quest.completed_count, 3)
  assert.equal(quest.total_count, 5)
  assert.equal(quest.progress, 0.6)
  assert.equal(quest.points_available, 18)
  assert.equal(quest.points_earned, 7)
  assert.equal(quest.level_progress, 0.14)
  assert.equal(quest.next_action?.id, 'community')
  assert.equal(quest.next_action?.href, '/community')
  assert.equal(quest.tasks.find((task) => task.id === 'profile')?.completed, true)
})

test('keeps max-level members full and starts new days with check-in', () => {
  const quest = dailyQuestBuilder()({
    date: '2026-06-26',
    checkinDone: false,
    communityActions: 0,
    gamesPlayed: 0,
    guideSessions: 0,
    profileSignalCount: 0,
    points: 4000,
    level: 8,
    levelTitle: 'Guardian',
    levelFloor: 3200,
    nextLevelPoints: null,
    checkinStreak: 0,
  })

  assert.equal(quest.completed_count, 0)
  assert.equal(quest.progress, 0)
  assert.equal(quest.points_earned, 0)
  assert.equal(quest.level_progress, 1)
  assert.equal(quest.next_action?.id, 'checkin')
  assert.equal(quest.tasks.find((task) => task.id === 'profile')?.completed, false)
})
