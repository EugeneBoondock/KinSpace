'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { formatRelativeTime, formatCompactNumber } from '@/lib/platform'
import { cn } from '@/lib/cn'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  Input,
  LinkButton,
  Skeleton,
  Textarea,
} from '@/components/ui'

type ConditionDoc = Record<string, unknown> & { id: string }
type StudyTreatment = {
  slug: string
  name: string
  kind: string | null
  effectiveness_avg: number
  effectiveness_score: number
  report_count: number
  sample_count?: number | null
  confidence_label?: string | null
  evidence_based?: boolean
}
type Experience = Record<string, unknown> & {
  id: string
  profile: Record<string, unknown> | null
}
type ConditionComment = {
  id: string
  content: string
  is_anonymous: boolean
  upvotes: number
  created_at: string | null
  author:
    | { full_name?: string | null; username?: string; pseudonym?: string | null; avatar_url?: string | null }
    | null
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
  is_anonymized: boolean
  updated_at: string | null
  created_at: string | null
}
type ResearchQuestion = {
  id: string
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
type ReportFilterKind = 'treatment' | 'symptom' | 'sideEffect' | 'trigger'
type ReportFilter = { kind: ReportFilterKind; value: string } | null

function effectivenessBar(value: number) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-brand-background/10"
      role="meter"
      aria-valuenow={Math.round(value * 10) / 10}
      aria-valuemin={0}
      aria-valuemax={5}
      aria-label="Average effectiveness rating"
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-accent3 to-brand-accent2"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

type RankItem = {
  slug: string
  name: string
  prevalence_pct: number | null
  sample_count?: number | null
  confidence_label?: string | null
}

function toRankItems(value: unknown): RankItem[] {
  return (Array.isArray(value) ? value : []).map((row) => {
    const item = row as Record<string, unknown>
    return {
      slug: String(item.slug ?? item.name ?? ''),
      name: String(item.name ?? item.slug ?? ''),
      prevalence_pct: typeof item.prevalence_pct === 'number' ? item.prevalence_pct : null,
      sample_count: typeof item.sample_count === 'number' ? item.sample_count : null,
      confidence_label: typeof item.confidence_label === 'string' ? item.confidence_label : null,
    }
  })
}

function PrevalenceList({ items, color }: { items: RankItem[]; color: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-brand-background/50">Not enough data yet - be one of the first.</p>
  }
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.slug}>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="capitalize text-brand-background/80">{item.name}</span>
            {item.prevalence_pct != null && (
              <span className="text-xs font-semibold" style={{ color }}>
                {item.prevalence_pct}%
              </span>
            )}
          </div>
          {item.confidence_label && (
            <div className="mt-1">
              <Badge className="bg-brand-background/10 text-brand-background/55">
                {item.confidence_label}
                {item.sample_count != null ? `, ${item.sample_count} ${item.sample_count === 1 ? 'report' : 'reports'}` : ''}
              </Badge>
            </div>
          )}
          {item.prevalence_pct != null && (
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-brand-background/10">
              <div className="h-full rounded-full" style={{ width: `${item.prevalence_pct}%`, background: color }} />
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

function ReportList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-background/40">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} className="capitalize">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  )
}

export default function ConditionDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug as string | undefined
  const { user } = useAuth()

  const [condition, setCondition] = useState<ConditionDoc | null>(null)
  const [experiences, setExperiences] = useState<Experience[]>([])
  const [study, setStudy] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [cohort, setCohort] = useState<'all' | 'similar'>('all')
  const [rankSort, setRankSort] = useState<'best' | 'tried'>('best')
  const [studyLoading, setStudyLoading] = useState(false)
  const [comments, setComments] = useState<ConditionComment[]>([])
  const [commentInput, setCommentInput] = useState('')
  const [commentAnon, setCommentAnon] = useState(false)
  const [postingComment, setPostingComment] = useState(false)
  const [reportQuery, setReportQuery] = useState('')
  const [reportFilter, setReportFilter] = useState<ReportFilter>(null)
  const [reportResults, setReportResults] = useState<ReportSearchResult[]>([])
  const [reportSearchLoading, setReportSearchLoading] = useState(false)
  const [researchQuestions, setResearchQuestions] = useState<ResearchQuestion[]>([])
  const [researchLoading, setResearchLoading] = useState(false)
  const [questionInput, setQuestionInput] = useState('')
  const [questionDetail, setQuestionDetail] = useState('')
  const [questionAnon, setQuestionAnon] = useState(false)
  const [postingQuestion, setPostingQuestion] = useState(false)
  const [votingQuestionId, setVotingQuestionId] = useState<string | null>(null)
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({})
  const [answerAnon, setAnswerAnon] = useState<Record<string, boolean>>({})
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    async function load() {
      try {
        const conditionDoc = (await DatabaseService.getCondition(slug as string)) as ConditionDoc | null
        setCondition(conditionDoc)
        const resolvedSlug = conditionDoc?.id ?? (slug as string)
        const experiencesList = await DatabaseService.getExperiencesForCondition(resolvedSlug, { limit: 12 })
        setExperiences(experiencesList as Experience[])
      } catch (error) {
        console.error('Failed to load condition:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  // Study reloads when the cohort filter flips (Everyone vs People like me).
  useEffect(() => {
    const resolvedSlug = condition?.id
    if (!resolvedSlug) return
    let cancelled = false
    setStudyLoading(true)
    DatabaseService.getConditionStudy(resolvedSlug, { cohort })
      .then((doc) => {
        if (!cancelled) setStudy(doc as Record<string, unknown> | null)
      })
      .catch((error) => console.error('Failed to load study:', error))
      .finally(() => {
        if (!cancelled) setStudyLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [condition?.id, cohort])

  // Load the condition's community discussion once the condition resolves.
  useEffect(() => {
    const resolvedSlug = condition?.id
    if (!resolvedSlug) return
    let cancelled = false
    DatabaseService.getConditionComments(resolvedSlug)
      .then((rows) => {
        if (!cancelled) setComments((rows as ConditionComment[]) || [])
      })
      .catch((error) => console.error('Failed to load comments:', error))
    return () => {
      cancelled = true
    }
  }, [condition?.id])

  useEffect(() => {
    const resolvedSlug = condition?.id
    if (!resolvedSlug) return
    let cancelled = false
    setReportSearchLoading(true)

    const filters = {
      query: reportQuery.trim() || undefined,
      treatment: reportFilter?.kind === 'treatment' ? reportFilter.value : undefined,
      symptom: reportFilter?.kind === 'symptom' ? reportFilter.value : undefined,
      sideEffect: reportFilter?.kind === 'sideEffect' ? reportFilter.value : undefined,
      trigger: reportFilter?.kind === 'trigger' ? reportFilter.value : undefined,
      limit: 8,
    }

    DatabaseService.searchConditionReports(resolvedSlug, filters)
      .then((result) => {
        if (cancelled) return
        const reports = (result as { reports?: ReportSearchResult[] } | null)?.reports
        setReportResults(Array.isArray(reports) ? reports : [])
      })
      .catch((error) => console.error('Failed to search reports:', error))
      .finally(() => {
        if (!cancelled) setReportSearchLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [condition?.id, reportFilter, reportQuery])

  useEffect(() => {
    const resolvedSlug = condition?.id
    if (!resolvedSlug) return
    let cancelled = false
    setResearchLoading(true)
    DatabaseService.getConditionResearchQuestions(resolvedSlug)
      .then((result) => {
        if (cancelled) return
        const questions = (result as { questions?: ResearchQuestion[] } | null)?.questions
        setResearchQuestions(Array.isArray(questions) ? questions : [])
      })
      .catch((error) => console.error('Failed to load research questions:', error))
      .finally(() => {
        if (!cancelled) setResearchLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [condition?.id])

  const memberCount =
    (study?.member_count as number | undefined) ?? (condition?.member_count as number | undefined) ?? 0
  const evidenceCount = (study?.evidence_count as number | undefined) ?? 0
  const reportCount = (study?.report_count as number | undefined) ?? 0

  const rankedTreatments = useMemo(() => {
    const list = (Array.isArray(study?.top_treatments) ? study!.top_treatments : []) as StudyTreatment[]
    const sorted = [...list]
    if (rankSort === 'tried') {
      sorted.sort(
        (a, b) =>
          (b.report_count ?? 0) - (a.report_count ?? 0) ||
          (b.effectiveness_avg ?? 0) - (a.effectiveness_avg ?? 0))
    } else {
      sorted.sort(
        (a, b) =>
          (b.effectiveness_avg ?? 0) - (a.effectiveness_avg ?? 0) ||
          (b.report_count ?? 0) - (a.report_count ?? 0))
    }
    return sorted.slice(0, 10)
  }, [study, rankSort])

  const symptomItems = useMemo(() => toRankItems(study?.top_symptoms), [study])
  const triggerItems = useMemo(() => toRankItems(study?.top_triggers), [study])
  const comorbidityItems = useMemo(() => toRankItems(study?.top_comorbidities), [study])
  const testItems = useMemo(() => toRankItems(study?.top_tests), [study])
  const sideEffectItems = useMemo(() => toRankItems(study?.top_side_effects), [study])
  const ageOfOnset = (study?.age_of_onset_median as number | undefined) ?? null
  const reportFilterChips = useMemo(() => {
    const chips: Array<{ kind: ReportFilterKind; label: string; value: string }> = []
    const seen = new Set<string>()
    const addChip = (kind: ReportFilterKind, label: string, value: string) => {
      const cleanValue = value.trim()
      if (!cleanValue) return
      const key = `${kind}:${cleanValue.toLowerCase()}`
      if (seen.has(key)) return
      seen.add(key)
      chips.push({ kind, label, value: cleanValue })
    }

    rankedTreatments.slice(0, 4).forEach((item) => addChip('treatment', item.name, item.name))
    symptomItems.slice(0, 3).forEach((item) => addChip('symptom', item.name, item.name))
    triggerItems.slice(0, 2).forEach((item) => addChip('trigger', item.name, item.name))
    sideEffectItems.slice(0, 3).forEach((item) => addChip('sideEffect', item.name, item.name))

    return chips
  }, [rankedTreatments, sideEffectItems, symptomItems, triggerItems])
  const hasReportSearch = Boolean(reportQuery.trim() || reportFilter)

  async function reloadResearchQuestions() {
    const resolvedSlug = condition?.id
    if (!resolvedSlug) return
    const result = await DatabaseService.getConditionResearchQuestions(resolvedSlug)
    const questions = (result as { questions?: ResearchQuestion[] } | null)?.questions
    setResearchQuestions(Array.isArray(questions) ? questions : [])
  }

  async function submitResearchQuestion() {
    const resolvedSlug = condition?.id
    const question = questionInput.trim()
    if (!user || !resolvedSlug || !question || postingQuestion) return
    setPostingQuestion(true)
    try {
      await DatabaseService.createConditionResearchQuestion(resolvedSlug, {
        question,
        detail: questionDetail.trim(),
        isAnonymous: questionAnon,
      })
      setQuestionInput('')
      setQuestionDetail('')
      setQuestionAnon(false)
      await reloadResearchQuestions()
    } catch (error) {
      console.error('Failed to create research question:', error)
    } finally {
      setPostingQuestion(false)
    }
  }

  async function toggleResearchVote(questionId: string) {
    if (!user || votingQuestionId) return
    setVotingQuestionId(questionId)
    try {
      await DatabaseService.voteConditionResearchQuestion(questionId)
      await reloadResearchQuestions()
    } catch (error) {
      console.error('Failed to vote on research question:', error)
    } finally {
      setVotingQuestionId(null)
    }
  }

  async function submitResearchAnswer(questionId: string) {
    if (!user || answeringQuestionId) return
    const answer = (answerInputs[questionId] ?? '').trim()
    if (!answer) return
    setAnsweringQuestionId(questionId)
    try {
      await DatabaseService.answerConditionResearchQuestion(questionId, {
        answer,
        isAnonymous: Boolean(answerAnon[questionId]),
      })
      setAnswerInputs((current) => ({ ...current, [questionId]: '' }))
      setAnswerAnon((current) => ({ ...current, [questionId]: false }))
      await reloadResearchQuestions()
    } catch (error) {
      console.error('Failed to answer research question:', error)
    } finally {
      setAnsweringQuestionId(null)
    }
  }

  async function postComment() {
    const resolvedSlug = condition?.id
    const text = commentInput.trim()
    if (!user || !resolvedSlug || !text || postingComment) return
    setPostingComment(true)
    try {
      await DatabaseService.addConditionComment(resolvedSlug, text, commentAnon)
      setCommentInput('')
      const rows = await DatabaseService.getConditionComments(resolvedSlug)
      setComments((rows as ConditionComment[]) || [])
    } catch (error) {
      console.error('Failed to post comment:', error)
    } finally {
      setPostingComment(false)
    }
  }

  async function handleVote(experienceId: string, kind: 'helpful' | 'not_helpful') {
    if (!user) return
    await DatabaseService.voteOnExperience(user.userId, experienceId, kind)
    // Re-fetch to reflect vote
    const resolvedSlug = condition?.id ?? slug
    if (resolvedSlug) {
      const updated = await DatabaseService.getExperiencesForCondition(resolvedSlug, { limit: 12 })
      setExperiences(updated as Experience[])
    }
  }

  if (loading) {
    return (
      <PageFrame containerClassName="max-w-5xl">
        <div className="space-y-5">
          <Card className="space-y-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </Card>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  if (!condition) {
    return (
      <PageFrame containerClassName="max-w-5xl">
        <EmptyState
          icon={<i className="ri-pulse-line text-4xl" aria-hidden="true" />}
          title="We could not find that condition"
          description="It may have been moved or the link is out of date. Browse the directory to find what you need."
          action={<LinkButton href="/conditions">Browse conditions</LinkButton>}
        />
        <BottomNav />
      </PageFrame>
    )
  }

  return (
    <PageFrame containerClassName="max-w-5xl">
      <div className="space-y-6">
        <Link
          href="/conditions"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-accent2 transition-colors hover:text-brand-background"
        >
          <i className="ri-arrow-left-line" aria-hidden="true" />
          All conditions
        </Link>

        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-brand-accent3/15 capitalize text-brand-accent3">
              {(condition.category as string) ?? 'condition'}
            </Badge>
            {memberCount > 0 ? (
              <Badge>{formatCompactNumber(memberCount)} members tracking</Badge>
            ) : evidenceCount > 0 ? (
              <Badge tone="sage">
                <i className="ri-microscope-line mr-1" aria-hidden="true" />
                Evidence-based profile
              </Badge>
            ) : null}
          </div>
          <h1 className="text-2xl font-bold text-brand-background sm:text-3xl">{condition.name as string}</h1>
          {(condition.summary as string | undefined) && (
            <p className="max-w-3xl text-base leading-relaxed text-brand-background/70">
              {condition.summary as string}
            </p>
          )}
          <div className="flex flex-wrap gap-3 pt-1">
            <LinkButton
              href={`/contribute?condition=${condition.id}`}
              leadingIcon={<i className="ri-survey-line" aria-hidden="true" />}
            >
              Contribute your data
            </LinkButton>
            <LinkButton
              href={`/share-experience?condition=${condition.id}`}
              variant="secondary"
              leadingIcon={<i className="ri-add-line" aria-hidden="true" />}
            >
              Share a story
            </LinkButton>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="space-y-5">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-lg">
                  {rankSort === 'tried' ? 'Most-tried treatments' : 'Best-rated treatments'}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-full bg-brand-background/[0.06] p-0.5 text-xs">
                    {([['best', 'Best rated'], ['tried', 'Most tried']] as const).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setRankSort(key)}
                        className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
                          rankSort === key
                            ? 'bg-brand-accent2 text-white'
                            : 'text-brand-background/60 hover:text-brand-background'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {user && (
                    <div className="inline-flex rounded-full bg-brand-background/[0.06] p-0.5 text-xs">
                      {([['all', 'Everyone'], ['similar', 'People like me']] as const).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setCohort(key)}
                          className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
                            cohort === key
                              ? 'bg-brand-accent3 text-white'
                              : 'text-brand-background/60 hover:text-brand-background'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <p className="mt-1 text-xs text-brand-background/50">
                {cohort === 'similar'
                  ? 'Members in your age range and gender. '
                  : 'A clinical-evidence baseline, refined by member reports as they come in. '}
                {studyLoading
                  ? 'Updating…'
                  : reportCount > 0
                    ? `Includes ${reportCount} member ${reportCount === 1 ? 'report' : 'reports'} so far.`
                    : 'No member reports yet, yours would be the first.'}
              </p>

              {!studyLoading && (
                <div className="mt-2">
                  {reportCount > 0 ? (
                    <Badge className="bg-brand-background/10 text-brand-background/60">
                      {String(study?.confidence_label ?? 'Early signal')}
                    </Badge>
                  ) : (
                    <Badge tone="sage">
                      <i className="ri-microscope-line mr-1" aria-hidden="true" />
                      Evidence-based
                    </Badge>
                  )}
                </div>
              )}

              {rankedTreatments.length === 0 ? (
                <p className="mt-3 text-sm text-brand-background/60">
                  {cohort === 'similar'
                    ? 'Not enough reports from people like you yet. Try “Everyone”, or contribute your data.'
                    : 'No treatments ranked yet. Be the first to share what worked for you.'}
                </p>
              ) : (
                <ol className="mt-4 space-y-3">
                  {rankedTreatments.map((row, index) => {
                    const effectiveness = row.effectiveness_avg ?? 0
                    const count = row.report_count ?? 0
                    const isEvidenceOnly = count === 0 && row.evidence_based !== false
                    const confidence =
                      count >= 20 ? 'Well reported' : count >= 5 ? 'Growing signal' : 'Early signal'
                    return (
                      <li key={row.slug} className="rounded-2xl bg-brand-background/5 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-brand-accent2">#{index + 1}</span>
                              <Link
                                href={`/treatments/${row.slug}`}
                                className="text-base font-semibold text-brand-background transition-colors hover:text-brand-accent2"
                              >
                                {row.name}
                              </Link>
                              {row.kind && (
                                <Badge className="bg-brand-accent3/15 capitalize text-brand-accent3">{row.kind}</Badge>
                              )}
                              {isEvidenceOnly ? (
                                <Badge tone="sage">Evidence-based</Badge>
                              ) : (
                                <Badge className="bg-brand-background/10 text-brand-background/60">{confidence}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-2xl font-bold text-brand-accent2">{effectiveness.toFixed(1)}</p>
                            <p className="text-xs text-brand-background/45">
                              {isEvidenceOnly
                                ? 'clinical baseline'
                                : `${count} ${count === 1 ? 'report' : 'reports'}`}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3">{effectivenessBar(effectiveness)}</div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </Card>

            <Card>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Search member reports</CardTitle>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-brand-background/55">
                    Find anonymized reports by treatment, symptom, trigger, or side effect. Author details and raw notes stay hidden.
                  </p>
                </div>
                <Badge tone="info">{reportResults.length} shown</Badge>
              </div>

              <div className="mt-4 space-y-3">
                <div className="relative">
                  <i
                    className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-brand-background/40"
                    aria-hidden="true"
                  />
                  <Input
                    value={reportQuery}
                    onChange={(event) => setReportQuery(event.target.value)}
                    aria-label="Search member reports"
                    placeholder="Search treatment, symptom, trigger, or side effect"
                    className="pl-10"
                  />
                </div>

                {reportFilterChips.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {reportFilterChips.map((chip) => {
                      const active = reportFilter?.kind === chip.kind && reportFilter.value === chip.value
                      return (
                        <button
                          key={`${chip.kind}:${chip.value}`}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            setReportFilter(active ? null : { kind: chip.kind, value: chip.value })
                          }
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                            active
                              ? 'border-brand-accent2/50 bg-brand-accent2/15 text-brand-accent2'
                              : 'border-brand-background/12 bg-brand-background/[0.04] text-brand-background/60 hover:border-brand-accent2/35 hover:text-brand-background')}
                        >
                          {chip.label}
                        </button>
                      )
                    })}
                    {hasReportSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setReportQuery('')
                          setReportFilter(null)
                        }}
                        className="rounded-full px-3 py-1.5 text-xs font-semibold text-brand-background/45 transition-colors hover:text-brand-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5 space-y-3">
                {reportSearchLoading ? (
                  Array.from({ length: 2 }).map((_, index) => (
                    <div key={index} className="rounded-2xl border border-brand-background/10 p-4">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="mt-3 h-4 w-full" />
                      <Skeleton className="mt-2 h-4 w-2/3" />
                    </div>
                  ))
                ) : reportResults.length === 0 ? (
                  <EmptyState
                    icon={<i className="ri-file-search-line text-4xl" aria-hidden="true" />}
                    title={hasReportSearch ? 'No matching reports' : 'No reports shared yet'}
                    description={
                      hasReportSearch
                        ? 'Try a broader search or clear the filter.'
                        : 'When members contribute, anonymized summaries will appear here.'
                    }
                    className="py-8"
                  />
                ) : (
                  reportResults.map((report) => (
                    <article key={report.id} className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.04] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-brand-background">Member report</p>
                          <p className="mt-1 text-xs text-brand-background/45">
                            Updated {formatRelativeTime(report.updated_at ?? report.created_at)}
                          </p>
                        </div>
                        <Badge tone="sage">Anonymized</Badge>
                      </div>

                      {report.match_reasons.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {report.match_reasons.map((reason) => (
                            <Badge key={reason} tone="info">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {report.age_of_onset != null && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-background/40">
                              Age of onset
                            </p>
                            <p className="mt-2 text-sm font-semibold text-brand-background">{report.age_of_onset}</p>
                          </div>
                        )}
                        <ReportList label="Symptoms" items={report.symptoms} />
                        <ReportList label="Triggers" items={report.triggers} />
                        <ReportList label="Co-existing" items={report.comorbidities} />
                        <ReportList label="Tests" items={report.tests} />
                      </div>

                      {report.treatments.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-background/40">
                            Treatments tried
                          </p>
                          <div className="mt-2 space-y-2">
                            {report.treatments.map((treatment) => (
                              <div
                                key={treatment.slug || treatment.name}
                                className="rounded-xl bg-brand-background/[0.05] px-3 py-2"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <Link
                                    href={`/treatments/${treatment.slug}`}
                                    className="text-sm font-semibold text-brand-background transition-colors hover:text-brand-accent2"
                                  >
                                    {treatment.name}
                                  </Link>
                                  {treatment.effectiveness != null && (
                                    <span className="text-xs font-semibold text-brand-accent2">
                                      {treatment.effectiveness}/5
                                    </span>
                                  )}
                                </div>
                                {treatment.side_effects.length > 0 && (
                                  <p className="mt-1 text-xs text-brand-background/50">
                                    Side effects: {treatment.side_effects.join(', ')}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
            </Card>

            <Card>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Research questions</CardTitle>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-brand-background/55">
                    Vote for questions you want KinSpace to study next. Add member answers when you have data or lived experience.
                  </p>
                </div>
                <Badge tone="accent">{researchQuestions.length} open</Badge>
              </div>

              {user ? (
                <div className="mt-4 space-y-3 rounded-2xl border border-brand-background/10 bg-brand-background/[0.04] p-4">
                  <Input
                    value={questionInput}
                    onChange={(event) => setQuestionInput(event.target.value)}
                    aria-label="Research question"
                    placeholder="Which habits or treatments should KinSpace study here?"
                  />
                  <Textarea
                    value={questionDetail}
                    onChange={(event) => setQuestionDetail(event.target.value)}
                    rows={2}
                    aria-label="Research question context"
                    placeholder="Optional context, time frame, or member group"
                    className="resize-none"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-xs text-brand-background/60">
                      <input
                        type="checkbox"
                        checked={questionAnon}
                        onChange={(event) => setQuestionAnon(event.target.checked)}
                        className="h-4 w-4 rounded border-brand-line"
                      />
                      Ask anonymously
                    </label>
                    <Button
                      size="sm"
                      onClick={submitResearchQuestion}
                      disabled={postingQuestion || questionInput.trim().length < 8}
                    >
                      {postingQuestion ? 'Asking...' : 'Ask question'}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-brand-background/55">
                  <Link href="/login" className="text-brand-accent2 underline">
                    Sign in
                  </Link>{' '}
                  to add, vote, or answer research questions.
                </p>
              )}

              <div className="mt-5 space-y-3">
                {researchLoading ? (
                  Array.from({ length: 2 }).map((_, index) => (
                    <div key={index} className="rounded-2xl border border-brand-background/10 p-4">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="mt-3 h-4 w-full" />
                      <Skeleton className="mt-2 h-4 w-28" />
                    </div>
                  ))
                ) : researchQuestions.length === 0 ? (
                  <EmptyState
                    icon={<i className="ri-question-answer-line text-4xl" aria-hidden="true" />}
                    title="No research questions yet"
                    description="Ask what the community should learn next from member reports."
                    className="py-8"
                  />
                ) : (
                  researchQuestions.map((question) => (
                    <article key={question.id} className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.04] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={question.status === 'open' ? 'success' : 'info'}>{question.status}</Badge>
                            {question.is_anonymous && <Badge>Anonymous</Badge>}
                          </div>
                          <h3 className="mt-2 text-base font-semibold leading-snug text-brand-background">
                            {question.question}
                          </h3>
                          {question.detail && (
                            <p className="mt-2 text-sm leading-relaxed text-brand-background/60">
                              {question.detail}
                            </p>
                          )}
                          <p className="mt-2 text-xs text-brand-background/40">
                            Added {formatRelativeTime(question.created_at)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleResearchVote(question.id)}
                            disabled={!user || votingQuestionId === question.id}
                            className={cn(
                              'inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 disabled:cursor-not-allowed disabled:opacity-55',
                              question.has_voted
                                ? 'border-brand-accent2/50 bg-brand-accent2/15 text-brand-accent2'
                                : 'border-brand-background/15 text-brand-background/60 hover:border-brand-accent2/40 hover:text-brand-accent2')}
                          >
                            <i className="ri-arrow-up-line" aria-hidden="true" />
                            {question.has_voted ? 'Voted' : 'Vote'} {question.votes_count}
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-background/40">
                          <span>{question.answers_count} answers</span>
                        </div>
                        {question.answers.map((answer) => (
                          <div key={answer.id} className="rounded-xl bg-brand-background/[0.05] p-3">
                            <p className="text-sm leading-relaxed text-brand-background/70">{answer.answer}</p>
                            <p className="mt-1 text-xs text-brand-background/40">
                              {answer.is_anonymous ? 'Anonymous answer' : 'Member answer'} - {formatRelativeTime(answer.created_at)}
                            </p>
                          </div>
                        ))}
                      </div>

                      {user && (
                        <div className="mt-4 space-y-2">
                          <Textarea
                            value={answerInputs[question.id] ?? ''}
                            onChange={(event) =>
                              setAnswerInputs((current) => ({ ...current, [question.id]: event.target.value }))
                            }
                            rows={2}
                            aria-label={`Answer ${question.question}`}
                            placeholder="Add a short member answer"
                            className="resize-none"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <label className="flex items-center gap-2 text-xs text-brand-background/60">
                              <input
                                type="checkbox"
                                checked={Boolean(answerAnon[question.id])}
                                onChange={(event) =>
                                  setAnswerAnon((current) => ({ ...current, [question.id]: event.target.checked }))
                                }
                                className="h-4 w-4 rounded border-brand-line"
                              />
                              Answer anonymously
                            </label>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => submitResearchAnswer(question.id)}
                              disabled={answeringQuestionId === question.id || !(answerInputs[question.id] ?? '').trim()}
                            >
                              {answeringQuestionId === question.id ? 'Adding...' : 'Answer'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg">Symptom &amp; trigger profile</CardTitle>
                {memberCount > 0 ? (
                  <Badge className="bg-brand-accent2/15 text-brand-accent2">
                    {formatCompactNumber(memberCount)} {memberCount === 1 ? 'member' : 'members'}
                  </Badge>
                ) : evidenceCount > 0 ? (
                  <Badge tone="sage">Evidence-based</Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-brand-background/55">
                Common patterns for this condition from clinical references, refined as members add their own.
              </p>
              <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="eyebrow mb-3">Top symptoms</p>
                  <PrevalenceList items={symptomItems} color="var(--accent-2)" />
                </div>
                <div>
                  <p className="eyebrow mb-3">Common triggers</p>
                  <PrevalenceList items={triggerItems} color="var(--accent)" />
                </div>
                <div>
                  <p className="eyebrow mb-3">Often alongside</p>
                  <PrevalenceList items={comorbidityItems} color="var(--accent-3)" />
                </div>
                <div>
                  <p className="eyebrow mb-3">Diagnostic tests</p>
                  <PrevalenceList items={testItems} color="var(--accent-5, #4f7a9b)" />
                </div>
                <div>
                  <p className="eyebrow mb-3">Common side effects</p>
                  <PrevalenceList items={sideEffectItems} color="var(--accent-crisis, #c0392b)" />
                </div>
              </div>
              {ageOfOnset != null && (
                <p className="mt-5 rounded-xl bg-brand-background/5 px-4 py-3 text-sm text-brand-background/70">
                  <i className="ri-calendar-line mr-1.5 text-brand-accent2" aria-hidden="true" />
                  Typical age of onset: <span className="font-semibold text-brand-background">{ageOfOnset}</span>{' '}
                  (median of member reports)
                </p>
              )}
            </Card>

            <Card>
              <CardTitle className="text-lg">Member experiences</CardTitle>
              {experiences.length === 0 ? (
                <p className="mt-3 text-sm text-brand-background/60">
                  No stories yet - this is a great place to be the first voice.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {experiences.map((experience) => {
                    const author = experience.profile
                    const name = experience.is_anonymous
                      ? 'Anonymous member'
                      : ((author?.full_name as string | undefined) ||
                          (author?.username as string | undefined) ||
                          'Community member')
                    const treatmentSlug = experience.treatment_slug as string | undefined
                    return (
                      <article key={experience.id} className="rounded-2xl bg-brand-background/5 p-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-brand-background/50">
                          <span className="font-semibold text-brand-background/75">{name}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatRelativeTime(experience.created_at)}</span>
                          {treatmentSlug && (
                            <>
                              <span aria-hidden="true">·</span>
                              <Link
                                href={`/treatments/${treatmentSlug}`}
                                className="capitalize text-brand-accent2 hover:text-brand-background"
                              >
                                {treatmentSlug.replace(/-/g, ' ')}
                              </Link>
                            </>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-accent3/10 px-2.5 py-1">
                            <span className="text-brand-background/55">Effectiveness</span>
                            <span className="font-semibold text-brand-accent2">
                              {(experience.effectiveness as number | undefined) ?? 0}/5
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-accent1/10 px-2.5 py-1">
                            <span className="text-brand-background/55">Side effects</span>
                            <span className="font-semibold text-brand-accent1">
                              {(experience.side_effects as number | undefined) ?? 0}/5
                            </span>
                          </span>
                          {(experience.duration_weeks as number | undefined) && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-background/8 px-2.5 py-1 text-brand-background/55">
                              Tried for {experience.duration_weeks as number} weeks
                            </span>
                          )}
                        </div>

                        {(experience.story_markdown as string | undefined) && (
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-brand-background/75">
                            {experience.story_markdown as string}
                          </p>
                        )}

                        <div className="mt-3 flex items-center gap-3 text-xs">
                          <button
                            onClick={() => handleVote(experience.id, 'helpful')}
                            className="inline-flex items-center gap-1.5 rounded-full border border-brand-background/15 px-3 py-1.5 text-brand-background/60 transition-colors hover:border-brand-accent2/40 hover:text-brand-accent2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                          >
                            <i className="ri-thumb-up-line" aria-hidden="true" /> Helpful (
                            {(experience.helpful_count as number | undefined) ?? 0})
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </Card>

            <Card>
              <CardTitle className="text-lg">Community discussion</CardTitle>
              <p className="mt-1 text-sm text-brand-background/55">
                Questions, tips, and support from others living with this.
              </p>

              {user ? (
                <div className="mt-4 space-y-2">
                  <Textarea
                    value={commentInput}
                    onChange={(event) => setCommentInput(event.target.value)}
                    rows={3}
                    aria-label="Write a comment"
                    placeholder="Share a question or something that helped you…"
                    className="resize-none"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-xs text-brand-background/60">
                      <input
                        type="checkbox"
                        checked={commentAnon}
                        onChange={(event) => setCommentAnon(event.target.checked)}
                        className="h-4 w-4 rounded border-brand-line"
                      />
                      Post anonymously
                    </label>
                    <Button size="sm" onClick={postComment} disabled={postingComment || !commentInput.trim()}>
                      {postingComment ? 'Posting…' : 'Post'}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-brand-background/55">
                  <Link href="/login" className="text-brand-accent2 underline">
                    Sign in
                  </Link>{' '}
                  to join the discussion.
                </p>
              )}

              <div className="mt-5 space-y-3">
                {comments.length === 0 ? (
                  <p className="text-sm text-brand-background/50">No comments yet. Start the conversation.</p>
                ) : (
                  comments.map((comment) => {
                    const name =
                      comment.is_anonymous || !comment.author
                        ? 'Anonymous'
                        : comment.author.full_name || comment.author.username || 'Member'
                    return (
                      <div key={comment.id} className="rounded-2xl bg-brand-background/5 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-brand-background">{name}</span>
                          {comment.created_at && (
                            <span className="text-[11px] text-brand-background/40">
                              {formatRelativeTime(new Date(comment.created_at))}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-brand-background/75">
                          {comment.content}
                        </p>
                      </div>
                    )
                  })
                )}
              </div>
            </Card>
          </div>

          <aside className="space-y-5">
            <Card>
              <CardTitle className="text-lg">At a glance</CardTitle>
              <div className="mt-4 grid grid-cols-3 gap-3 lg:grid-cols-1">
                <div className="rounded-xl bg-brand-background/[0.06] p-4">
                  <p className="text-xs text-brand-background/45">Treatments ranked</p>
                  <p className="mt-1 text-xl font-semibold text-brand-background">{rankedTreatments.length}</p>
                </div>
                <div className="rounded-xl bg-brand-background/[0.06] p-4">
                  <p className="text-xs text-brand-background/45">Experiences shared</p>
                  <p className="mt-1 text-xl font-semibold text-brand-background">{experiences.length}</p>
                </div>
                <div className="rounded-xl bg-brand-background/[0.06] p-4">
                  <p className="text-xs text-brand-background/45">Members tracking</p>
                  <p className="mt-1 text-xl font-semibold text-brand-background">
                    {formatCompactNumber(memberCount)}
                  </p>
                </div>
              </div>
            </Card>

            {Array.isArray(condition.aliases) && (condition.aliases as string[]).length > 0 && (
              <Card>
                <CardTitle className="text-lg">Also known as</CardTitle>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(condition.aliases as string[]).map((alias) => (
                    <Badge key={alias}>{alias}</Badge>
                  ))}
                </div>
              </Card>
            )}

            <Alert tone="info" title="A gentle reminder">
              Effectiveness blends a clinical-evidence baseline with member-reported experiences. It is
              general information, not a treatment recommendation, always talk with your care team before
              changing treatments. KinSpace does not provide medical advice.
            </Alert>
          </aside>
        </div>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
