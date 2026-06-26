export type CareProgramInput = {
  today: string
  checkinDays: string[]
  medicationDays: string[]
  guideDays: string[]
  communityDays: string[]
  gameDays: string[]
  activeMedicationCount: number
  profileSignalCount: number
  groupsJoined: number
  checkinStreak: number
}

export type CareProgramTrack = {
  id: 'checkin' | 'body' | 'mind' | 'people' | 'play'
  label: string
  title: string
  body: string
  href: string
  icon: string
  progress: number
  state: 'done' | 'next' | 'active'
}

export type CareProgramWeekDay = {
  day: string
  label: string
  active: boolean
  completed_count: number
  markers: Array<'checkin' | 'body' | 'mind' | 'people' | 'play'>
}

export type CareProgramState = {
  stage: 'stabilize' | 'set_up' | 'find_people' | 'reflect' | 'steady'
  stage_label: string
  title: string
  body: string
  readiness_score: number
  featured_action: CareProgramTrack
  tracks: CareProgramTrack[]
  week: CareProgramWeekDay[]
}

const dayMs = 24 * 60 * 60 * 1000

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function uniqueWindowDays(days: string[], window: Set<string>): Set<string> {
  const result = new Set<string>()
  for (const day of days) {
    const key = String(day ?? '').slice(0, 10)
    if (window.has(key)) result.add(key)
  }
  return result
}

function trackState(progress: number): CareProgramTrack['state'] {
  return progress >= 1 ? 'done' : 'active'
}

export function buildCareProgramState(input: CareProgramInput): CareProgramState {
  const today = new Date(`${input.today}T00:00:00Z`)
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getTime() - (6 - index) * dayMs)
    return dayKey(date)
  })
  const weekSet = new Set(weekDays)
  const checkins = uniqueWindowDays(input.checkinDays, weekSet)
  const meds = uniqueWindowDays(input.medicationDays, weekSet)
  const guide = uniqueWindowDays(input.guideDays, weekSet)
  const community = uniqueWindowDays(input.communityDays, weekSet)
  const games = uniqueWindowDays(input.gameDays, weekSet)

  const hasCheckedInToday = checkins.has(input.today)
  const checkinProgress = clamp01(input.checkinStreak / 7)
  const bodyProgress =
    input.activeMedicationCount > 0
      ? clamp01(meds.size / 7)
      : clamp01(input.profileSignalCount / 3)
  const mindProgress = clamp01(guide.size)
  const peopleProgress = input.groupsJoined > 0 ? 1 : clamp01(community.size / 2)
  const playProgress = clamp01(games.size)

  let stage: CareProgramState['stage'] = 'steady'
  if (!hasCheckedInToday) stage = 'stabilize'
  else if (input.profileSignalCount < 3) stage = 'set_up'
  else if (input.groupsJoined === 0 && community.size === 0) stage = 'find_people'
  else if (guide.size === 0) stage = 'reflect'

  const tracks: CareProgramTrack[] = [
    {
      id: 'checkin',
      label: 'Daily pulse',
      title: 'Keep a health signal',
      body: 'Check in so the week has a clear read on how you are doing.',
      href: '/dashboard#daily-check-in',
      icon: 'ri-heart-pulse-line',
      progress: Math.round(checkinProgress * 100) / 100,
      state: trackState(checkinProgress),
    },
    {
      id: 'body',
      label: 'Body care',
      title: input.activeMedicationCount > 0 ? 'Protect your treatment rhythm' : 'Set your care signals',
      body: input.activeMedicationCount > 0
        ? 'Mark doses and keep your medication rhythm visible.'
        : 'Add conditions, treatments, or goals so KinSpace can guide better.',
      href: input.activeMedicationCount > 0 ? '/calendar' : '/settings',
      icon: input.activeMedicationCount > 0 ? 'ri-capsule-line' : 'ri-user-settings-line',
      progress: Math.round(bodyProgress * 100) / 100,
      state: trackState(bodyProgress),
    },
    {
      id: 'mind',
      label: 'Guide work',
      title: 'Make space to reflect',
      body: 'Talk to your Guide for a few minutes and carry the week forward.',
      href: '/therapy',
      icon: 'ri-mental-health-line',
      progress: mindProgress,
      state: trackState(mindProgress),
    },
    {
      id: 'people',
      label: 'Circle',
      title: 'Build your circle',
      body: 'Find people who share enough context for the first message to feel easier.',
      href: '/people-like-you',
      icon: 'ri-team-line',
      progress: Math.round(peopleProgress * 100) / 100,
      state: trackState(peopleProgress),
    },
    {
      id: 'play',
      label: 'Reset',
      title: 'Take a short reset',
      body: 'Use a quick game when you need to stay without talking about health.',
      href: '/games',
      icon: 'ri-gamepad-line',
      progress: playProgress,
      state: trackState(playProgress),
    },
  ]

  const priorityOrder: CareProgramTrack['id'][] =
    stage === 'stabilize'
      ? ['checkin', 'body', 'mind', 'people', 'play']
      : stage === 'set_up'
        ? ['body', 'checkin', 'people', 'mind', 'play']
        : stage === 'find_people'
          ? ['people', 'mind', 'checkin', 'body', 'play']
          : stage === 'reflect'
            ? ['mind', 'checkin', 'people', 'body', 'play']
            : ['checkin', 'mind', 'people', 'body', 'play']
  const featured = priorityOrder
    .map((id) => tracks.find((track) => track.id === id))
    .find((track): track is CareProgramTrack => Boolean(track && track.progress < 1)) ?? tracks[0]
  featured.state = 'next'

  const readinessScore = Math.round(
    ((checkinProgress + bodyProgress + mindProgress + peopleProgress + playProgress) / 5) * 100,
  )

  const stageCopy: Record<CareProgramState['stage'], { label: string; title: string; body: string }> = {
    stabilize: {
      label: 'Stabilize',
      title: 'Start with one signal today',
      body: 'The program starts by getting today into view, then it points you to the next helpful step.',
    },
    set_up: {
      label: 'Set up',
      title: 'Make KinSpace fit you better',
      body: 'A few profile signals unlock stronger matches, smarter prompts, and better weekly guidance.',
    },
    find_people: {
      label: 'Find people',
      title: 'Turn care into connection',
      body: 'You have useful habits forming. Now build the circle that makes coming back feel human.',
    },
    reflect: {
      label: 'Reflect',
      title: 'Add one guided conversation',
      body: 'Your weekly pattern gets stronger when a Guide session captures what the numbers miss.',
    },
    steady: {
      label: 'Steady',
      title: 'Keep the week alive',
      body: 'Your care week has motion. Keep choosing the next small action that fits your energy.',
    },
  }

  return {
    stage,
    stage_label: stageCopy[stage].label,
    title: stageCopy[stage].title,
    body: stageCopy[stage].body,
    readiness_score: readinessScore,
    featured_action: featured,
    tracks,
    week: weekDays.map((day) => {
      const markers: CareProgramWeekDay['markers'] = []
      if (checkins.has(day)) markers.push('checkin')
      if (meds.has(day)) markers.push('body')
      if (guide.has(day)) markers.push('mind')
      if (community.has(day)) markers.push('people')
      if (games.has(day)) markers.push('play')
      return {
        day,
        label: new Date(`${day}T00:00:00Z`).toLocaleDateString('en', { weekday: 'short' }),
        active: day === input.today,
        completed_count: markers.length,
        markers,
      }
    }),
  }
}
