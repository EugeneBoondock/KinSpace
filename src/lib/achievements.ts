// Achievements + streaks + levels, KinSpace's gentle, healing-flavored
// engagement layer. Deliberately NOT vanity metrics: every badge rewards a
// caring or self-care behavior (showing up, supporting others, contributing),
// never popularity. Pure logic so it can be unit-tested and reused on client
// or server; the server derives the inputs from existing D1 rows (no new
// write-heavy tables, KV-safe).

export type AchievementStats = {
  checkinStreak: number
  totalCheckins: number
  posts: number
  comments: number
  supportsGiven: number
  connections: number
  contributions: number
  sessions: number
  gamesPlayed: number
}

export type Badge = {
  id: string
  name: string
  description: string
  icon: string
  tier: 'bronze' | 'silver' | 'gold'
  current: number
  goal: number
  earned: boolean
  progress: number
}

export type AchievementSummary = {
  points: number
  level: number
  level_title: string
  level_floor: number
  next_level_points: number | null
  checkin_streak: number
  badges: Badge[]
  earned_count: number
  total_count: number
}

export type DailyQuestInput = {
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
}

export type DailyQuestTask = {
  id: 'checkin' | 'community' | 'play' | 'guide' | 'profile'
  title: string
  description: string
  href: string
  icon: string
  reward_points: number
  current: number
  goal: number
  completed: boolean
}

export type DailyQuestSummary = {
  date: string
  tasks: DailyQuestTask[]
  completed_count: number
  total_count: number
  progress: number
  points_available: number
  points_earned: number
  level: number
  level_title: string
  level_progress: number
  points: number
  next_level_points: number | null
  checkin_streak: number
  next_action: DailyQuestTask | null
}

const LEVEL_TITLES = [
  'Newcomer',
  'Sprout',
  'Kindred',
  'Companion',
  'Lightkeeper',
  'Anchor',
  'Beacon',
  'Guardian',
]

// Cumulative points needed to reach each level (index 0 = level 1).
const LEVEL_THRESHOLDS = [0, 50, 150, 350, 700, 1200, 2000, 3200]

export function pointsFor(stats: AchievementStats): number {
  return (
    stats.totalCheckins * 5 +
    stats.posts * 10 +
    stats.comments * 3 +
    stats.supportsGiven * 2 +
    stats.contributions * 20 +
    stats.sessions * 8 +
    stats.gamesPlayed * 2
  )
}

function levelFromPoints(points: number): { level: number; title: string; floor: number; next: number | null } {
  let level = 1
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i += 1) {
    if (points >= LEVEL_THRESHOLDS[i]) level = i + 1
  }
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)]
  const floor = LEVEL_THRESHOLDS[level - 1]
  const next = level < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[level] : null
  return { level, title, floor, next }
}

function makeBadge(
  id: string,
  name: string,
  description: string,
  icon: string,
  tier: Badge['tier'],
  current: number,
  goal: number): Badge {
  return {
    id,
    name,
    description,
    icon,
    tier,
    current,
    goal,
    earned: current >= goal,
    progress: goal > 0 ? Math.max(0, Math.min(1, current / goal)) : 0,
  }
}

