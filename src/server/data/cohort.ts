import { eq } from 'drizzle-orm'
import { profiles } from '@/server/db/schema'
import type { Ctx } from './_shared'
import { requireActor, getProfileSummaries, toDate } from './_shared'

/**
 * People like you similarity cohort.
 *
 * Scores other members against the viewer with private health data kept on the
 * server. The returned members are hydrated through the public profile helper.
 */

const SCORE_CONDITION = 3
const SCORE_COMORBIDITY = 2
const SCORE_INTEREST = 1
const SCORE_GOAL = 1
const SCORE_REPORT_CONDITION = 4
const SCORE_REPORT_SYMPTOM = 5
const SCORE_REPORT_TREATMENT = 5
const DEFAULT_LIMIT = 12

type ProfileMatchRow = {
  userId: string
  onboardingComplete?: boolean | null
  visibility?: string | null
  age?: number | null
  location?: string | null
  conditions?: unknown
  comorbidities?: unknown
  interests?: unknown
  mentalHealthGoals?: unknown
}

type ReportMatchRow = {
  userId: string
  conditionSlug?: string | null
  symptoms?: unknown
  treatments?: unknown
  isSearchVisible?: unknown
  completionState?: string | null
}

type SimilarMemberOptions = {
  conditionSlug?: string
  symptom?: string
  treatment?: string
  ageBand?: string
  location?: string
  limit?: number
}

type LivePresenceRow = { userId?: string | null; availableUntil?: unknown }
type LiveRequestRow = { seekerId?: string | null; status?: string | null; expiresAt?: unknown }
type LivePostRow = { userId?: string | null; createdAt?: unknown }
type LiveActivityRow = { status?: string | null; scheduledAt?: unknown }

export type MatchSignalLane = {
  kind: 'symptom' | 'treatment'
  label: string
  value: string
  match_count: number
  condition_labels: string[]
}

export type MemberActivitySignal = {
  rank: number
  labels: string[]
}

function normalizeToken(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function labelMatches(value: unknown, token: string): boolean {
  const normalized = normalizeToken(value)
  return Boolean(token && normalized && (normalized === token || normalized.includes(token)))
}

function storedBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

function toLowerSet(values: unknown): Set<string> {
  const set = new Set<string>()
  if (!Array.isArray(values)) return set
  for (const value of values) {
    const normalized = normalizeToken(value)
    if (normalized) set.add(normalized)
  }
  return set
}

function ageBand(age: number | null | undefined): string {
  if (typeof age !== 'number' || !Number.isFinite(age)) return 'unknown'
  if (age < 20) return 'under-20'
  if (age < 30) return '20s'
  if (age < 40) return '30s'
  if (age < 50) return '40s'
  if (age < 60) return '50s'
  return '60-plus'
}

function roughLocation(value: unknown): string {
  const normalized = normalizeToken(value)
  if (!normalized) return ''
  return normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)[0] ?? ''
}

function overlappingLabels(source: unknown, viewerSet: Set<string>): string[] {
  if (!Array.isArray(source)) return []
  const seen = new Set<string>()
  const labels: string[] = []
  for (const value of source) {
    if (typeof value !== 'string') continue
    const normalized = normalizeToken(value)
    if (!normalized || seen.has(normalized)) continue
    if (viewerSet.has(normalized)) {
      seen.add(normalized)
      labels.push(value.trim())
    }
  }
  return labels
}

function visibleReport(row: ReportMatchRow): boolean {
  return storedBoolean(row.isSearchVisible) && row.completionState !== 'draft'
}

function reportStringLabels(values: unknown, token: string): string[] {
  if (!Array.isArray(values)) return []
  const labels: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const label = String(value ?? '').trim()
    if (!label || !labelMatches(label, token)) continue
    const key = normalizeToken(label)
    if (seen.has(key)) continue
    seen.add(key)
    labels.push(label)
  }
  return labels
}

function reportTreatmentLabels(row: ReportMatchRow, token: string): string[] {
  if (!Array.isArray(row.treatments)) return []
  const labels: string[] = []
  const seen = new Set<string>()
  for (const entry of row.treatments as Array<{ slug?: unknown; name?: unknown }>) {
    const name = String(entry.name ?? entry.slug ?? '').trim()
    const slug = normalizeToken(entry.slug)
    if (!name) continue
    if (!labelMatches(name, token) && !labelMatches(slug, token)) continue
    const key = normalizeToken(name)
    if (seen.has(key)) continue
    seen.add(key)
    labels.push(name)
  }
  return labels
}

