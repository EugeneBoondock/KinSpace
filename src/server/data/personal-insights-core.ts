/**
 * Personal insights, PURE analytical core (no imports), so it is cheaply
 * unit-testable in isolation. The DB wrapper lives in ./personal-insights.ts.
 *
 * n-of-1, OBSERVATIONAL "mirror" of a member's own logs. Methodology designed +
 * adversarially verified (biostatistician + clinical-safety panel):
 *   - Descriptive only. Never causal, predictive, diagnostic, or prescriptive.
 *   - Every surfaced number is a difference in the member's OWN units, shown as a
 *     soft WORD, never %, r, p, or a decimal.
 *   - Hard sample-size + effect-size + leave-one-out gates; silence under thin data.
 *   - findingIsSafe() suppresses any card whose finding reads causal/unsafe.
 */

export const MOOD_VALENCE: Record<string, number> = { grounded: 5, hopeful: 4, tired: 3, stretched: 2, heavy: 1 }
const VALENCE_MOOD: Record<number, string> = { 5: 'grounded', 4: 'hopeful', 3: 'tired', 2: 'stretched', 1: 'heavy' }
export const DAY_MS = 24 * 60 * 60 * 1000

export type InsightKind =
  | 'checkin_rhythm'
  | 'mood_trend'
  | 'symptom_trend'
  | 'mood_symptom_assoc'
  | 'med_mood_assoc'
  | 'spoons_symptom_assoc'
  | 'therapy_mood_window'
export type Band = 'slight' | 'noticeable' | 'consistent'
export type Direction = 'rising' | 'steady' | 'lower' | 'higher' | 'together' | null
export type DisclaimerKey = 'standard' | 'med' | 'therapy'

export type InsightCard = {
  kind: InsightKind
  title: string
  phrase: string
  direction: Direction
  band: Band | null
  subject: string | null
  sampleDays: number
  perGroupCounts: { a: number; b: number } | null
  careTeamNudge: boolean
  disclaimerKey: DisclaimerKey
}
export type LockedHint = { kind: 'locked'; title: string; needs: string; remaining: number }
export type ReviewCoverageLevel = 'thin' | 'building' | 'strong'
export type ReviewNextAction = {
  id: string
  title: string
  body: string
  href: string
  icon: string
}
export type PersonalReview = {
  title: string
  summary: string
  coverageLevel: ReviewCoverageLevel
  focus: string | null
  nextActions: ReviewNextAction[]
}
export type InsightReviewNote = {
  title: string
  body: string
  tags: string[]
}
export type PersonalInsights = {
  windowDays: number
  generatedAt: string
  coverage: {
    loggedDays: number
    windowDays: number
    currentStreak: number
    longestStreak: number
    modalMood: string | null
  }
  cards: InsightCard[]
  locked: LockedHint[]
  hasEnoughData: boolean
  crisisNudge: string | null
  footerKey: 'standard'
  review: PersonalReview
}

// ── Safety guard: a card finding may never read causal / predictive / prescriptive ──
const BANNED = [
  /\bcause[ds]?\b/i, /\bcausing\b/i, /\bbecause\b/i, /\bdue to\b/i, /\bleads? to\b/i,
  /\bresults? in\b/i, /\btriggers?\b/i, /\bmakes your\b/i, /\bwill\b/i, /\bgoing to\b/i,
  /\bpredict/i, /\bexpect/i, /\brisk of\b/i, /\bdiagnos/i, /\byou have\b/i,
  /\bshould (take|stop|start)\b/i, /\b(increase|reduce) your dose\b/i, /\b(stop|start) taking\b/i,
  /\bstrong correlation\b/i, /\bsignificant\b/i, /\bp\s*=/i, /\br\s*=/i, /%/, /\babnormal\b/i, /\bunusually\b/i,
]
export function findingIsSafe(phrase: string): boolean {
  return !BANNED.some((re) => re.test(phrase))
}

