import { eq, and, desc, inArray, sql } from 'drizzle-orm'
import type { Ctx } from './_shared'
import {
  requireActor,
  getProfileSummary,
  getProfileSummaries,
  sortByNewest,
} from './_shared'
import {
  conditions,
  treatments,
  conditionTreatments,
  experiences,
  experienceVotes,
  symptoms,
  conditionSymptoms,
  triggers,
  conditionTriggers,
  tests,
  conditionTests,
  conditionReports,
  conditionResearchQuestions,
  conditionResearchQuestionAnswers,
  conditionResearchQuestionVotes,
  conditionComments,
} from '@/server/db/schema'

// StuffThatWorks-style insights: conditions / treatments / experiences.
//
// Ported from DatabaseService (src/lib/database.ts). The D1 schema is leaner
// than the original Firestore documents, so a few legacy fields have no column:
//   - conditions.member_count / summary   → not in schema (member_count sort &
//     increment become inert; search falls back to name/aliases/description)
//   - treatments.summary/warnings/submitted_by/status → only description maps
//   - condition_treatments.side_effects_avg → no column (dropped)
//   - experiences.side_effects/duration_weeks/tags/is_anonymous metadata that
//     has no column is dropped; effectiveness→rating, story→content,
//     helpful_count→upvotes
//   - experience_votes.kind ('helpful' | 'not_helpful') → value (+1 / -1)

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// ── Cohort matching (for the "people like me" study filter) ─────────────────
function ageBand(age: number | null | undefined): string {
  if (typeof age !== 'number' || !Number.isFinite(age)) return 'unknown'
  if (age < 20) return 'under-20'
  if (age < 30) return '20s'
  if (age < 40) return '30s'
  if (age < 50) return '40s'
  if (age < 60) return '50s'
  return '60-plus'
}

function genderOf(pronouns: string | null | undefined): string {
  const value = String(pronouns ?? '').toLowerCase()
  if (value.includes('she')) return 'female'
  if (value.includes('he')) return 'male'
  if (value.includes('they')) return 'nonbinary'
  return 'unknown'
}

export async function getConditions(ctx: Ctx, filters?: { category?: string; search?: string }) {
  const rows = await ctx.db.query.conditions.findMany()
  const items = rows.map((row) => ({ id: row.slug, ...row }))
  return items
    .filter((item) => !filters?.category || item.category === filters.category)
    .filter((item) => {
      if (!filters?.search) return true
      const aliases = Array.isArray(item.aliases) ? item.aliases.join(' ') : ''
      const haystack = `${item.name} ${aliases} ${item.description ?? ''}`.toLowerCase()
      return haystack.includes(filters.search.toLowerCase())
    })
    .sort((first, second) => (first.name ?? '').localeCompare(second.name ?? ''))
}

export async function getConditionCount(ctx: Ctx): Promise<number> {
  const [row] = await ctx.db.select({ value: sql<number>`count(*)` }).from(conditions)
  return Number(row?.value ?? 0)
}

export async function getCondition(ctx: Ctx, slug: string) {
  const direct = await ctx.db.query.conditions.findFirst({ where: eq(conditions.slug, slug) })
  if (direct) return { id: direct.slug, ...direct }

  // Alias/name fallback so /conditions/complex-ptsd resolves to the seeded /conditions/cptsd doc.
  const lowered = slug.toLowerCase()
  const all = await ctx.db.query.conditions.findMany()
  for (const row of all) {
    const name = String(row.name ?? '').toLowerCase()
    if (name === lowered) return { id: row.slug, ...row }
    const normalisedName = slugify(name)
    if (normalisedName === lowered) return { id: row.slug, ...row }
    if (Array.isArray(row.aliases)) {
      for (const alias of row.aliases) {
        if (typeof alias !== 'string') continue
        const aliasLower = alias.toLowerCase()
        const aliasSlug = slugify(aliasLower)
        if (aliasLower === lowered || aliasSlug === lowered) return { id: row.slug, ...row }
      }
    }
  }
  return null
}

export async function getTreatments(ctx: Ctx, filters?: { kind?: string }) {
  const rows = await ctx.db.query.treatments.findMany()
  return rows
    .map((row) => ({ id: row.slug, ...row }))
    .filter((item) => !filters?.kind || item.kind === filters.kind)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
}

export async function getTreatment(ctx: Ctx, slug: string) {
  const row = await ctx.db.query.treatments.findFirst({ where: eq(treatments.slug, slug) })
  if (!row) return null
  return { id: row.slug, ...row }
}

export async function createTreatment(
  ctx: Ctx,
  _userId: string,
  data: { name: string; kind: string; summary?: string }) {
  requireActor(ctx)
  const slug = slugify(data.name)
  const existing = await ctx.db.query.treatments.findFirst({ where: eq(treatments.slug, slug) })
  if (existing) return { id: slug, created: false }
  await ctx.db.insert(treatments).values({
    slug,
    name: data.name,
    kind: data.kind,
    description: data.summary ?? '',
  })
  return { id: slug, created: true }
}

export async function getTopTreatments(ctx: Ctx, conditionSlug: string, limitCount = 10) {
  const rows = await ctx.db.query.conditionTreatments.findMany({
    where: eq(conditionTreatments.conditionSlug, conditionSlug),
  })
  return Promise.all(
    rows
      .sort((a, b) => (b.effectivenessAvg ?? 0) - (a.effectivenessAvg ?? 0))
      .slice(0, limitCount)
      .map(async (row) => {
        const treatment = await ctx.db.query.treatments.findFirst({
          where: eq(treatments.slug, row.treatmentSlug),
        })
        return {
          ...row,
          treatment: treatment ? { id: treatment.slug, ...treatment } : null,
        }
      }))
}

/**
 * StuffThatWorks-style aggregated "study" for one condition: treatments ranked by
 * effectiveness, the most-reported symptoms and triggers, and the size of the
 * cohort those numbers are based on. Built from the structured condition_* tables
 * plus member experiences - the more people contribute, the more confident it gets.
 * Returns snake_case keys (the RPC layer snake-cases everything; the UI reads them).
 */