export function computeAchievements(stats: AchievementStats): AchievementSummary {
  const points = pointsFor(stats)
  const { level, title, floor, next } = levelFromPoints(points)

  const badges: Badge[] = [
    makeBadge('first_checkin', 'First Light', 'Logged your first mood check-in', 'ri-sun-line', 'bronze', stats.totalCheckins, 1),
    makeBadge('streak_3', 'Showing Up', 'A 3-day check-in streak', 'ri-footprint-line', 'bronze', stats.checkinStreak, 3),
    makeBadge('streak_7', 'Steady', 'A 7-day check-in streak', 'ri-calendar-check-line', 'silver', stats.checkinStreak, 7),
    makeBadge('streak_30', 'Anchored', 'A 30-day check-in streak', 'ri-anchor-line', 'gold', stats.checkinStreak, 30),
    makeBadge('first_post', 'First Words', 'Shared your first post', 'ri-quill-pen-line', 'bronze', stats.posts, 1),
    makeBadge('supporter_10', 'Open Heart', 'Supported others 10 times', 'ri-hand-heart-line', 'silver', stats.supportsGiven, 10),
    makeBadge('supporter_50', 'Lantern', 'Supported others 50 times', 'ri-lightbulb-flash-line', 'gold', stats.supportsGiven, 50),
    makeBadge('witness_25', 'Witness', 'Left 25 thoughtful comments', 'ri-chat-heart-line', 'silver', stats.comments, 25),
    makeBadge('connector_5', 'Kindred Spirit', 'Made 5 connections', 'ri-links-line', 'silver', stats.connections, 5),
    makeBadge('contributor', 'Truth Teller', 'Contributed your data to a condition', 'ri-survey-line', 'gold', stats.contributions, 1),
    makeBadge('brave', 'Brave', 'Opened up in your first Guide session', 'ri-mental-health-line', 'bronze', stats.sessions, 1),
    makeBadge('playful', 'Playful', 'Played 3 games', 'ri-gamepad-line', 'bronze', stats.gamesPlayed, 3),
  ]

  return {
    points,
    level,
    level_title: title,
    level_floor: floor,
    next_level_points: next,
    checkin_streak: stats.checkinStreak,
    badges,
    earned_count: badges.filter((badge) => badge.earned).length,
    total_count: badges.length,
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function roundRatio(value: number): number {
  return Math.round(clamp01(value) * 100) / 100
}

export function buildDailyQuestState(input: DailyQuestInput): DailyQuestSummary {
  const profileCurrent = Math.max(0, Math.min(3, Math.round(input.profileSignalCount || 0)))
  const tasks: DailyQuestTask[] = [
    {
      id: 'checkin',
      title: 'Check in today',
      description: 'Log how today feels and keep your streak warm.',
      href: '/dashboard#daily-check-in',
      icon: 'ri-heart-pulse-line',
      reward_points: 5,
      current: input.checkinDone ? 1 : 0,
      goal: 1,
      completed: input.checkinDone,
    },
    {
      id: 'community',
      title: 'Care for the room',
      description: 'React, reply, or post something useful.',
      href: '/community',
      icon: 'ri-chat-heart-line',
      reward_points: 3,
      current: Math.max(0, input.communityActions),
      goal: 1,
      completed: input.communityActions > 0,
    },
    {
      id: 'play',
      title: 'Play a short game',
      description: 'Take a two-minute reset with any game.',
      href: '/games',
      icon: 'ri-gamepad-line',
      reward_points: 2,
      current: Math.max(0, input.gamesPlayed),
      goal: 1,
      completed: input.gamesPlayed > 0,
    },
    {
      id: 'guide',
      title: 'Talk to your Guide',
      description: 'Spend a few minutes reflecting with your Guide.',
      href: '/therapy',
      icon: 'ri-mental-health-line',
      reward_points: 8,
      current: Math.max(0, input.guideSessions),
      goal: 1,
      completed: input.guideSessions > 0,
    },
    {
      id: 'profile',
      title: 'Make it yours',
      description: 'Add enough profile signal for better matches.',
      href: '/settings',
      icon: 'ri-user-settings-line',
      reward_points: 0,
      current: profileCurrent,
      goal: 3,
      completed: profileCurrent >= 3,
    },
  ]

  const completed = tasks.filter((task) => task.completed)
  const levelSpan =
    input.nextLevelPoints === null
      ? 0
      : Math.max(1, input.nextLevelPoints - input.levelFloor)
  const rawLevelProgress =
    input.nextLevelPoints === null
      ? 1
      : (input.points - input.levelFloor) / levelSpan

  return {
    date: input.date,
    tasks,
    completed_count: completed.length,
    total_count: tasks.length,
    progress: roundRatio(completed.length / tasks.length),
    points_available: tasks.reduce((total, task) => total + task.reward_points, 0),
    points_earned: completed.reduce((total, task) => total + task.reward_points, 0),
    level: input.level,
    level_title: input.levelTitle,
    level_progress: roundRatio(rawLevelProgress),
    points: input.points,
    next_level_points: input.nextLevelPoints,
    checkin_streak: input.checkinStreak,
    next_action: tasks.find((task) => !task.completed) ?? null,
  }
}

/**
 * Current consecutive-day check-in streak from a set of UTC day strings
 * (YYYY-MM-DD). Counts back from today; a check-in today OR yesterday keeps the
 * streak alive (so a streak isn't "lost" until a full day is missed).
 */
export function computeStreak(days: string[], todayUtc: string): number {
  const set = new Set(days.map((d) => d.slice(0, 10)))
  if (set.size === 0) return 0

  const dayMs = 24 * 60 * 60 * 1000
  const start = new Date(`${todayUtc}T00:00:00Z`).getTime()
  // Allow the streak to anchor on today or yesterday.
  let anchor = start
  if (!set.has(todayUtc)) {
    const yesterday = new Date(start - dayMs).toISOString().slice(0, 10)
    if (set.has(yesterday)) anchor = start - dayMs
    else return 0
  }

  let streak = 0
  let cursor = anchor
  while (set.has(new Date(cursor).toISOString().slice(0, 10))) {
    streak += 1
    cursor -= dayMs
  }
  return streak
}
