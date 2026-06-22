import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPersonalInsights, findingIsSafe, MOOD_VALENCE, type InsightSignals } from './personal-insights-core'

const DAY_MS = 24 * 60 * 60 * 1000
const TODAY = '2026-06-22'
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))
// Identical to the local verification seed (scripts/seed-personal) so the test
// reasons over the same numbers that live in the dev DB.
const noise = (i: number, salt: number) => ((Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453) % 1)
const moodLabel = (v: number) => (v >= 4.5 ? 'grounded' : v >= 3.5 ? 'hopeful' : v >= 2.5 ? 'tired' : v >= 1.5 ? 'stretched' : 'heavy')
const dayStr = (offsetFromStart: number) =>
  new Date(Date.parse(TODAY + 'T00:00:00Z') - (29 - offsetFromStart) * DAY_MS).toISOString().slice(0, 10)

/** Reconstruct the planted 30-day series: meds-taken → higher mood + lower fatigue;
 *  headache is pure noise (must NOT surface as an association). */
function plantedSignals(): InsightSignals {
  const mood = new Map<string, number>()
  const symptoms = new Map<string, Map<string, number>>()
  const medTaken = new Set<string>()
  const medDue = new Set<string>()
  const therapy = new Set<string>()

  for (let i = 0; i < 30; i++) {
    const day = dayStr(i)
    medDue.add(day) // an active reminder spans the whole window
    const taken = !(i % 7 === 3 || i % 11 === 5 || i % 9 === 8)
    if (taken) medTaken.add(day)

    const moodV = clamp(3.0 + (taken ? 0.9 : -0.7) + noise(i, 1) * 0.5, 1, 5)
    mood.set(day, MOOD_VALENCE[moodLabel(moodV)])

    const fatigue = Math.round(clamp(4.5 + (taken ? -1.6 : 1.8) + noise(i, 2) * 1.2, 0, 10))
    const fog = Math.round(clamp(fatigue - 1 + noise(i, 3) * 1.5, 0, 10))
    const headache = Math.round(clamp(3 + noise(i, 4) * 3, 0, 10))
    symptoms.set(day, new Map([['Fatigue', fatigue], ['Brain fog', fog], ['Headache', headache]]))

    if (i === 4 || i === 12 || i === 21) therapy.add(day)
  }

  return {
    windowDays: 30, today: TODAY, mood, symptoms, medTaken, medDue,
    spoons: new Map(), therapy, crisisNudge: null, generatedAt: '2026-06-22T00:00:00.000Z',
  }
}

test('surfaces the real fatigue↔mood association from the user own logs', () => {
  const result = buildPersonalInsights(plantedSignals())
  const fatigueAssoc = result.cards.find((c) => c.kind === 'mood_symptom_assoc' && c.subject === 'Fatigue')
  assert.ok(fatigueAssoc, 'expected a Fatigue & mood association card')
  assert.equal(fatigueAssoc!.direction, 'together')
  assert.ok(fatigueAssoc!.sampleDays >= 10)
})

test('surfaces the planted medication↔mood association', () => {
  const result = buildPersonalInsights(plantedSignals())
  const med = result.cards.find((c) => c.kind === 'med_mood_assoc')
  assert.ok(med, 'expected a medication & mood card (confirmed-negative days present)')
  assert.ok(med!.careTeamNudge, 'med card must carry the care-team nudge')
  assert.equal(med!.disclaimerKey, 'med')
  assert.ok((med!.perGroupCounts?.a ?? 0) >= 5 && (med!.perGroupCounts?.b ?? 0) >= 5)
})

test('does NOT invent a spurious association for the noise symptom (Headache)', () => {
  const result = buildPersonalInsights(plantedSignals())
  assert.ok(!result.cards.some((c) => c.subject === 'Headache'), 'Headache must not surface as a pattern')
})

test('every surfaced finding passes the safety guard', () => {
  const result = buildPersonalInsights(plantedSignals())
  assert.ok(result.cards.length > 0)
  for (const c of result.cards) assert.ok(findingIsSafe(c.phrase), `unsafe phrase shipped: "${c.phrase}"`)
})

test('reports honest coverage', () => {
  const result = buildPersonalInsights(plantedSignals())
  assert.equal(result.hasEnoughData, true)
  assert.equal(result.coverage.loggedDays, 30)
  assert.ok(result.coverage.currentStreak >= 20)
})

test('stays silent (no cards) under thin data, still returns coverage', () => {
  const thin: InsightSignals = {
    windowDays: 30, today: TODAY,
    mood: new Map([[dayStr(28), 4], [dayStr(29), 3]]),
    symptoms: new Map(), medTaken: new Set(), medDue: new Set(), spoons: new Map(), therapy: new Set(),
    crisisNudge: null, generatedAt: '2026-06-22T00:00:00.000Z',
  }
  const result = buildPersonalInsights(thin)
  assert.equal(result.hasEnoughData, false)
  assert.equal(result.cards.length, 0)
  assert.equal(result.coverage.loggedDays, 2)
})

test('safety guard rejects causal / prescriptive / statistical language', () => {
  assert.equal(findingIsSafe('Your stress causes your flares'), false)
  assert.equal(findingIsSafe('This will predict your next bad day'), false)
  assert.equal(findingIsSafe('You should stop taking it'), false)
  assert.equal(findingIsSafe('a significant correlation (p = 0.03)'), false)
  assert.equal(findingIsSafe('mood was 30% lower'), false)
  assert.equal(findingIsSafe('higher Fatigue and lower mood tended to show up together'), true)
})