// ── Stats helpers (cheap, robust) ───────────────────────────────────────────
const mean = (a: number[]): number => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
function median(a: number[]): number {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
/** Second-half mean minus first-half mean over a day-ordered series (drops the middle if odd). */
function splitHalfDiff(values: number[]): number {
  const n = values.length
  const half = Math.floor(n / 2)
  if (half < 1) return 0
  return mean(values.slice(n - half)) - mean(values.slice(0, half))
}
/** Sign of the Theil-Sen median pairwise slope, an internal robustness guard, never displayed. */
function theilSenSign(points: Array<{ x: number; y: number }>): number {
  const slopes: number[] = []
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[j].x - points[i].x
      if (dx > 0) slopes.push((points[j].y - points[i].y) / dx)
    }
  }
  return slopes.length ? Math.sign(median(slopes)) : 0
}
/** Group-mean gap (A − B) that survives leave-one-out (sign holds + ≥70% magnitude). */
function stableGroupGap(groupA: number[], groupB: number[]): number | null {
  if (groupA.length < 1 || groupB.length < 1) return null
  const base = mean(groupA) - mean(groupB)
  if (base === 0) return 0
  const recompute = (dropFromA: number | null, dropFromB: number | null): number => {
    const a = dropFromA === null ? groupA : groupA.filter((_, i) => i !== dropFromA)
    const b = dropFromB === null ? groupB : groupB.filter((_, i) => i !== dropFromB)
    if (!a.length || !b.length) return base
    return mean(a) - mean(b)
  }
  for (let i = 0; i < groupA.length; i++) {
    const g = recompute(i, null)
    if (Math.sign(g) !== Math.sign(base) || Math.abs(g) < 0.7 * Math.abs(base)) return null
  }
  for (let j = 0; j < groupB.length; j++) {
    const g = recompute(null, j)
    if (Math.sign(g) !== Math.sign(base) || Math.abs(g) < 0.7 * Math.abs(base)) return null
  }
  return base
}
const bandFromGap = (gap: number, slight: number, noticeable: number): Band =>
  Math.abs(gap) >= noticeable ? 'consistent' : Math.abs(gap) >= slight ? 'noticeable' : 'slight'
const dayDiff = (a: string, b: string): number =>
  Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY_MS)
const bandRank = (b: Band | null): number =>
  b === 'consistent' ? 3 : b === 'noticeable' ? 2 : b === 'slight' ? 1 : 0

// ── The pure core ───────────────────────────────────────────────────────────
export type InsightSignals = {
  windowDays: number
  today: string
  mood: Map<string, number>
  symptoms: Map<string, Map<string, number>>
  medTaken: Set<string>
  medDue: Set<string>
  spoons: Map<string, number>
  therapy: Set<string>
  crisisNudge: string | null
  generatedAt: string
}