function reportTreatmentTokens(row: ReportMatchRow): Array<{ key: string; label: string }> {
  if (!Array.isArray(row.treatments)) return []
  const values: Array<{ key: string; label: string }> = []
  const seen = new Set<string>()
  for (const entry of row.treatments as Array<{ slug?: unknown; name?: unknown }>) {
    const label = String(entry.name ?? entry.slug ?? '').trim()
    const key = normalizeToken(entry.slug || entry.name)
    if (!label || !key || seen.has(key)) continue
    seen.add(key)
    values.push({ key, label })
  }
  return values
}

function reportStringTokens(values: unknown): Array<{ key: string; label: string }> {
  if (!Array.isArray(values)) return []
  const tokens: Array<{ key: string; label: string }> = []
  const seen = new Set<string>()
  for (const value of values) {
    const label = String(value ?? '').trim()
    const key = normalizeToken(label)
    if (!label || !key || seen.has(key)) continue
    seen.add(key)
    tokens.push({ key, label })
  }
  return tokens
}

function titleFromSlug(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  return raw
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function uniqueLabels(groups: string[][]): string[] {
  const labels: string[] = []
  const seen = new Set<string>()
  for (const group of groups) {
    for (const label of group) {
      const clean = String(label ?? '').trim()
      const key = normalizeToken(clean)
      if (!clean || !key || seen.has(key)) continue
      seen.add(key)
      labels.push(clean)
    }
  }
  return labels
}

function sentenceLabel(label: string | undefined): string {
  return String(label ?? '').trim().toLowerCase()
}

function treatmentSentenceLabel(label: string | undefined): string {
  const clean = String(label ?? '').trim()
  if (!clean) return ''
  if (clean === clean.toUpperCase() && /[A-Z]/.test(clean)) return clean
  return clean.toLowerCase()
}

function buildStarterPrompt(
  _shared: {
    conditions: string[]
    comorbidities: string[]
    interests: string[]
    symptoms: string[]
    treatments: string[]
  },
  activityLabels: string[],
): string {
  // PRIVACY: never name another member's conditions/symptoms/treatments here.
  // The prompt only nudges a warm hello; the "what in common" stays between them.
  if (activityLabels.includes('Available now')) return 'They are around now. A simple hello goes a long way.'
  if (activityLabels.includes('Posted recently')) return 'They posted recently. Reply or just say hi.'
  return 'You have something in common. Say hello and find out what.'
}

function usableViewerReport(row: ReportMatchRow): boolean {
  return row.completionState !== 'draft'
}

function sharedReportSignals(viewerReports: ReportMatchRow[], candidateReports: ReportMatchRow[]) {
  const conditionLabels: string[] = []
  const symptomLabels: string[] = []
  const treatmentLabels: string[] = []

  for (const candidateReport of candidateReports) {
    const conditionToken = normalizeToken(candidateReport.conditionSlug)
    if (!conditionToken) continue

    const comparableViewerReports = viewerReports.filter(
      (viewerReport) => normalizeToken(viewerReport.conditionSlug) === conditionToken,
    )
    if (comparableViewerReports.length === 0) continue

    const conditionLabel = titleFromSlug(candidateReport.conditionSlug)
    if (conditionLabel) conditionLabels.push(conditionLabel)

    const viewerSymptoms = new Set(
      comparableViewerReports.flatMap((report) => reportStringTokens(report.symptoms).map((entry) => entry.key)),
    )
    const viewerTreatments = new Set(
      comparableViewerReports.flatMap((report) => reportTreatmentTokens(report).map((entry) => entry.key)),
    )

    for (const symptom of reportStringTokens(candidateReport.symptoms)) {
      if (viewerSymptoms.has(symptom.key)) symptomLabels.push(symptom.label)
    }
    for (const treatment of reportTreatmentTokens(candidateReport)) {
      if (viewerTreatments.has(treatment.key)) treatmentLabels.push(treatment.label)
    }
  }

  return {
    conditions: uniqueLabels([conditionLabels]),
    symptoms: uniqueLabels([symptomLabels]),
    treatments: uniqueLabels([treatmentLabels]),
  }
}

function reportsByUser(rows: ReportMatchRow[]): Map<string, ReportMatchRow[]> {
  const map = new Map<string, ReportMatchRow[]>()
  for (const row of rows) {
    const list = map.get(row.userId) ?? []
    list.push(row)
    map.set(row.userId, list)
  }
  return map
}

function isAfter(value: unknown, now: Date): boolean {
  const date = toDate(value as never)
  return Boolean(date && date.getTime() > now.getTime())
}

function addActivitySignal(
  signals: Map<string, MemberActivitySignal>,
  userId: string | null | undefined,
  label: string,
  rank: number,
) {
  const cleanUserId = String(userId ?? '').trim()
  if (!cleanUserId) return
  const current = signals.get(cleanUserId) ?? { rank: 0, labels: [] }
  if (!current.labels.includes(label)) current.labels.push(label)
  current.rank += rank
  signals.set(cleanUserId, current)
}

export function buildMemberActivitySignals({
  actorId,
  now,
  supportPresence: presenceRows,
  posts,
}: {
  actorId: string
  now: Date
  supportPresence: LivePresenceRow[]
  posts: LivePostRow[]
}): Map<string, MemberActivitySignal> {
  const signals = new Map<string, MemberActivitySignal>()
  const recentCutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000

  for (const row of presenceRows) {
    if (row.userId === actorId || !isAfter(row.availableUntil, now)) continue
    addActivitySignal(signals, row.userId, 'Available now', 3)
  }

  for (const row of posts) {
    if (row.userId === actorId) continue
    const createdAt = toDate(row.createdAt as never)
    if (!createdAt || createdAt.getTime() < recentCutoff) continue
    addActivitySignal(signals, row.userId, 'Active this week', 1)
  }

  return signals
}

function eligibleCandidateIds(candidates: ProfileMatchRow[], viewerId: string): Set<string> {
  const ids = new Set<string>()
  for (const candidate of candidates) {
    if (candidate.userId === viewerId) continue
    if (!candidate.onboardingComplete) continue
    if (candidate.visibility !== 'community' && candidate.visibility !== 'public') continue
    ids.add(candidate.userId)
  }
  return ids
}

function laneKey(kind: MatchSignalLane['kind'], value: string): string {
  return `${kind}:${normalizeToken(value)}`
}

export function buildMatchSignalLanes({
  viewerId,
  candidates,
  reports,
  limit = 8,
}: {
  viewerId: string
  candidates: ProfileMatchRow[]
  reports: ReportMatchRow[]
  limit?: number
}): MatchSignalLane[] {
  if (!viewerId) return []
  const eligibleIds = eligibleCandidateIds(candidates, viewerId)
  const viewerReports = reports.filter((report) => report.userId === viewerId && usableViewerReport(report))
  const visiblePeerReports = reports.filter((report) => report.userId !== viewerId && visibleReport(report) && eligibleIds.has(report.userId))
  const buckets = new Map<
    string,
    {
      kind: MatchSignalLane['kind']
      label: string
      value: string
      conditionLabels: Set<string>
      memberIds: Set<string>
    }
  >()

  function addLane(kind: MatchSignalLane['kind'], label: string, value: string, conditionLabel: string, memberIds: string[]) {
    const cleanLabel = String(label ?? '').trim()
    const cleanValue = normalizeToken(value || label)
    if (!cleanLabel || !cleanValue || memberIds.length === 0) return
    const key = laneKey(kind, cleanValue)
    const bucket = buckets.get(key) ?? {
      kind,
      label: cleanLabel,
      value: cleanValue,
      conditionLabels: new Set<string>(),
      memberIds: new Set<string>(),
    }
    if (conditionLabel) bucket.conditionLabels.add(conditionLabel)
    for (const memberId of memberIds) bucket.memberIds.add(memberId)
    buckets.set(key, bucket)
  }

  for (const viewerReport of viewerReports) {
    const conditionToken = normalizeToken(viewerReport.conditionSlug)
    const conditionLabel = titleFromSlug(viewerReport.conditionSlug)
    const peersForCondition = visiblePeerReports.filter(
      (report) => !conditionToken || normalizeToken(report.conditionSlug) === conditionToken,
    )

    for (const symptom of reportStringTokens(viewerReport.symptoms)) {
      const memberIds = peersForCondition
        .filter((report) => reportStringTokens(report.symptoms).some((entry) => entry.key === symptom.key))
        .map((report) => report.userId)
      addLane('symptom', symptom.label, symptom.key, conditionLabel, memberIds)
    }

    for (const treatment of reportTreatmentTokens(viewerReport)) {
      const memberIds = peersForCondition
        .filter((report) => reportTreatmentTokens(report).some((entry) => entry.key === treatment.key))
        .map((report) => report.userId)
      addLane('treatment', treatment.label, treatment.key, conditionLabel, memberIds)
    }
  }

  return Array.from(buckets.values())
    .map((bucket) => ({
      kind: bucket.kind,
      label: bucket.label,
      value: bucket.value,
      match_count: bucket.memberIds.size,
      condition_labels: [],
    }))
    .filter((lane) => lane.match_count > 0)
    .sort((first, second) => {
      if (second.match_count !== first.match_count) return second.match_count - first.match_count
      if (first.kind !== second.kind) return first.kind === 'symptom' ? -1 : 1
      return first.label.localeCompare(second.label)
    })
    .slice(0, Math.max(1, Math.min(12, limit)))
}

export function buildSocialStarterLiveness({
  actorId,
  now,
  membersCount,
  supportPresence: presenceRows,
  supportRequests: requestRows,
  posts,
  activities,
}: {
  actorId: string
  now: Date
  membersCount: number
  supportPresence: LivePresenceRow[]
  supportRequests: LiveRequestRow[]
  posts: LivePostRow[]
  activities: LiveActivityRow[]
}) {
  const recentCutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000

  return {
    close_matches_count: membersCount,
    available_supporters_count: presenceRows.filter(
      (row) => row.userId !== actorId && isAfter(row.availableUntil, now),
    ).length,
    open_lanterns_count: requestRows.filter(
      (row) => row.seekerId !== actorId && row.status === 'open' && isAfter(row.expiresAt, now),
    ).length,
    recent_posts_count: posts.filter((row) => (toDate(row.createdAt as never)?.getTime() ?? 0) >= recentCutoff).length,
    upcoming_activities_count: activities.filter(
      (row) => row.status !== 'cancelled' && isAfter(row.scheduledAt, now),
    ).length,
  }
}

export type SimilarMember = {
  id: string
  userId: string
  username: string
  fullName: string | null
  pseudonym: string | null
  isAnonymous: boolean
  avatarUrl: string | null
  coverImageUrl: string | null
  bio: string | null
  pronouns: string | null
  onboardingComplete: boolean
  followers: number
  following: number
  postsCount: number
  createdAt: Date
  similarity_score: number
  shared: {
    conditions: string[]
    comorbidities: string[]
    interests: string[]
    symptoms: string[]
    treatments: string[]
  }
  match_reasons: string[]
  starter_prompt: string
  activity_labels: string[]
  message_prompt_allowed: boolean
}

export type SimilarMemberMatch = {
  userId: string
  score: number
  shared: SimilarMember['shared']
  match_reasons: string[]
  starter_prompt: string
  activity_labels: string[]
  activity_rank: number
  message_prompt_allowed: boolean
}

export function buildSimilarMemberMatches(
  viewer: ProfileMatchRow,
  candidates: ProfileMatchRow[],
  reports: ReportMatchRow[] = [],
  opts: SimilarMemberOptions = {},
  activitySignals: Map<string, MemberActivitySignal> = new Map(),
): SimilarMemberMatch[] {
  const viewerConditions = toLowerSet(viewer.conditions)
  const viewerComorbidities = toLowerSet(viewer.comorbidities)
  const viewerInterests = toLowerSet(viewer.interests)
  const viewerGoals = toLowerSet(viewer.mentalHealthGoals)
  const requiredCondition = normalizeToken(opts.conditionSlug)
  const requiredSymptom = normalizeToken(opts.symptom)
  const requiredTreatment = normalizeToken(opts.treatment)
  const requiredAgeBand = normalizeToken(opts.ageBand)
  const requiredLocation = roughLocation(opts.location)
  const visibleReportsByUser = reportsByUser(reports.filter(visibleReport))
  const viewerReports = reports.filter((report) => report.userId === viewer.userId && usableViewerReport(report))

  const viewerHasRequiredCondition =
    !requiredCondition ||
    viewerConditions.has(requiredCondition) ||
    viewerReports.some((report) => labelMatches(report.conditionSlug, requiredCondition))
  if (!viewerHasRequiredCondition) return []

  const scored: SimilarMemberMatch[] = []

  for (const candidate of candidates) {
    if (candidate.userId === viewer.userId) continue
    if (!candidate.onboardingComplete) continue
    if (candidate.visibility !== 'community' && candidate.visibility !== 'public') continue
    if (requiredAgeBand && ageBand(candidate.age) !== requiredAgeBand) continue
    if (requiredLocation && roughLocation(candidate.location) !== requiredLocation) continue

    const candidateReports = visibleReportsByUser.get(candidate.userId) ?? []
    const candidateConditions = toLowerSet(candidate.conditions)
    if (
      requiredCondition &&
      !candidateConditions.has(requiredCondition) &&
      !candidateReports.some((report) => labelMatches(report.conditionSlug, requiredCondition))
    ) {
      continue
    }

    const symptomLabels = requiredSymptom
      ? candidateReports.flatMap((report) => reportStringLabels(report.symptoms, requiredSymptom))
      : []
    if (requiredSymptom && symptomLabels.length === 0) continue

    const treatmentLabels = requiredTreatment
      ? candidateReports.flatMap((report) => reportTreatmentLabels(report, requiredTreatment))
      : []
    if (requiredTreatment && treatmentLabels.length === 0) continue

    const reportSignals = sharedReportSignals(viewerReports, candidateReports)
    const sharedConditions = overlappingLabels(candidate.conditions, viewerConditions)
    const sharedComorbidities = overlappingLabels(candidate.comorbidities, viewerComorbidities)
    const sharedInterests = overlappingLabels(candidate.interests, viewerInterests)
    const sharedGoals = overlappingLabels(candidate.mentalHealthGoals, viewerGoals)
    const sameAgeBand = ageBand(candidate.age) !== 'unknown' && ageBand(candidate.age) === ageBand(viewer.age)
    const sameArea = Boolean(roughLocation(candidate.location) && roughLocation(candidate.location) === roughLocation(viewer.location))
    const hasCoreMatch =
      sharedConditions.length > 0 ||
      sharedComorbidities.length > 0 ||
      sharedInterests.length > 0 ||
      sharedGoals.length > 0 ||
      reportSignals.conditions.length > 0 ||
      (requiredSymptom ? symptomLabels : reportSignals.symptoms).length > 0 ||
      (requiredTreatment ? treatmentLabels : reportSignals.treatments).length > 0

    if (!hasCoreMatch) continue

    const score =
      sharedConditions.length * SCORE_CONDITION +
      sharedComorbidities.length * SCORE_COMORBIDITY +
      sharedInterests.length * SCORE_INTEREST +
      sharedGoals.length * SCORE_GOAL +
      reportSignals.conditions.length * SCORE_REPORT_CONDITION +
      (requiredSymptom ? symptomLabels.length : reportSignals.symptoms.length) * SCORE_REPORT_SYMPTOM +
      (requiredTreatment ? treatmentLabels.length : reportSignals.treatments.length) * SCORE_REPORT_TREATMENT +
      (sameAgeBand ? 1 : 0) +
      (sameArea ? 1 : 0)

    if (score <= 0) continue

    const matchReasons = [
      sharedConditions.length > 0 ? 'shared condition' : null,
      sharedComorbidities.length > 0 ? 'related condition' : null,
      (requiredSymptom ? symptomLabels : reportSignals.symptoms).length > 0 ? 'shared symptom' : null,
      (requiredTreatment ? treatmentLabels : reportSignals.treatments).length > 0 ? 'shared treatment' : null,
      sameAgeBand ? 'same age band' : null,
      sameArea ? 'same area' : null,
    ].filter((reason): reason is string => Boolean(reason))
    const activity = activitySignals.get(candidate.userId)
    const activityLabels = activity?.labels ?? []
    const matchedSignals = {
      conditions: uniqueLabels([sharedConditions, reportSignals.conditions]),
      comorbidities: sharedComorbidities,
      interests: [...sharedInterests, ...sharedGoals],
      symptoms: requiredSymptom ? Array.from(new Set(symptomLabels)) : reportSignals.symptoms,
      treatments: requiredTreatment ? Array.from(new Set(treatmentLabels)) : reportSignals.treatments,
    }
    const shared = {
      conditions: [],
      comorbidities: [],
      interests: [],
      symptoms: [],
      treatments: [],
    }

    scored.push({
      userId: candidate.userId,
      score,
      shared,
      match_reasons: matchReasons,
      starter_prompt: buildStarterPrompt(matchedSignals, activityLabels),
      activity_labels: activityLabels,
      activity_rank: activity?.rank ?? 0,
      message_prompt_allowed: false,
    })
  }

  return scored
    .sort((a, b) => b.score - a.score || b.activity_rank - a.activity_rank)
    .slice(0, opts.limit ?? DEFAULT_LIMIT)
}

export async function getSimilarMembers(
  ctx: Ctx,
  _userId: string,
  opts?: SimilarMemberOptions,
): Promise<SimilarMember[]> {
  const viewerId = requireActor(ctx)

  const viewer = await ctx.db.query.profiles.findFirst({
    where: eq(profiles.userId, viewerId),
  })
  if (!viewer) return []

  const reportRows = await ctx.db.query.conditionReports.findMany({ limit: 2000 })
  const viewerHasReports = reportRows.some((report) => report.userId === viewerId && usableViewerReport(report))
  if (
    toLowerSet(viewer.conditions).size === 0 &&
    toLowerSet(viewer.comorbidities).size === 0 &&
    toLowerSet(viewer.interests).size === 0 &&
    toLowerSet(viewer.mentalHealthGoals).size === 0 &&
    !viewerHasReports
  ) {
    return []
  }

  const [candidates, presenceRows, postRows] = await Promise.all([
    ctx.db.query.profiles.findMany(),
    ctx.db.query.supportPresence.findMany({ limit: 1000 }),
    ctx.db.query.communityPosts.findMany({ limit: 1000 }),
  ])
  const activitySignals = buildMemberActivitySignals({
    actorId: viewerId,
    now: new Date(),
    supportPresence: presenceRows,
    posts: postRows,
  })
  const top = buildSimilarMemberMatches(viewer, candidates, reportRows, opts ?? {}, activitySignals)

  const summaries = await getProfileSummaries(
    ctx.db,
    top.map((entry) => entry.userId),
  )

  const result: SimilarMember[] = []
  for (const entry of top) {
    const summary = summaries.get(entry.userId)
    if (!summary) continue
    // PRIVACY: matches are RANKED server-side using shared health signals, but we
    // never reveal WHAT a member shares — not the named condition, not even the
    // category ("shared condition") or their age band / area. The viewer only sees
    // match strength + "something in common". Mirrors getSocialStarter (warm-start).
    result.push({
      ...summary,
      similarity_score: entry.score,
      shared: { conditions: [], comorbidities: [], interests: [], symptoms: [], treatments: [] },
      match_reasons: [],
      starter_prompt: entry.starter_prompt,
      activity_labels: entry.activity_labels,
      message_prompt_allowed: entry.message_prompt_allowed,
    })
  }

  return result
}

export async function getMatchSignalLanes(
  ctx: Ctx,
  _userId?: string,
  opts?: { limit?: number },
): Promise<MatchSignalLane[]> {
  const viewerId = requireActor(ctx)
  const [candidates, reportRows] = await Promise.all([
    ctx.db.query.profiles.findMany(),
    ctx.db.query.conditionReports.findMany({ limit: 2000 }),
  ])

  return buildMatchSignalLanes({
    viewerId,
    candidates,
    reports: reportRows,
    limit: opts?.limit ?? 8,
  })
}

export async function getSocialStarter(
  ctx: Ctx,
  _userId?: string,
  opts?: { limit?: number },
) {
  const actorId = requireActor(ctx)
  const limit = Math.max(1, Math.min(6, Math.round(opts?.limit ?? 3)))

  const [members, presenceRows, requestRows, postRows, activityRows] = await Promise.all([
    getSimilarMembers(ctx, actorId, { limit }),
    ctx.db.query.supportPresence.findMany({ limit: 500 }),
    ctx.db.query.supportRequests.findMany({ limit: 500 }),
    ctx.db.query.communityPosts.findMany({ limit: 100 }),
    ctx.db.query.communityActivities.findMany({ limit: 100 }),
  ])

  // PRIVACY: matches are RANKED using shared health signals server-side, but we
  // never expose another member's specific conditions/symptoms/treatments to the
  // viewer. Strip the named labels + reasons; the UI only says "something in common".
  const safeMembers = members.map((member) => ({
    ...member,
    shared: { conditions: [], comorbidities: [], interests: [], symptoms: [], treatments: [] },
    match_reasons: [],
  }))

  return {
    members: safeMembers,
    liveness: buildSocialStarterLiveness({
      actorId,
      now: new Date(),
      membersCount: members.length,
      supportPresence: presenceRows,
      supportRequests: requestRows,
      posts: postRows,
      activities: activityRows,
    }),
  }
}
