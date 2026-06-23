import { eq } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor } from './_shared'
import { moodCheckins } from '@/server/db/schema'
import { getMedicationAdherence } from './wellness'

export type BriefCard = {
  id: string
  tone: 'support' | 'gentle' | 'positive'
  icon: string
  title: string
  body: string
  cta_label: string
  cta_href: string
}

const HEAVY = new Set(['heavy', 'tired', 'stretched'])
const BRIGHT = new Set(['hopeful', 'grounded'])

/**
 * The proactive companion brief: a small set of honest, actionable cards composed
 * from the MEMBER'S OWN data across pillars (mood check-ins + medication adherence),
 * threaded together. Pure rules over existing signals (no AI cost, no new writes).
 * Only the member's own data is read. Returns [] when nothing meaningful fires, so
 * the UI simply hides the brief rather than inventing noise.
 */
export async function getDailyBrief(ctx: Ctx, _userId?: string): Promise<BriefCard[]> {
  const userId = requireActor(ctx)

  // Mood over the last 7 days.
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const moodRows = await ctx.db.query.moodCheckins.findMany({ where: eq(moodCheckins.userId, userId) })
  const recent = moodRows
    .filter((row) => {
      const when = row.createdAt ?? (row.day ? new Date(row.day) : null)
      return when ? when.getTime() >= cutoff : false
    })
    .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0))
    .map((row) => String(row.mood ?? ''))
    .filter(Boolean)

  let heavyStreak = 0
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    if (HEAVY.has(recent[i])) heavyStreak += 1
    else break
  }
  const heavyCount = recent.filter((mood) => HEAVY.has(mood)).length
  const brightCount = recent.filter((mood) => BRIGHT.has(mood)).length
  const moodHeavy = heavyStreak >= 3 || (recent.length >= 4 && heavyCount >= Math.ceil(recent.length * 0.6))
  const moodBright = !moodHeavy && recent.length >= 3 && brightCount >= Math.ceil(recent.length * 0.6)

  // Adherence over the last 7 days (reuses the verified adherence engine).
  const adherence = (await getMedicationAdherence(ctx, userId, 7).catch(() => [])) as Array<{
    medication: string
    adherence_pct: number
    expected_days: number
  }>
  const slipped = adherence.filter((row) => row.expected_days >= 3 && row.adherence_pct < 70)
  const adherenceLow = slipped.length > 0
  const slippedName = slipped[0]?.medication
  const adherenceGood = adherence.length > 0 && adherence.every((row) => row.adherence_pct >= 80)

  const cards: BriefCard[] = []

  // The threaded lead card: mood and adherence read together (the connective magic).
  if (moodHeavy && adherenceLow) {
    cards.push({
      id: 'tough-stretch',
      tone: 'support',
      icon: 'ri-hand-heart-line',
      title: 'A tough few days',
      body: `Your check-ins have leaned heavy and some ${slippedName ? `${slippedName} ` : ''}doses slipped. That is a hard combination, and you do not have to carry it alone.`,
      cta_label: 'Talk it through with the Guide',
      cta_href: '/therapy',
    })
    cards.push({
      id: 'restart-meds',
      tone: 'gentle',
      icon: 'ri-capsule-line',
      title: 'Pick the doses back up',
      body: 'Small steps count. Marking a dose today is a good place to restart, no guilt.',
      cta_label: 'Open your shelf',
      cta_href: '/dashboard?meds=1',
    })
  } else if (moodHeavy) {
    cards.push({
      id: 'mood-heavy',
      tone: 'support',
      icon: 'ri-cloud-line',
      title: 'Heavy stretch lately',
      body: 'Your recent check-ins have leaned heavy. A few minutes with the Guide, or a caring member, can lighten it.',
      cta_label: 'Talk to the Guide',
      cta_href: '/therapy',
    })
  } else if (adherenceLow) {
    cards.push({
      id: 'adherence',
      tone: 'gentle',
      icon: 'ri-capsule-line',
      title: 'Some doses slipped',
      body: `${slippedName ?? 'A medication'} has been missed a few times this week. No guilt, just a nudge to check your shelf.`,
      cta_label: 'Open your shelf',
      cta_href: '/dashboard?meds=1',
    })
  }

  // When it is heavy, offer a low-friction reset alongside the Guide.
  if (moodHeavy) {
    cards.push({
      id: 'breathe',
      tone: 'gentle',
      icon: 'ri-lungs-line',
      title: 'Two minutes to breathe',
      body: 'A few paced breaths can take the edge off a heavy moment. No pressure, just a reset.',
      cta_label: 'Open mindfulness',
      cta_href: '/mindfulness',
    })
  }

  // Reinforce the good weeks too, so the companion is not only there for hard days.
  if (cards.length === 0 && (moodBright || adherenceGood)) {
    const body =
      moodBright && adherenceGood
        ? 'Brighter check-ins and steady meds this week. That consistency is real progress.'
        : moodBright
          ? 'Your check-ins have been brighter this week. Good to see.'
          : 'Steady on your meds this week. That consistency adds up.'
    cards.push({
      id: 'steady',
      tone: 'positive',
      icon: 'ri-seedling-line',
      title: 'You are showing up',
      body,
      cta_label: 'See your patterns',
      cta_href: '/insights',
    })
  }

  return cards.slice(0, 3)
}