export function buildPersonalInsights(s: InsightSignals): PersonalInsights {
  const cards: InsightCard[] = []
  const locked: LockedHint[] = []

  const loggedDaySet = new Set<string>([...s.mood.keys(), ...s.symptoms.keys()])
  const loggedDays = loggedDaySet.size
  const { currentStreak, longestStreak } = streaks(loggedDaySet, s.today, s.windowDays)
  const modalMood = computeModalMood(s.mood)

  const symptomDays = new Map<string, Array<{ day: string; val: number }>>()
  for (const [day, perSym] of s.symptoms) {
    for (const [sym, sev] of perSym) {
      const list = symptomDays.get(sym) ?? []
      list.push({ day, val: sev })
      symptomDays.set(sym, list)
    }
  }
  for (const list of symptomDays.values()) list.sort((a, b) => a.day.localeCompare(b.day))

  // 1) Mood trend
  const moodSeries = [...s.mood.entries()].map(([day, val]) => ({ day, val })).sort((a, b) => a.day.localeCompare(b.day))
  const moodTrend = trendCard('mood_trend', 'Mood trend', null, moodSeries, s.windowDays, 0.5)
  if (moodTrend) cards.push(moodTrend)

  // 2) Symptom trends
  for (const [sym, series] of symptomDays) {
    const card = trendCard('symptom_trend', `${sym} trend`, sym, series, s.windowDays, 1.0)
    if (card) cards.push(card)
    else if (series.length >= 4 && series.length < 8) {
      locked.push({ kind: 'locked', title: `${sym} trend`, needs: `Log ${sym} on ${8 - series.length} more days`, remaining: 8 - series.length })
    }
  }

  // 3) Mood ↔ symptom associations
  const assocCards: InsightCard[] = []
  for (const [sym, series] of symptomDays) {
    const sevByDay = new Map(series.map((p) => [p.day, p.val]))
    const paired = [...s.mood.entries()].filter(([day]) => sevByDay.has(day)).map(([day, moodVal]) => ({ day, moodVal, sev: sevByDay.get(day)! }))
    if (paired.length < 10) {
      if (paired.length >= 6) locked.push({ kind: 'locked', title: `${sym} & mood`, needs: `Log mood + ${sym} together on ${10 - paired.length} more days`, remaining: 10 - paired.length })
      continue
    }
    const med = median(paired.map((p) => p.sev))
    const high = paired.filter((p) => p.sev > med).map((p) => p.moodVal)
    const low = paired.filter((p) => p.sev <= med).map((p) => p.moodVal)
    if (high.length < 4 || low.length < 4) continue
    const gap = stableGroupGap(low, high)
    if (gap === null || Math.abs(gap) < 0.6) continue
    assocCards.push({
      kind: 'mood_symptom_assoc', title: `${sym} & mood`,
      phrase: `On the ${paired.length} days you logged both, higher ${sym} and lower mood tended to show up together.`,
      direction: 'together', band: bandFromGap(gap, 0.6, 1.8), subject: sym, sampleDays: paired.length,
      perGroupCounts: { a: high.length, b: low.length }, careTeamNudge: false, disclaimerKey: 'standard',
    })
  }

  // 4) Spoons ↔ symptom associations
  for (const [sym, series] of symptomDays) {
    const sevByDay = new Map(series.map((p) => [p.day, p.val]))
    const paired = [...s.spoons.entries()].filter(([day]) => sevByDay.has(day)).map(([day, sp]) => ({ day, sp, sev: sevByDay.get(day)! }))
    if (paired.length < 10) continue
    const med = median(paired.map((p) => p.sp))
    const low = paired.filter((p) => p.sp <= med).map((p) => p.sev)
    const high = paired.filter((p) => p.sp > med).map((p) => p.sev)
    if (low.length < 4 || high.length < 4) continue
    const gap = stableGroupGap(low, high)
    if (gap === null || Math.abs(gap) < 0.8) continue
    assocCards.push({
      kind: 'spoons_symptom_assoc', title: `Capacity & ${sym}`,
      phrase: `On your lower-capacity days, you also tended to log a bit more ${sym}.`,
      direction: 'together', band: bandFromGap(gap, 0.8, 2.2), subject: sym, sampleDays: paired.length,
      perGroupCounts: { a: low.length, b: high.length }, careTeamNudge: false, disclaimerKey: 'standard',
    })
  }

  // 5) Medication-adherence ↔ mood (confirmed negatives only)
  const moodDays = [...s.mood.entries()]
  if (moodDays.length >= 12) {
    const taken = moodDays.filter(([day]) => s.medTaken.has(day)).map(([, v]) => v)
    const notTaken = moodDays.filter(([day]) => s.medDue.has(day) && !s.medTaken.has(day)).map(([, v]) => v)
    if (taken.length >= 5 && notTaken.length >= 5) {
      const gap = stableGroupGap(taken, notTaken)
      if (gap !== null && Math.abs(gap) >= 0.6) {
        assocCards.push({
          kind: 'med_mood_assoc', title: 'Medication & mood',
          phrase: `On the ${taken.length} days you marked your meds taken and the ${notTaken.length} days you didn't, your logged mood looked a little different.`,
          direction: null, band: bandFromGap(gap, 0.6, 1.8), subject: null, sampleDays: taken.length + notTaken.length,
          perGroupCounts: { a: taken.length, b: notTaken.length }, careTeamNudge: true, disclaimerKey: 'med',
        })
      }
    }
  }

  assocCards.sort((a, b) => bandRank(b.band) - bandRank(a.band))
  cards.push(...assocCards.slice(0, 3))

  // 6) Therapy → following-mood window (positive/neutral only)
  const therapyCard = therapyMoodWindow(s)
  if (therapyCard) cards.push(therapyCard)

  const safe = cards.filter((c) => findingIsSafe(c.phrase)).slice(0, 6)
  if (safe.length === 0 && loggedDays >= 3) {
    const rhythmCard = checkinRhythmCard(loggedDays, modalMood)
    if (findingIsSafe(rhythmCard.phrase)) safe.push(rhythmCard)
  }
  const review = buildPersonalReview({ cards: safe, loggedDays, windowDays: s.windowDays, locked: locked.slice(0, 5) })

  return {
    windowDays: s.windowDays,
    generatedAt: s.generatedAt,
    coverage: { loggedDays, windowDays: s.windowDays, currentStreak, longestStreak, modalMood },
    cards: safe,
    locked: locked.slice(0, 5),
    hasEnoughData: safe.length > 0,
    crisisNudge: s.crisisNudge,
    footerKey: 'standard',
    review,
  }
}

