import assert from 'node:assert/strict'
import test from 'node:test'

type PlatformPulseBuilder = (input: {
  unreadNotifications: number
  unreadMessages: number
  pendingStrands: number
  openLanterns: number
  availableSupporters: number
  closeMatches: number
  recentPosts: number
  upcomingActivities: number
  careReadiness: number
  careStageLabel: string
}) => {
  status: string
  headline: string
  priority_actions: Array<{ id: string; href: string; count: number }>
  stats: Array<{ id: string; value: number | string }>
}

async function loadBuilder(): Promise<PlatformPulseBuilder> {
  const mod = await import('./platform-pulse').catch(() => ({}))
  const build = (mod as Record<string, unknown>).buildPlatformPulse
  assert.equal(typeof build, 'function')
  return build as PlatformPulseBuilder
}

test('ranks member attention above passive liveness', async () => {
  const build = await loadBuilder()
  const pulse = build({
    unreadNotifications: 4,
    unreadMessages: 2,
    pendingStrands: 1,
    openLanterns: 3,
    availableSupporters: 5,
    closeMatches: 8,
    recentPosts: 14,
    upcomingActivities: 2,
    careReadiness: 63,
    careStageLabel: 'Find people',
  })

  assert.equal(pulse.status, 'needs_attention')
  assert.equal(pulse.headline, 'Your people are waiting')
  assert.deepEqual(
    pulse.priority_actions.slice(0, 4).map((action) => action.id),
    ['messages', 'strands', 'lanterns', 'notifications'],
  )
  assert.equal(pulse.priority_actions[0].href, '/messages')
  assert.equal(pulse.stats.find((stat) => stat.id === 'care')?.value, 63)
})

test('turns quiet state into a useful start', async () => {
  const build = await loadBuilder()
  const pulse = build({
    unreadNotifications: 0,
    unreadMessages: 0,
    pendingStrands: 0,
    openLanterns: 0,
    availableSupporters: 0,
    closeMatches: 0,
    recentPosts: 0,
    upcomingActivities: 0,
    careReadiness: 12,
    careStageLabel: 'Stabilize',
  })

  assert.equal(pulse.status, 'quiet')
  assert.equal(pulse.priority_actions[0].id, 'care')
  assert.equal(pulse.priority_actions[0].href, '/care')
  assert.equal(pulse.stats.find((stat) => stat.id === 'activity')?.value, 0)
})
