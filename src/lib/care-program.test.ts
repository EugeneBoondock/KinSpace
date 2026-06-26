import assert from 'node:assert/strict'
import test from 'node:test'

type CareProgramBuilder = (input: {
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
}) => {
  stage: string
  readiness_score: number
  featured_action: { id: string; href: string }
  tracks: Array<{ id: string; progress: number; state: string }>
  week: Array<{ day: string; completed_count: number; active: boolean }>
}

async function loadBuilder(): Promise<CareProgramBuilder> {
  const mod = await import('./care-program').catch(() => ({}))
  const build = (mod as Record<string, unknown>).buildCareProgramState
  assert.equal(typeof build, 'function')
  return build as CareProgramBuilder
}

test('starts a new member with check-in as the featured action', async () => {
  const build = await loadBuilder()
  const program = build({
    today: '2026-06-26',
    checkinDays: [],
    medicationDays: [],
    guideDays: [],
    communityDays: [],
    gameDays: [],
    activeMedicationCount: 0,
    profileSignalCount: 0,
    groupsJoined: 0,
    checkinStreak: 0,
  })

  assert.equal(program.stage, 'stabilize')
  assert.equal(program.readiness_score, 0)
  assert.equal(program.featured_action.id, 'checkin')
  assert.equal(program.featured_action.href, '/dashboard#daily-check-in')
  assert.equal(program.week.length, 7)
  assert.equal(program.week[0].day, '2026-06-20')
  assert.equal(program.week[6].active, true)
})

test('prioritizes people when care habits exist but the member has no circle', async () => {
  const build = await loadBuilder()
  const program = build({
    today: '2026-06-26',
    checkinDays: ['2026-06-23', '2026-06-24', '2026-06-25', '2026-06-26'],
    medicationDays: ['2026-06-22', '2026-06-23', '2026-06-24', '2026-06-26'],
    guideDays: ['2026-06-24'],
    communityDays: [],
    gameDays: ['2026-06-26'],
    activeMedicationCount: 1,
    profileSignalCount: 3,
    groupsJoined: 0,
    checkinStreak: 4,
  })

  assert.equal(program.stage, 'find_people')
  assert.equal(program.readiness_score, 63)
  assert.equal(program.featured_action.id, 'people')
  assert.equal(program.tracks.find((track) => track.id === 'mind')?.state, 'done')
  assert.equal(program.week[4].completed_count, 3)
})