function coverageLevel(loggedDays: number, windowDays: number): ReviewCoverageLevel {
  if (loggedDays >= Math.max(12, Math.floor(windowDays * 0.6))) return 'strong'
  if (loggedDays >= 4) return 'building'
  return 'thin'
}

function focusLabel(card: InsightCard | undefined): string | null {
  if (!card) return null
  return card.subject ?? card.title
}

function buildPersonalReview({
  cards,
  loggedDays,
  windowDays,
  locked,
}: {
  cards: InsightCard[]
  loggedDays: number
  windowDays: number
  locked: LockedHint[]
}): PersonalReview {
  const level = coverageLevel(loggedDays, windowDays)
  const actionCard = cards.find((card) => card.careTeamNudge)
  const primary = cards.find((card) => card.subject) ?? actionCard ?? cards[0]
  const focus = focusLabel(primary)
  const nextActions: ReviewNextAction[] = []

  if (!primary) {
    nextActions.push({
      id: 'daily-checkin',
      title: 'Log today',
      body: 'A mood and symptom check-in gives next week something real to work with.',
      href: '/dashboard',
      icon: 'ri-calendar-check-line',
    })
    if (locked[0]) {
      nextActions.push({
        id: 'unlock-next-pattern',
        title: 'Unlock the next pattern',
        body: locked[0].needs,
        href: '/dashboard',
        icon: 'ri-lock-unlock-line',
      })
    }
    return {
      title: 'Start your weekly review',
      summary: `${loggedDays} ${loggedDays === 1 ? 'day' : 'days'} logged. Check in a few more times to turn your logs into a weekly review.`,
      coverageLevel: level,
      focus: null,
      nextActions,
    }
  }

  if (actionCard) {
    nextActions.push({
      id: 'care-team-note',
      title: 'Save a care-team note',
      body: 'Keep this pattern handy for your next appointment or support conversation.',
      href: '/timeline',
      icon: 'ri-file-list-3-line',
    })
  }

  nextActions.push({
    id: 'keep-checking-in',
    title: 'Keep the streak alive',
    body: 'One quick check-in today keeps this review honest next week.',
    href: '/dashboard',
    icon: 'ri-fire-line',
  })

  if (primary.kind === 'mood_symptom_assoc' || primary.kind === 'spoons_symptom_assoc' || primary.kind === 'symptom_trend') {
    nextActions.push({
      id: 'watch-focus',
      title: `Watch ${focus ?? 'this pattern'}`,
      body: 'Track it for a few more days and see whether the picture holds.',
      href: '/dashboard',
      icon: 'ri-pulse-line',
    })
  }

  return {
    title: primary.kind === 'checkin_rhythm' ? 'Your weekly review has started' : 'Your weekly review is ready',
    summary: primary.kind === 'checkin_rhythm'
      ? `${loggedDays} days logged. Keep checking in to give your next review a clearer picture.`
      : `${loggedDays} days logged. ${focus ?? primary.title} is the clearest pattern to watch right now.`,
    coverageLevel: level,
    focus,
    nextActions: nextActions.slice(0, 3),
  }
}

function checkinRhythmCard(loggedDays: number, modalMood: string | null): InsightCard {
  return {
    kind: 'checkin_rhythm',
    title: 'Check-in rhythm',
    phrase: modalMood
      ? `You logged ${loggedDays} days in this window. Your most logged mood was ${modalMood}.`
      : `You logged ${loggedDays} days in this window. Your review has started.`,
    direction: null,
    band: null,
    subject: null,
    sampleDays: loggedDays,
    perGroupCounts: null,
    careTeamNudge: false,
    disclaimerKey: 'standard',
  }
}

export function buildInsightReviewNote(insights: PersonalInsights): InsightReviewNote {
  const lines: string[] = []
  const patterns = insights.cards.slice(0, 4)

  lines.push(insights.review.title)
  lines.push('')
  lines.push(insights.review.summary)
  lines.push('')
  lines.push(`Logged days: ${insights.coverage.loggedDays}/${insights.coverage.windowDays}`)
  if (insights.coverage.modalMood) lines.push(`Most logged mood: ${insights.coverage.modalMood}`)

  if (patterns.length > 0) {
    lines.push('')
    lines.push('Patterns to discuss')
    for (const card of patterns) {
      lines.push(`- ${card.title}: ${card.phrase}`)
    }
  }

  if (insights.review.nextActions.length > 0) {
    lines.push('')
    lines.push('Next steps I wanted to keep')
    for (const action of insights.review.nextActions) {
      lines.push(`- ${action.title}: ${action.body}`)
    }
  }

  lines.push('')
  lines.push('This note is not medical advice or a prediction. It is a private summary of my own KinSpace logs for a care conversation.')

  return {
    title: 'Care-team note from KinSpace',
    body: lines.join('\n'),
    tags: ['insights', 'care-team'],
  }
}