type StudyConfidenceLabel = 'Early signal' | 'Growing signal' | 'Well reported'
type RankRow = {
  slug: string
  name: string
  prevalence_pct: number | null
  sample_count?: number | null
  confidence_label?: StudyConfidenceLabel | null
}
type CountRow = {
  slug: string
  name: string
  count: number
  prevalence_pct: number | null
  sample_count?: number | null
  confidence_label?: StudyConfidenceLabel | null
}
type ReportSearchTreatment = {
  slug?: string | null
  name?: string | null
  effectiveness?: number | null
  side_effects?: string[] | null
}
type ReportSearchRow = {
  id: string
  conditionSlug?: string | null
  ageOfOnset?: number | null
  symptoms?: unknown
  triggers?: unknown
  comorbidities?: unknown
  tests?: unknown
  treatments?: unknown
  note?: string | null
  isSearchVisible?: unknown
  completionState?: string | null
  createdAt?: Date | string | null
  updatedAt?: Date | string | null
}
type ReportSearchFilters = {
  query?: string
  treatment?: string
  symptom?: string
  trigger?: string
  sideEffect?: string
  limit?: number
}
type ReportSearchResult = {
  id: string
  age_of_onset: number | null
  symptoms: string[]
  triggers: string[]
  comorbidities: string[]
  tests: string[]
  treatments: Array<{ slug: string; name: string; effectiveness: number | null; side_effects: string[] }>
  match_reasons: string[]
  is_anonymized: true
  updated_at: string | null
  created_at: string | null
}
type TreatmentEvidenceConditionRow = {
  slug?: string | null
  id?: string | null
  name?: string | null
  description?: string | null
  summary?: string | null
  category?: string | null
}
type TreatmentEvidenceSeedRow = {
  conditionSlug?: string | null
  condition_slug?: string | null
  treatmentSlug?: string | null
  treatment_slug?: string | null
  effectivenessAvg?: number | null
  effectiveness_avg?: number | null
  effectivenessCount?: number | null
  effectiveness_count?: number | null
}
type TreatmentEvidenceCondition = {
  slug: string
  name: string
  description: string | null
  category: string | null
  report_count: number
  effectiveness_avg: number
  side_effects: Array<{ name: string; count: number; prevalence_pct: number }>
  confidence_label: 'Early signal' | 'Growing signal' | 'Well reported'
  source_label: 'Member reports' | 'Experience ratings'
}
type TreatmentEvidenceReport = {
  id: string
  condition_slug: string
  condition_name: string
  effectiveness: number | null
  symptoms: string[]
  triggers: string[]
  side_effects: string[]
  updated_at: string | null
  created_at: string | null
  is_anonymized: true
}
type TreatmentEvidenceResult = {
  treatment_slug: string
  total_report_count: number
  condition_count: number
  overall_effectiveness_avg: number | null
  side_effects: Array<{ name: string; count: number; prevalence_pct: number }>
  conditions: TreatmentEvidenceCondition[]
  reports: TreatmentEvidenceReport[]
}
type ResearchQuestionRow = {
  id: string
  conditionSlug: string
  userId: string
  question: string
  detail: string
  status: string
  isAnonymous: boolean
  votesCount: number
  answersCount: number
  createdAt: Date | string | null
  updatedAt: Date | string | null
}
type ResearchQuestionVoteRow = {
  questionId: string
  userId: string
}
type ResearchQuestionAnswerRow = {
  id: string
  questionId: string
  userId: string
  answer: string
  isAnonymous: boolean
  createdAt: Date | string | null
  updatedAt: Date | string | null
}
type ResearchQuestionSummary = {
  id: string
  condition_slug: string
  question: string
  detail: string
  status: string
  is_anonymous: boolean
  votes_count: number
  answers_count: number
  has_voted: boolean
  created_at: string | null
  updated_at: string | null
  answers: Array<{
    id: string
    answer: string
    is_anonymous: boolean
    created_at: string | null
    updated_at: string | null
  }>
}

const cleanStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean)))
    : []

const normalizeSearch = (value: string): string => value.trim().toLowerCase()

const includesSearch = (value: string, token: string): boolean =>
  normalizeSearch(value).includes(token)

const displayLabel = (value: string): string => value.trim()

const storedBoolean = (value: unknown): boolean =>
  value === true || value === 1 || value === '1' || value === 'true'

function reportCanAppearInSearch(row: ReportSearchRow): boolean {
  return storedBoolean(row.isSearchVisible) && row.completionState !== 'draft'
}

function cleanReportTreatments(value: unknown): ReportSearchResult['treatments'] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => entry as ReportSearchTreatment)
    .map((entry) => {
      const name = String(entry.name ?? entry.slug ?? '').trim()
      const slug = slugify(String(entry.slug ?? name))
      return {
        slug,
        name,
        effectiveness: typeof entry.effectiveness === 'number' ? entry.effectiveness : null,
        side_effects: cleanStringList(entry.side_effects),
      }
    })
    .filter((entry) => entry.name.length > 0)
}