function trendCard(
  kind: 'mood_trend' | 'symptom_trend',
  title: string,
  subject: string | null,
  series: Array<{ day: string; val: number }>,
  windowDays: number,
  threshold: number): InsightCard | null {
  if (series.length < 8) return null
  const span = dayDiff(series[0].day, series[series.length - 1].day)
  if (span < 10) return null
  if (Math.floor(series.length / 2) < 3) return null
  const diff = splitHalfDiff(series.map((p) => p.val))
  const tsSign = theilSenSign(series.map((p) => ({ x: dayDiff(series[0].day, p.day), y: p.val })))
  const steady = Math.abs(diff) < threshold || (tsSign !== 0 && Math.sign(diff) !== tsSign)
  const mk = (t: string, phrase: string, direction: Direction, nudge = false): InsightCard => ({
    kind, title: t, phrase, direction, band: null, subject, sampleDays: series.length, perGroupCounts: null, careTeamNudge: nudge, disclaimerKey: 'standard',
  })

  if (kind === 'mood_trend') {
    if (steady) return mk('Mood trend', `Your mood check-ins have been holding fairly steady over the last ${windowDays} days.`, 'steady')
    return diff > 0
      ? mk('Mood trend', `Over the last ${windowDays} days, your mood check-ins have been gently rising compared with how they started.`, 'rising')
      : mk('Mood trend', `Over the last ${windowDays} days, your mood check-ins have leaned a little lower than at the start.`, 'lower')
  }
  if (steady) return null
  const subj = subject ?? 'symptom'
  return diff < 0
    ? mk(title, `On the days you tracked it, your ${subj} has tended to sit a bit lower lately than before.`, 'lower')
    : mk(title, `On the days you tracked it, your ${subj} has tended to run a bit higher lately.`, 'higher', true)
}

function therapyMoodWindow(s: InsightSignals): InsightCard | null {
  const therapyDays = [...s.therapy].sort()
  if (therapyDays.length < 4) return null
  const windowSet = new Set<string>()
  for (const d of therapyDays) {
    for (let k = 0; k <= 2; k++) {
      windowSet.add(new Date(Date.parse(d + 'T00:00:00Z') + k * DAY_MS).toISOString().slice(0, 10))
    }
  }
  const windowMoods: number[] = []
  const baselineMoods: number[] = []
  for (const [day, val] of s.mood) (windowSet.has(day) ? windowMoods : baselineMoods).push(val)
  if (windowMoods.length < 4 || baselineMoods.length < 8) return null
  if (mean(windowMoods) - mean(baselineMoods) < 0.5) return null
  return {
    kind: 'therapy_mood_window', title: 'After Guide sessions',
    phrase: `In the day or two after your Guide sessions, your mood check-ins have often read a touch brighter than your usual.`,
    direction: 'higher', band: null, subject: null, sampleDays: windowMoods.length, perGroupCounts: null, careTeamNudge: false, disclaimerKey: 'therapy',
  }
}

function streaks(daySet: Set<string>, today: string, windowDays: number): { currentStreak: number; longestStreak: number } {
  let currentStreak = 0
  for (let k = 0; k < windowDays; k++) {
    const d = new Date(Date.parse(today + 'T00:00:00Z') - k * DAY_MS).toISOString().slice(0, 10)
    if (daySet.has(d)) currentStreak++
    else break
  }
  let longestStreak = 0
  let run = 0
  for (let k = windowDays - 1; k >= 0; k--) {
    const d = new Date(Date.parse(today + 'T00:00:00Z') - k * DAY_MS).toISOString().slice(0, 10)
    if (daySet.has(d)) {
      run++
      longestStreak = Math.max(longestStreak, run)
    } else run = 0
  }
  return { currentStreak, longestStreak }
}

function computeModalMood(mood: Map<string, number>): string | null {
  if (mood.size === 0) return null
  const counts = new Map<number, number>()
  for (const v of mood.values()) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best = 0
  let bestVal = 0
  for (const [v, c] of counts) if (c > best) { best = c; bestVal = v }
  return VALENCE_MOOD[bestVal] ?? null
}