function dateString(value: Date | string | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

export function buildResearchQuestionSummaries(
  questionRows: ResearchQuestionRow[],
  answerRows: ResearchQuestionAnswerRow[] = [],
  voteRows: ResearchQuestionVoteRow[] = [],
  viewerId?: string | null): ResearchQuestionSummary[] {
  const answersByQuestion = new Map<string, ResearchQuestionAnswerRow[]>()
  for (const answer of answerRows) {
    const list = answersByQuestion.get(answer.questionId) ?? []
    list.push(answer)
    answersByQuestion.set(answer.questionId, list)
  }

  const votesByQuestion = new Map<string, Set<string>>()
  for (const vote of voteRows) {
    const set = votesByQuestion.get(vote.questionId) ?? new Set<string>()
    set.add(vote.userId)
    votesByQuestion.set(vote.questionId, set)
  }

  return questionRows
    .map((question) => {
      const votes = votesByQuestion.get(question.id)
      const answers = (answersByQuestion.get(question.id) ?? []).sort((first, second) =>
        String(second.createdAt ?? '').localeCompare(String(first.createdAt ?? '')))
      return {
        id: question.id,
        condition_slug: question.conditionSlug,
        question: question.question,
        detail: question.detail,
        status: question.status,
        is_anonymous: question.isAnonymous,
        votes_count: Math.max(question.votesCount ?? 0, votes?.size ?? 0),
        answers_count: Math.max(question.answersCount ?? 0, answers.length),
        has_voted: Boolean(viewerId && votes?.has(viewerId)),
        created_at: dateString(question.createdAt),
        updated_at: dateString(question.updatedAt),
        answers: answers.slice(0, 3).map((answer) => ({
          id: answer.id,
          answer: answer.answer,
          is_anonymous: answer.isAnonymous,
          created_at: dateString(answer.createdAt),
          updated_at: dateString(answer.updatedAt),
        })),
      }
    })
    .sort(
      (first, second) =>
        second.votes_count - first.votes_count ||
        second.answers_count - first.answers_count ||
        String(second.created_at ?? '').localeCompare(String(first.created_at ?? '')))
}

function reasonFromList(label: string, list: string[], token: string): string | null {
  const match = list.find((item) => includesSearch(item, token))
  return match ? `${label}: ${displayLabel(match)}` : null
}

function reportSearchText(report: ReportSearchRow, treatmentsList: ReportSearchResult['treatments']): string {
  return [
    ...cleanStringList(report.symptoms), ...cleanStringList(report.triggers), ...cleanStringList(report.comorbidities), ...cleanStringList(report.tests), ...treatmentsList.flatMap((entry) => [entry.name, ...entry.side_effects]),
    report.note ?? '',
  ]
    .join(' ')
    .toLowerCase()
}

function reportMatchReasons(
  report: ReportSearchRow,
  filters: ReportSearchFilters,
  treatmentsList: ReportSearchResult['treatments']): string[] | null {
  const reasons: string[] = []
  const symptomToken = normalizeSearch(filters.symptom ?? '')
  const triggerToken = normalizeSearch(filters.trigger ?? '')
  const treatmentToken = normalizeSearch(filters.treatment ?? '')
  const sideEffectToken = normalizeSearch(filters.sideEffect ?? '')
  const queryToken = normalizeSearch(filters.query ?? '')

  if (symptomToken) {
    const reason = reasonFromList('Symptom', cleanStringList(report.symptoms), symptomToken)
    if (!reason) return null
    reasons.push(reason)
  }

  if (triggerToken) {
    const reason = reasonFromList('Trigger', cleanStringList(report.triggers), triggerToken)
    if (!reason) return null
    reasons.push(reason)
  }

  if (treatmentToken) {
    const match = treatmentsList.find((entry) => includesSearch(entry.name, treatmentToken) || includesSearch(entry.slug, treatmentToken))
    if (!match) return null
    reasons.push(`Treatment: ${match.name}`)
  }

  if (sideEffectToken) {
    const match = treatmentsList
      .flatMap((entry) => entry.side_effects)
      .find((sideEffect) => includesSearch(sideEffect, sideEffectToken))
    if (!match) return null
    reasons.push(`Side effect: ${displayLabel(match)}`)
  }

  if (queryToken) {
    const text = reportSearchText(report, treatmentsList)
    if (!text.includes(queryToken)) return null
    const directReason =
      reasonFromList('Symptom', cleanStringList(report.symptoms), queryToken) ??
      reasonFromList('Trigger', cleanStringList(report.triggers), queryToken) ??
      reasonFromList('Co-existing condition', cleanStringList(report.comorbidities), queryToken) ??
      reasonFromList('Test', cleanStringList(report.tests), queryToken)
    const treatmentMatch = treatmentsList.find((entry) => includesSearch(entry.name, queryToken) || includesSearch(entry.slug, queryToken))
    const sideEffectMatch = treatmentsList.flatMap((entry) => entry.side_effects).find((sideEffect) => includesSearch(sideEffect, queryToken))
    reasons.push(directReason ?? (treatmentMatch ? `Treatment: ${treatmentMatch.name}` : sideEffectMatch ? `Side effect: ${sideEffectMatch}` : 'Matched report details'))
  }

  return Array.from(new Set(reasons))
}

export function filterConditionReportsForSearch(
  rows: ReportSearchRow[],
  filters: ReportSearchFilters = {}): ReportSearchResult[] {
  const limit = Math.max(1, Math.min(filters.limit ?? 12, 50))
  return rows
    .filter(reportCanAppearInSearch)
    .map((row) => {
      const treatmentsList = cleanReportTreatments(row.treatments)
      const matchReasons = reportMatchReasons(row, filters, treatmentsList)
      if (matchReasons === null) return null
      return {
        id: row.id,
        age_of_onset: typeof row.ageOfOnset === 'number' ? row.ageOfOnset : null,
        symptoms: cleanStringList(row.symptoms),
        triggers: cleanStringList(row.triggers),
        comorbidities: cleanStringList(row.comorbidities),
        tests: cleanStringList(row.tests),
        treatments: treatmentsList,
        match_reasons: matchReasons,
        is_anonymized: true as const,
        updated_at: dateString(row.updatedAt),
        created_at: dateString(row.createdAt),
      }
    })
    .filter((row): row is ReportSearchResult => Boolean(row))
    .sort((first, second) => String(second.updated_at ?? second.created_at ?? '').localeCompare(String(first.updated_at ?? first.created_at ?? '')))
    .slice(0, limit)
}

export const studyConfidenceLabel = (count: number): StudyConfidenceLabel => {
  if (count >= 20) return 'Well reported'
  if (count >= 5) return 'Growing signal'
  return 'Early signal'
}

const average = (values: number[]): number | null => {
  if (values.length === 0) return null
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
}

const conditionSlugFromSeed = (row: TreatmentEvidenceSeedRow) =>
  String(row.conditionSlug ?? row.condition_slug ?? '').trim()

const seedTreatmentSlug = (row: TreatmentEvidenceSeedRow) =>
  slugify(String(row.treatmentSlug ?? row.treatment_slug ?? ''))

const seedAvg = (row: TreatmentEvidenceSeedRow) =>
  typeof row.effectivenessAvg === 'number'
    ? row.effectivenessAvg
    : typeof row.effectiveness_avg === 'number'
      ? row.effectiveness_avg
      : 0

const seedCount = (row: TreatmentEvidenceSeedRow) =>
  typeof row.effectivenessCount === 'number'
    ? row.effectivenessCount
    : typeof row.effectiveness_count === 'number'
      ? row.effectiveness_count
      : 0

const countSideEffects = (
  sideEffects: string[],
  denominator: number): Array<{ name: string; count: number; prevalence_pct: number }> => {
  const counts = new Map<string, { name: string; count: number }>()
  for (const sideEffect of sideEffects) {
    const clean = sideEffect.trim()
    if (!clean) continue
    const key = clean.toLowerCase()
    const current = counts.get(key) ?? { name: clean, count: 0 }
    current.count += 1
    counts.set(key, current)
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map((row) => ({
      name: row.name,
      count: row.count,
      prevalence_pct: denominator > 0 ? Math.round((row.count / denominator) * 100) : 0,
    }))
}

export function buildTreatmentEvidence(
  treatmentSlugInput: string,
  reports: ReportSearchRow[],
  conditionRows: TreatmentEvidenceConditionRow[] = [],
  seededRows: TreatmentEvidenceSeedRow[] = []): TreatmentEvidenceResult {
  const treatmentSlug = slugify(treatmentSlugInput)
  const conditionBySlug = new Map(
    conditionRows.map((condition) => {
      const slug = String(condition.slug ?? condition.id ?? '').trim()
      return [
        slug,
        {
          slug,
          name: String(condition.name ?? slug).trim() || slug,
          description: (condition.description as string | null | undefined) ?? (condition.summary as string | null | undefined) ?? null,
          category: (condition.category as string | null | undefined) ?? null,
        },
      ]
    }))
  const byCondition = new Map<
    string,
    {
      condition_slug: string
      effectiveness: number[]
      side_effects: string[]
      reports: TreatmentEvidenceReport[]
    }
  >()

  const getGroup = (conditionSlug: string) => {
    const existing = byCondition.get(conditionSlug)
    if (existing) return existing
    const group = { condition_slug: conditionSlug, effectiveness: [], side_effects: [], reports: [] }
    byCondition.set(conditionSlug, group)
    return group
  }

  for (const report of reports) {
    const conditionSlug = String(report.conditionSlug ?? '').trim()
    if (!conditionSlug) continue
    const treatmentsList = cleanReportTreatments(report.treatments)
    const match = treatmentsList.find(
      (entry) => entry.slug === treatmentSlug || slugify(entry.name) === treatmentSlug)
    if (!match) continue
    const group = getGroup(conditionSlug)
    if (typeof match.effectiveness === 'number') group.effectiveness.push(match.effectiveness)
    group.side_effects.push(...match.side_effects)
    const condition = conditionBySlug.get(conditionSlug)
    group.reports.push({
      id: report.id,
      condition_slug: conditionSlug,
      condition_name: condition?.name ?? conditionSlug,
      effectiveness: match.effectiveness,
      symptoms: cleanStringList(report.symptoms),
      triggers: cleanStringList(report.triggers),
      side_effects: match.side_effects,
      updated_at: dateString(report.updatedAt),
      created_at: dateString(report.createdAt),
      is_anonymized: true,
    })
  }

  const conditionsFromReports: TreatmentEvidenceCondition[] = [...byCondition.values()].map((group) => {
    const condition = conditionBySlug.get(group.condition_slug)
    const reportCount = group.reports.length
    return {
      slug: group.condition_slug,
      name: condition?.name ?? group.condition_slug,
      description: condition?.description ?? null,
      category: condition?.category ?? null,
      report_count: reportCount,
      effectiveness_avg: average(group.effectiveness) ?? 0,
      side_effects: countSideEffects(group.side_effects, reportCount),
      confidence_label: studyConfidenceLabel(reportCount),
      source_label: 'Member reports',
    }
  })

  const reportConditionSlugs = new Set(conditionsFromReports.map((condition) => condition.slug))
  const conditionsFromSeeds: TreatmentEvidenceCondition[] = seededRows
    .filter((row) => seedTreatmentSlug(row) === treatmentSlug)
    .map((row) => {
      const conditionSlug = conditionSlugFromSeed(row)
      const condition = conditionBySlug.get(conditionSlug)
      return {
        slug: conditionSlug,
        name: condition?.name ?? conditionSlug,
        description: condition?.description ?? null,
        category: condition?.category ?? null,
        report_count: seedCount(row),
        effectiveness_avg: Number(seedAvg(row).toFixed(2)),
        side_effects: [],
        confidence_label: studyConfidenceLabel(seedCount(row)),
        source_label: 'Experience ratings',
      } satisfies TreatmentEvidenceCondition
    })
    .filter((condition) => condition.slug && !reportConditionSlugs.has(condition.slug) && condition.report_count > 0)

  const conditions = [...conditionsFromReports, ...conditionsFromSeeds].sort(
    (a, b) =>
      b.report_count - a.report_count ||
      b.effectiveness_avg - a.effectiveness_avg ||
      a.name.localeCompare(b.name))
  const matchedReports = [...byCondition.values()].flatMap((group) => group.reports)
  const reportEffectiveness = matchedReports
    .map((report) => report.effectiveness)
    .filter((value): value is number => typeof value === 'number')

  return {
    treatment_slug: treatmentSlug,
    total_report_count: matchedReports.length,
    condition_count: conditions.length,
    overall_effectiveness_avg: average(reportEffectiveness),
    side_effects: countSideEffects(
      matchedReports.flatMap((report) => report.side_effects),
      matchedReports.length),
    conditions,
    reports: matchedReports
      .sort((first, second) => String(second.updated_at ?? second.created_at ?? '').localeCompare(String(first.updated_at ?? first.created_at ?? '')))
      .slice(0, 8),
  }
}

export async function getConditionStudy(
  ctx: Ctx,
  conditionSlug: string,
  opts?: { cohort?: 'all' | 'similar' }) {
  const condition = await getCondition(ctx, conditionSlug)
  if (!condition) return null
  const slug = condition.slug

  const [
    treatRows,
    symptomRows,
    triggerRows,
    testRows,
    expRowsAll,
    reportRowsAll,
    allTreatments,
    allSymptoms,
    allTriggers,
    allTests,
    allProfiles,
  ] = await Promise.all([
    ctx.db.query.conditionTreatments.findMany({ where: eq(conditionTreatments.conditionSlug, slug) }),
    ctx.db.query.conditionSymptoms.findMany({ where: eq(conditionSymptoms.conditionSlug, slug) }),
    ctx.db.query.conditionTriggers.findMany({ where: eq(conditionTriggers.conditionSlug, slug) }),
    ctx.db.query.conditionTests.findMany({ where: eq(conditionTests.conditionSlug, slug) }),
    ctx.db.query.experiences.findMany({ where: eq(experiences.conditionSlug, slug) }),
    ctx.db.query.conditionReports.findMany({ where: eq(conditionReports.conditionSlug, slug) }),
    ctx.db.query.treatments.findMany(),
    ctx.db.query.symptoms.findMany(),
    ctx.db.query.triggers.findMany(),
    ctx.db.query.tests.findMany(),
    ctx.db.query.profiles.findMany(),
  ])

  // Cohort filter: "people like me" narrows member-derived rows (reports,
  // experiences, comorbidity profiles) to contributors in the viewer's age band
  // and gender. Seeded baselines remain so the view is never empty.
  const cohortMode: 'all' | 'similar' = opts?.cohort === 'similar' ? 'similar' : 'all'
  let expRows = expRowsAll
  let reportRows = reportRowsAll
  let cohortProfileMatch: ((userId: string) => boolean) | null = null
  if (cohortMode === 'similar' && ctx.userId) {
    const me = allProfiles.find((p) => p.userId === ctx.userId)
    if (me) {
      const myBand = ageBand(me.age)
      const myGender = genderOf(me.pronouns)
      const profileById = new Map(allProfiles.map((p) => [p.userId, p]))
      cohortProfileMatch = (userId: string) => {
        const p = profileById.get(userId)
        if (!p) return false
        return ageBand(p.age) === myBand && genderOf(p.pronouns) === myGender
      }
      expRows = expRowsAll.filter((e) => cohortProfileMatch!(e.userId))
      reportRows = reportRowsAll.filter((r) => cohortProfileMatch!(r.userId))
    }
  }

  const treatmentById = new Map(allTreatments.map((t) => [t.slug, t]))
  const symptomName = new Map(allSymptoms.map((s) => [s.slug, s.name]))
  const triggerName = new Map(allTriggers.map((t) => [t.slug, t.name]))
  const testName = new Map(allTests.map((t) => [t.slug, t.name]))
  const reportCount = reportRows.length

  // Merge live member-report counts (over reportCount) with a seeded baseline,
  // deduped by display name. Reports win where present.
  const rankMerged = (
    field: (r: (typeof reportRows)[number]) => unknown,
    seeds: { name: string; prevalence: number | null }[]): RankRow[] => {
    const byName = new Map<string, { name: string; pct: number | null; count: number | null }>()
    if (reportCount > 0) {
      const counts = new Map<string, { name: string; n: number }>()
      for (const report of reportRows) {
        const list = field(report)
        if (!Array.isArray(list)) continue
        for (const raw of list) {
          const name = String(raw).trim()
          if (!name) continue
          const key = name.toLowerCase()
          const cur = counts.get(key) ?? { name, n: 0 }
          cur.n += 1
          counts.set(key, cur)
        }
      }
      for (const [key, { name, n }] of counts) {
        byName.set(key, { name, pct: Math.round((n / reportCount) * 100), count: n })
      }
    }
    for (const seed of seeds) {
      const key = seed.name.toLowerCase()
      if (!byName.has(key)) {
        byName.set(key, { name: seed.name, pct: seed.prevalence != null ? Math.round(seed.prevalence * 100) : null, count: null })
      }
    }
    return [...byName.values()]
      .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
      .slice(0, 12)
      .map((it) => ({
        slug: slugify(it.name),
        name: it.name,
        prevalence_pct: it.pct,
        sample_count: it.count,
        confidence_label: it.count == null ? null : studyConfidenceLabel(it.count),
      }))
  }

  const topSymptoms = rankMerged(
    (r) => r.symptoms,
    symptomRows.map((row) => ({ name: symptomName.get(row.symptomSlug) ?? row.symptomSlug, prevalence: row.prevalence ?? null })))
  const topTriggers = rankMerged(
    (r) => r.triggers,
    triggerRows.map((row) => ({ name: triggerName.get(row.triggerSlug) ?? row.triggerSlug, prevalence: row.prevalence ?? null })))
  const topTests = rankMerged(
    (r) => r.tests,
    testRows.map((row) => ({ name: testName.get(row.testSlug) ?? row.testSlug, prevalence: row.prevalence ?? null })))

  // Co-existing conditions: members who list this condition (profiles) + survey reports.
  const nameLower = String(condition.name ?? '').toLowerCase()
  const listsThisCondition = (list: unknown) =>
    Array.isArray(list) &&
    list.some((entry) => {
      const value = String(entry).toLowerCase().trim()
      return value === slug || value === nameLower || slugify(value) === slug
    })
  const memberProfiles = allProfiles.filter(
    (profile) =>
      listsThisCondition(profile.conditions) && (!cohortProfileMatch || cohortProfileMatch(profile.userId)))
  const comorbidityCounts = new Map<string, { name: string; n: number }>()
  const bumpCount = (target: Map<string, { name: string; n: number }>, raw: unknown) => {
    const name = String(raw).trim()
    if (!name) return
    const key = name.toLowerCase()
    const cur = target.get(key) ?? { name, n: 0 }
    cur.n += 1
    target.set(key, cur)
  }
  for (const profile of memberProfiles)
    for (const entry of Array.isArray(profile.comorbidities) ? profile.comorbidities : []) bumpCount(comorbidityCounts, entry)
  for (const report of reportRows)
    for (const entry of Array.isArray(report.comorbidities) ? report.comorbidities : []) bumpCount(comorbidityCounts, entry)
  const comorbidityBase = Math.max(memberProfiles.length, reportCount, 1)
  const topComorbidities: CountRow[] = [...comorbidityCounts.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 12)
    .map((c) => ({
      slug: slugify(c.name),
      name: c.name,
      count: c.n,
      prevalence_pct: Math.round((c.n / comorbidityBase) * 100),
      sample_count: c.n,
      confidence_label: studyConfidenceLabel(c.n),
    }))

  // Side effects reported across treatments.
  const sideEffectCounts = new Map<string, { name: string; n: number }>()
  const treatStats = new Map<string, { sum: number; n: number }>()
  for (const report of reportRows) {
    const list = Array.isArray(report.treatments) ? report.treatments : []
    for (const entry of list) {
      for (const se of Array.isArray(entry?.side_effects) ? entry.side_effects : []) bumpCount(sideEffectCounts, se)
      if (entry?.slug && typeof entry.effectiveness === 'number') {
        const cur = treatStats.get(entry.slug) ?? { sum: 0, n: 0 }
        cur.sum += entry.effectiveness
        cur.n += 1
        treatStats.set(entry.slug, cur)
      }
    }
  }
  const topSideEffects: CountRow[] = [...sideEffectCounts.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 12)
    .map((s) => ({
      slug: slugify(s.name),
      name: s.name,
      count: s.n,
      prevalence_pct: reportCount > 0 ? Math.round((s.n / reportCount) * 100) : null,
      sample_count: s.n,
      confidence_label: studyConfidenceLabel(s.n),
    }))

  // Treatments: keep the seeded clinical-evidence baseline SEPARATE from member
  // reports so counts stay honest. The evidence baseline acts as a prior; member
  // reports blend in and move the score, but `report_count` only ever reflects
  // real member reports (never the seeded weight). `evidence_based` marks rows
  // that carry a clinical baseline, so the UI can label them truthfully.
  const treatMap = new Map<
    string,
    { slug: string; evidenceAvg: number; evidenceWeight: number; memberSum: number; memberN: number }
  >()
  for (const row of treatRows)
    treatMap.set(row.treatmentSlug, {
      slug: row.treatmentSlug,
      evidenceAvg: row.effectivenessAvg ?? 0,
      evidenceWeight: row.effectivenessCount ?? 0,
      memberSum: 0,
      memberN: 0,
    })
  for (const [tslug, stat] of treatStats) {
    const cur =
      treatMap.get(tslug) ?? { slug: tslug, evidenceAvg: 0, evidenceWeight: 0, memberSum: 0, memberN: 0 }
    cur.memberSum += stat.sum
    cur.memberN += stat.n
    treatMap.set(tslug, cur)
  }
  const topTreatments = [...treatMap.values()]
    .map((t) => {
      const totalWeight = t.evidenceWeight + t.memberN
      const avg = totalWeight > 0 ? (t.evidenceAvg * t.evidenceWeight + t.memberSum) / totalWeight : 0
      const treatment = treatmentById.get(t.slug)
      return {
        slug: t.slug,
        name: treatment?.name ?? t.slug,
        kind: treatment?.kind ?? null,
        effectiveness_avg: Number(avg.toFixed(2)),
        effectiveness_score: Math.round((avg / 5) * 100),
        report_count: t.memberN,
        sample_count: t.memberN,
        evidence_based: t.evidenceWeight > 0,
        confidence_label: t.memberN > 0 ? studyConfidenceLabel(t.memberN) : null,
      }
    })
    .sort((a, b) => b.effectiveness_avg - a.effectiveness_avg)
    .slice(0, 30)

  // Median age of onset from reports.
  const onsets = reportRows
    .map((r) => r.ageOfOnset)
    .filter((a): a is number => typeof a === 'number')
    .sort((a, b) => a - b)
  const ageOfOnsetMedian = onsets.length ? onsets[Math.floor(onsets.length / 2)] : null

  const cohort = new Set<string>([
    ...expRows.map((e) => e.userId), ...reportRows.map((r) => r.userId), ...memberProfiles.map((p) => p.userId),
  ])

  return {
    condition,
    cohort: cohortMode,
    member_count: cohort.size,
    report_count: reportCount,
    // How many treatments carry a clinical-evidence baseline (independent of any
    // member reports), lets the UI show "evidence-based" framing on day one.
    evidence_count: treatRows.length,
    confidence_label: studyConfidenceLabel(reportCount),
    experience_count: expRows.length,
    age_of_onset_median: ageOfOnsetMedian,
    top_treatments: topTreatments,
    top_symptoms: topSymptoms,
    top_triggers: topTriggers,
    top_tests: topTests,
    top_comorbidities: topComorbidities,
    top_side_effects: topSideEffects,
  }
}

/**
 * Save a member's structured contribution for a condition (the survey that powers
 * the aggregated study). Upserts one report per member per condition; the client
 * userId arg is ignored - the actor comes from the session.
 */
export async function submitConditionReport(
  ctx: Ctx,
  _userId: string,
  data: {
    conditionSlug: string
    ageOfOnset?: number | null
    symptoms?: string[]
    triggers?: string[]
    comorbidities?: string[]
    tests?: string[]
    treatments?: { slug?: string; name: string; effectiveness: number | null; side_effects?: string[] }[]
    note?: string | null
    isSearchVisible?: boolean
    completionState?: 'draft' | 'complete' | string | null
  }) {
  const actor = requireActor(ctx)
  const conditionSlug = String(data.conditionSlug || '').trim()
  if (!conditionSlug) throw new Error('conditionSlug is required')

  const clean = (list?: string[]) =>
    Array.from(new Set((list ?? []).map((s) => String(s).trim()).filter(Boolean)))
  const symptomsList = clean(data.symptoms)
  const triggersList = clean(data.triggers)
  const comorbiditiesList = clean(data.comorbidities)
  const testsList = clean(data.tests)
  const treatmentsList = (data.treatments ?? [])
    .filter((t) => t && String(t.name ?? '').trim())
    .map((t) => ({
      slug: slugify(String(t.slug || t.name)),
      name: String(t.name).trim(),
      effectiveness: typeof t.effectiveness === 'number' ? t.effectiveness : null,
      side_effects: clean(t.side_effects),
    }))
  const completionState = data.completionState === 'draft' ? 'draft' : 'complete'

  // Keep the lexicon tables populated so names resolve in the study.
  const ensure = async (
    table: typeof symptoms | typeof triggers | typeof tests | typeof treatments,
    name: string) => {
    const s = slugify(name)
    if (!s) return
    const existing = await ctx.db.select().from(table).where(eq(table.slug, s)).limit(1)
    if (existing.length === 0) await ctx.db.insert(table).values({ slug: s, name }).onConflictDoNothing()
  }
  await Promise.all([
    ...symptomsList.map((n) => ensure(symptoms, n)), ...triggersList.map((n) => ensure(triggers, n)), ...testsList.map((n) => ensure(tests, n)), ...treatmentsList.map((t) => ensure(treatments, t.name)),
  ])

  const values = {
    userId: actor,
    conditionSlug,
    ageOfOnset: typeof data.ageOfOnset === 'number' ? data.ageOfOnset : null,
    symptoms: symptomsList,
    triggers: triggersList,
    comorbidities: comorbiditiesList,
    tests: testsList,
    treatments: treatmentsList,
    note: data.note ? String(data.note) : null,
    isSearchVisible: completionState === 'complete' && data.isSearchVisible === true,
    completionState,
    updatedAt: new Date(),
  }

  await ctx.db
    .insert(conditionReports)
    .values(values)
    .onConflictDoUpdate({ target: [conditionReports.userId, conditionReports.conditionSlug], set: values })

  return { ok: true, conditionSlug }
}

export function formatConditionReportForEditing(row: ReportSearchRow) {
  return {
    id: row.id,
    condition_slug: row.conditionSlug ?? null,
    age_of_onset: typeof row.ageOfOnset === 'number' ? row.ageOfOnset : null,
    symptoms: cleanStringList(row.symptoms),
    triggers: cleanStringList(row.triggers),
    comorbidities: cleanStringList(row.comorbidities),
    tests: cleanStringList(row.tests),
    treatments: cleanReportTreatments(row.treatments),
    note: row.note ?? '',
    is_search_visible: reportCanAppearInSearch(row),
    completion_state: row.completionState === 'draft' ? 'draft' : 'complete',
    updated_at: dateString(row.updatedAt),
    created_at: dateString(row.createdAt),
  }
}

export async function getMyConditionReport(ctx: Ctx, conditionSlug: string) {
  const actor = requireActor(ctx)
  const condition = await getCondition(ctx, conditionSlug)
  if (!condition) return { condition: null, report: null }

  const row = await ctx.db.query.conditionReports.findFirst({
    where: and(eq(conditionReports.userId, actor), eq(conditionReports.conditionSlug, condition.slug)),
  })

  return {
    condition,
    report: row ? formatConditionReportForEditing(row) : null,
  }
}

export async function searchConditionReports(
  ctx: Ctx,
  conditionSlug: string,
  filters?: ReportSearchFilters) {
  const condition = await getCondition(ctx, conditionSlug)
  if (!condition) return { condition: null, reports: [], total: 0 }
  const rows = await ctx.db.query.conditionReports.findMany({
    where: eq(conditionReports.conditionSlug, condition.slug),
    orderBy: [desc(conditionReports.updatedAt)],
    limit: 300,
  })
  const reports = filterConditionReportsForSearch(rows, filters ?? {})
  return {
    condition,
    reports,
    total: reports.length,
    is_anonymized: true,
  }
}

export async function getConditionResearchQuestions(
  ctx: Ctx,
  conditionSlug: string,
  limitCount = 12) {
  const condition = await getCondition(ctx, conditionSlug)
  if (!condition) return { condition: null, questions: [], total: 0 }

  const questionRows = await ctx.db.query.conditionResearchQuestions.findMany({
    where: eq(conditionResearchQuestions.conditionSlug, condition.slug),
    orderBy: [desc(conditionResearchQuestions.createdAt)],
    limit: Math.max(1, Math.min(limitCount, 50)),
  })

  if (questionRows.length === 0) {
    return { condition, questions: [], total: 0 }
  }

  const questionIds = questionRows.map((question) => question.id)
  const [answerRows, voteRows] = await Promise.all([
    ctx.db.query.conditionResearchQuestionAnswers.findMany({
      where: inArray(conditionResearchQuestionAnswers.questionId, questionIds),
      orderBy: [desc(conditionResearchQuestionAnswers.createdAt)],
      limit: 200,
    }),
    ctx.db.query.conditionResearchQuestionVotes.findMany({
      where: inArray(conditionResearchQuestionVotes.questionId, questionIds),
    }),
  ])

  const questions = buildResearchQuestionSummaries(questionRows, answerRows, voteRows, ctx.userId)
  return { condition, questions, total: questions.length }
}

export async function createConditionResearchQuestion(
  ctx: Ctx,
  conditionSlug: string,
  data: { question: string; detail?: string | null; isAnonymous?: boolean }) {
  const actor = requireActor(ctx)
  const condition = await getCondition(ctx, conditionSlug)
  if (!condition) throw new Error('Condition not found')

  const question = String(data.question ?? '').trim().slice(0, 220)
  const detail = String(data.detail ?? '').trim().slice(0, 1000)
  if (question.length < 8) throw new Error('Question is too short')

  const id = crypto.randomUUID()
  await ctx.db.insert(conditionResearchQuestions).values({
    id,
    conditionSlug: condition.slug,
    userId: actor,
    question,
    detail,
    status: 'open',
    isAnonymous: Boolean(data.isAnonymous),
    votesCount: 0,
    answersCount: 0,
  })
  return { id, conditionSlug: condition.slug }
}

export async function voteConditionResearchQuestion(ctx: Ctx, questionId: string) {
  const actor = requireActor(ctx)
  const question = await ctx.db.query.conditionResearchQuestions.findFirst({
    where: eq(conditionResearchQuestions.id, questionId),
  })
  if (!question) throw new Error('Research question not found')

  const existing = await ctx.db.query.conditionResearchQuestionVotes.findFirst({
    where: and(
      eq(conditionResearchQuestionVotes.questionId, questionId),
      eq(conditionResearchQuestionVotes.userId, actor)),
  })

  if (existing) {
    await ctx.db
      .delete(conditionResearchQuestionVotes)
      .where(eq(conditionResearchQuestionVotes.id, existing.id))
    await ctx.db
      .update(conditionResearchQuestions)
      .set({
        votesCount: sql`max(${conditionResearchQuestions.votesCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(conditionResearchQuestions.id, questionId))
    return { id: questionId, voted: false }
  }

  await ctx.db.insert(conditionResearchQuestionVotes).values({
    id: crypto.randomUUID(),
    questionId,
    userId: actor,
  })
  await ctx.db
    .update(conditionResearchQuestions)
    .set({
      votesCount: sql`${conditionResearchQuestions.votesCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(conditionResearchQuestions.id, questionId))
  return { id: questionId, voted: true }
}

export async function answerConditionResearchQuestion(
  ctx: Ctx,
  questionId: string,
  data: { answer: string; isAnonymous?: boolean }) {
  const actor = requireActor(ctx)
  const question = await ctx.db.query.conditionResearchQuestions.findFirst({
    where: eq(conditionResearchQuestions.id, questionId),
  })
  if (!question) throw new Error('Research question not found')

  const answer = String(data.answer ?? '').trim().slice(0, 2000)
  if (answer.length < 3) throw new Error('Answer is too short')

  const id = crypto.randomUUID()
  await ctx.db.insert(conditionResearchQuestionAnswers).values({
    id,
    questionId,
    userId: actor,
    answer,
    isAnonymous: Boolean(data.isAnonymous),
  })
  await ctx.db
    .update(conditionResearchQuestions)
    .set({
      answersCount: sql`${conditionResearchQuestions.answersCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(conditionResearchQuestions.id, questionId))
  return { id, questionId }
}

export async function getConditionsForTreatment(ctx: Ctx, treatmentSlug: string, limitCount = 10) {
  const rows = await ctx.db.query.conditionTreatments.findMany({
    where: eq(conditionTreatments.treatmentSlug, treatmentSlug),
  })
  return Promise.all(
    rows
      .sort((a, b) => (b.effectivenessAvg ?? 0) - (a.effectivenessAvg ?? 0))
      .slice(0, limitCount)
      .map(async (row) => {
        const condition = await ctx.db.query.conditions.findFirst({
          where: eq(conditions.slug, row.conditionSlug),
        })
        return {
          ...row,
          condition: condition ? { id: condition.slug, ...condition } : null,
        }
      }))
}

export async function getTreatmentEvidence(ctx: Ctx, treatmentSlug: string) {
  const treatment = await getTreatment(ctx, treatmentSlug)
  if (!treatment) {
    return null
  }
  const [reportRows, conditionRows, seededRows] = await Promise.all([
    ctx.db.query.conditionReports.findMany({
      orderBy: [desc(conditionReports.updatedAt)],
      limit: 500,
    }),
    ctx.db.query.conditions.findMany(),
    ctx.db.query.conditionTreatments.findMany({
      where: eq(conditionTreatments.treatmentSlug, treatment.id),
    }),
  ])
  return {
    treatment, ...buildTreatmentEvidence(treatment.id, reportRows, conditionRows, seededRows),
  }
}

export async function createExperience(
  ctx: Ctx,
  _userId: string,
  data: {
    condition_slug: string
    treatment_slug: string
    effectiveness: number
    side_effects?: number
    duration_weeks?: number
    story?: string
    is_anonymous?: boolean
    tags?: string[]
  }) {
  const actor = requireActor(ctx)
  const id = crypto.randomUUID()
  await ctx.db.insert(experiences).values({
    id,
    userId: actor,
    conditionSlug: data.condition_slug,
    treatmentSlug: data.treatment_slug,
    rating: data.effectiveness,
    content: data.story ?? '',
    isAnonymous: Boolean(data.is_anonymous),
    upvotes: 0,
  })

  await recomputeConditionTreatment(ctx, data.condition_slug, data.treatment_slug)

  // member_count has no column in the D1 schema, so the "first share" increment
  // from the original is inert. We still mirror the prior-count query as a no-op.

  return { id }
}

export async function recomputeConditionTreatment(
  ctx: Ctx,
  conditionSlug: string,
  treatmentSlug: string) {
  const rows = await ctx.db.query.experiences.findMany({
    where: and(
      eq(experiences.conditionSlug, conditionSlug),
      eq(experiences.treatmentSlug, treatmentSlug)),
  })
  const count = rows.length
  if (count === 0) return
  const effectivenessAvg =
    rows.reduce((total, row) => total + (row.rating ?? 0), 0) / count

  const values = {
    conditionSlug,
    treatmentSlug,
    effectivenessAvg: Number(effectivenessAvg.toFixed(2)),
    effectivenessCount: count,
    updatedAt: new Date(),
  }

  const existing = await ctx.db.query.conditionTreatments.findFirst({
    where: and(
      eq(conditionTreatments.conditionSlug, conditionSlug),
      eq(conditionTreatments.treatmentSlug, treatmentSlug)),
  })
  if (existing) {
    await ctx.db
      .update(conditionTreatments)
      .set(values)
      .where(eq(conditionTreatments.id, existing.id))
  } else {
    await ctx.db.insert(conditionTreatments).values(values)
  }
}

export async function getExperiencesForCondition(
  ctx: Ctx,
  conditionSlug: string,
  options?: { treatment_slug?: string; limit?: number }) {
  const rows = await ctx.db.query.experiences.findMany({
    where: eq(experiences.conditionSlug, conditionSlug),
    orderBy: [desc(experiences.createdAt)],
  })
  const hydrated = await Promise.all(
    rows
      .filter((row) => !options?.treatment_slug || row.treatmentSlug === options.treatment_slug)
      .map(async (row) => {
        const profile = row.isAnonymous ? null : await getProfileSummary(ctx.db, row.userId)
        return { ...row, profile }
      }))
  return hydrated.slice(0, options?.limit ?? 20)
}

export async function voteOnExperience(
  ctx: Ctx,
  _userId: string,
  experienceId: string,
  kind: 'helpful' | 'not_helpful') {
  const actor = requireActor(ctx)
  const value = kind === 'helpful' ? 1 : -1

  const existing = await ctx.db.query.experienceVotes.findFirst({
    where: and(
      eq(experienceVotes.experienceId, experienceId),
      eq(experienceVotes.userId, actor)),
  })

  if (existing && existing.value === value) {
    // Already voted the same way - remove the vote and undo the count change.
    await ctx.db.delete(experienceVotes).where(eq(experienceVotes.id, existing.id))
    await ctx.db
      .update(experiences)
      .set({ upvotes: sql`${experiences.upvotes} - ${value}` })
      .where(eq(experiences.id, experienceId))
    return { vote: null }
  }

  if (existing) {
    // Switching vote direction: undo the previous value, then apply the new one.
    await ctx.db
      .update(experienceVotes)
      .set({ value })
      .where(eq(experienceVotes.id, existing.id))
    await ctx.db
      .update(experiences)
      .set({ upvotes: sql`${experiences.upvotes} - ${existing.value} + ${value}` })
      .where(eq(experiences.id, experienceId))
    return { vote: kind }
  }

  await ctx.db.insert(experienceVotes).values({
    experienceId,
    userId: actor,
    value,
  })
  await ctx.db
    .update(experiences)
    .set({ upvotes: sql`${experiences.upvotes} + ${value}` })
    .where(eq(experiences.id, experienceId))
  return { vote: kind }
}

export async function getFeaturedInsights(ctx: Ctx, limitCount = 6) {
  // Trending = most community activity (reports + experiences + discussion).
  // All-time counts so the list is never empty at low data volumes.
  const [allConditions, reportRows, expRows, commentRows, treatRows] = await Promise.all([
    getConditions(ctx),
    ctx.db.query.conditionReports.findMany(),
    ctx.db.query.experiences.findMany(),
    ctx.db.query.conditionComments.findMany(),
    ctx.db.query.conditionTreatments.findMany(),
  ])
  const counts = new Map<string, number>()
  const bump = (slug: string | null | undefined) => {
    if (!slug) return
    counts.set(slug, (counts.get(slug) ?? 0) + 1)
  }
  for (const row of reportRows) bump(row.conditionSlug)
  for (const row of expRows) bump(row.conditionSlug)
  for (const row of commentRows) bump(row.conditionSlug)

  // Evidence richness (how many treatments carry a baseline) and a curated
  // showcase order so that, before real community activity exists, the
  // featured set leads with broadly recognizable, relatable conditions (a warm
  // first impression) while staying diverse and globally relevant, instead of
  // whichever condition happened to get the most treatment rows authored.
  const evidence = new Map<string, number>()
  for (const row of treatRows) evidence.set(row.conditionSlug, (evidence.get(row.conditionSlug) ?? 0) + 1)

  const SHOWCASE = [
    'depression', 'anxiety', 'adhd', 'migraine', 'hiv', 'type-2-diabetes',
    'fibromyalgia', 'ibs', 'hypertension', 'ptsd', 'insomnia', 'bipolar',
  ]
  const showcaseRank = (slug: string): number => {
    const index = SHOWCASE.indexOf(slug)
    return index === -1 ? Number.MAX_SAFE_INTEGER : index
  }

  const featured = [...allConditions]
    .sort(
      (a, b) =>
        (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
        showcaseRank(a.id) - showcaseRank(b.id) ||
        (evidence.get(b.id) ?? 0) - (evidence.get(a.id) ?? 0) ||
        (a.name ?? '').localeCompare(b.name ?? ''))
    .slice(0, limitCount)

  return Promise.all(
    featured.map(async (condition) => ({
      condition: { ...condition, activity_count: counts.get(condition.id) ?? 0 },
      topTreatments: await getTopTreatments(ctx, condition.id, 3),
    })))
}

// ── Per-condition community discussion ──────────────────────────────────────

/** Discussion comments for a condition, newest first, with public author profiles. */
export async function getConditionComments(ctx: Ctx, conditionSlug: string, limitCount = 50) {
  const resolved = await getCondition(ctx, conditionSlug)
  const slug = resolved?.slug ?? conditionSlug
  const rows = await ctx.db.query.conditionComments.findMany({
    where: eq(conditionComments.conditionSlug, slug),
  })
  const authorIds = rows.filter((row) => !row.isAnonymous).map((row) => row.userId)
  const profiles = await getProfileSummaries(ctx.db, authorIds)
  return sortByNewest([...rows])
    .slice(0, limitCount)
    .map((row) => ({
      id: row.id,
      content: row.content,
      is_anonymous: row.isAnonymous,
      upvotes: row.upvotes,
      created_at: row.createdAt,
      author: row.isAnonymous ? null : profiles.get(row.userId) ?? null,
    }))
}

/** Post a discussion comment on a condition. */
export async function addConditionComment(
  ctx: Ctx,
  conditionSlug: string,
  content: string,
  isAnonymous = false) {
  const userId = requireActor(ctx)
  const resolved = await getCondition(ctx, conditionSlug)
  const slug = resolved?.slug ?? conditionSlug
  const text = String(content ?? '').trim().slice(0, 4000)
  if (!slug || !text) throw new Error('A comment is required')
  const id = crypto.randomUUID()
  await ctx.db.insert(conditionComments).values({ id, conditionSlug: slug, userId, content: text, isAnonymous })
  return { id }
}
