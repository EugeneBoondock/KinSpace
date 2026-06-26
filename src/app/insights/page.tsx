'use client'

import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { formatCompactNumber } from '@/lib/platform'
import { cn } from '@/lib/cn'
import { Alert, Badge, Card, CardTitle, EmptyState, LinkButton, Skeleton } from '@/components/ui'

// Community insights
type Condition = Record<string, unknown> & { id: string }
type TopTreatment = Record<string, unknown> & { id: string; treatment?: (Record<string, unknown> & { id: string }) | null }
type InsightBundle = { condition: Condition; topTreatments: TopTreatment[] }

type ReviewCoverageLevel = 'thin' | 'building' | 'strong'
type ReviewNextAction = {
  id: string
  title: string
  body: string
  href: string
  icon: string
}
type PersonalReview = {
  title: string
  summary: string
  coverage_level: ReviewCoverageLevel
  focus: string | null
  next_actions: ReviewNextAction[]
}

// Personal insights
type PersonalCard = {
  kind: string
  title: string
  phrase: string
  direction: string | null
  band: string | null
  subject: string | null
  sample_days: number
  per_group_counts: { a: number; b: number } | null
  care_team_nudge: boolean
  disclaimer_key: string
}
type PersonalInsights = {
  window_days: number
  coverage: { logged_days: number; window_days: number; current_streak: number; longest_streak: number; modal_mood: string | null }
  cards: PersonalCard[]
  locked: Array<{ title: string; needs: string; remaining: number }>
  has_enough_data: boolean
  crisis_nudge: string | null
  review: PersonalReview
}

const WINDOWS = [14, 30, 90] as const

const CARD_ICON: Record<string, string> = {
  mood_trend: 'ri-line-chart-line',
  symptom_trend: 'ri-pulse-line',
  mood_symptom_assoc: 'ri-links-line',
  spoons_symptom_assoc: 'ri-battery-low-line',
  med_mood_assoc: 'ri-capsule-line',
  therapy_mood_window: 'ri-chat-smile-2-line',
}
const CARD_TINT: Record<string, string> = {
  mood_trend: 'tint-violet',
  symptom_trend: 'tint-terracotta',
  mood_symptom_assoc: 'tint-gold',
  spoons_symptom_assoc: 'tint-blue',
  med_mood_assoc: 'tint-sage',
  therapy_mood_window: 'tint-violet',
}
function disclaimerFor(card: PersonalCard): string {
  switch (card.disclaimer_key) {
    case 'med':
      return 'This reflects your logs, not advice about your medication, your prescriber is the person for that.'
    case 'therapy':
      return 'Everyone’s different, a check-in is just one small signal.'
    default:
      if (card.kind === 'mood_symptom_assoc' || card.kind === 'spoons_symptom_assoc')
        return 'A pattern in your own logs, it can’t tell us what affects what.'
      return 'Just what you’ve logged, not a prediction.'
  }
}
function bandPill(card: PersonalCard): string | null {
  if (card.band === 'slight') return 'a slight pattern'
  if (card.band === 'noticeable') return 'a noticeable pattern'
  if (card.band === 'consistent') return 'a fairly consistent pattern'
  if (card.direction === 'rising') return 'gently rising'
  if (card.direction === 'lower') return 'leaning lower'
  if (card.direction === 'higher') return 'running higher'
  if (card.direction === 'steady') return 'holding steady'
  return null
}

const COVERAGE_BADGE: Record<ReviewCoverageLevel, { label: string; tone: 'neutral' | 'info' | 'success' }> = {
  thin: { label: 'Getting started', tone: 'neutral' },
  building: { label: 'Building', tone: 'info' },
  strong: { label: 'Strong signal', tone: 'success' },
}

function WeeklyReviewPanel({ review, coverage }: { review: PersonalReview; coverage: PersonalInsights['coverage'] }) {
  const badge = COVERAGE_BADGE[review.coverage_level] ?? COVERAGE_BADGE.thin

  return (
    <Card className="relative overflow-hidden border-brand-accent2/25 bg-brand-surface-raised">
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--color-brand-accent1),var(--color-brand-accent2),var(--color-brand-accent3))]" />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="icon-chip tint-gold">
              <i className="ri-compass-3-line" aria-hidden="true" />
            </span>
            <Badge tone={badge.tone}>{badge.label}</Badge>
            {review.focus && <Badge tone="sage">{review.focus}</Badge>}
          </div>
          <div>
            <h2 className="text-xl font-bold text-brand-ink">{review.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-ink/70">{review.summary}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-brand-ink/55">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-ink/[0.05] px-2.5 py-1">
              <i className="ri-calendar-check-line text-brand-accent2" aria-hidden="true" />
              {coverage.logged_days}/{coverage.window_days} days logged
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-ink/[0.05] px-2.5 py-1">
              <i className="ri-fire-line text-brand-accent1" aria-hidden="true" />
              {coverage.current_streak} day streak
            </span>
          </div>
        </div>

        <div className="w-full space-y-2 sm:max-w-sm">
          {review.next_actions.map((action, index) => (
            <div key={action.id} className="rounded-2xl border border-brand-line bg-brand-surface p-3">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                    index === 0 ? 'bg-brand-accent2/15 text-brand-accent2' : 'bg-brand-ink/[0.06] text-brand-ink/60',
                  )}
                >
                  <i className={action.icon} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-brand-ink">{action.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-brand-ink/60">{action.body}</p>
                  <LinkButton href={action.href} variant={index === 0 ? 'primary' : 'secondary'} size="sm" className="mt-3">
                    Start
                  </LinkButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function PersonalCardView({ card }: { card: PersonalCard }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className={cn('icon-chip shrink-0', CARD_TINT[card.kind] ?? 'tint-sage')}>
          <i className={CARD_ICON[card.kind] ?? 'ri-sparkling-line'} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-brand-ink">{card.title}</h3>
            {bandPill(card) && (
              <Badge tone="sage" className="capitalize">
                {bandPill(card)}
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-brand-ink/85">{card.phrase}</p>
          <p className="mt-2 text-xs text-brand-ink/45">
            Based on {card.sample_days} {card.sample_days === 1 ? 'day' : 'days'} you logged
            {card.per_group_counts ? ` · ${card.per_group_counts.a} vs ${card.per_group_counts.b}` : ''}
          </p>
          <p className="mt-1 text-xs italic text-brand-ink/40">{disclaimerFor(card)}</p>
        </div>
      </div>
    </Card>
  )
}

function CoverageStrip({ coverage }: { coverage: PersonalInsights['coverage'] }) {
  const items = [
    { label: 'Days logged', value: `${coverage.logged_days}/${coverage.window_days}`, icon: 'ri-calendar-check-line' },
    { label: 'Current streak', value: `${coverage.current_streak}`, icon: 'ri-fire-line' },
    { label: 'Longest streak', value: `${coverage.longest_streak}`, icon: 'ri-medal-line' },
  ]
  return (
    <Card>
      <div className="grid grid-cols-3 gap-3">
        {items.map((it) => (
          <div key={it.label} className="rounded-xl bg-brand-ink/[0.05] p-3 text-center">
            <i className={cn(it.icon, 'text-brand-accent2')} aria-hidden="true" />
            <p className="mt-1 stat-figure">{it.value}</p>
            <p className="text-xs text-brand-ink/50">{it.label}</p>
          </div>
        ))}
      </div>
      {coverage.modal_mood && (
        <p className="mt-3 text-center text-xs text-brand-ink/55">
          Your most-logged mood lately: <span className="font-semibold capitalize text-brand-ink/80">{coverage.modal_mood}</span>
        </p>
      )}
    </Card>
  )
}

function PersonalSection() {
  const [data, setData] = useState<PersonalInsights | null>(null)
  const [windowDays, setWindowDays] = useState<number>(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setLoading(true)
    })
    DatabaseService.getPersonalInsights(windowDays)
      .then((res) => {
        if (!cancelled) setData(res as PersonalInsights)
      })
      .catch((error) => console.error('Failed to load personal insights:', error))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [windowDays])

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-brand-ink">Your patterns</h2>
          <p className="mt-1 text-sm text-brand-ink/60">
            Gentle reflections of what you&rsquo;ve logged. The more you check in, the clearer they get.
          </p>
        </div>
        <div className="inline-flex rounded-full bg-brand-ink/[0.06] p-0.5 text-xs">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindowDays(w)}
              className={cn(
                'rounded-full px-3 py-1.5 font-medium transition-colors',
                windowDays === w ? 'bg-brand-accent2 text-white' : 'text-brand-ink/60 hover:text-brand-ink')}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : !data ? (
        <Card>
          <p className="text-sm text-brand-ink/60">We couldn&rsquo;t load your patterns just now. Please try again.</p>
        </Card>
      ) : (
        <>
          {data.crisis_nudge && (
            <Alert tone="advice" title="A gentle nudge">
              {data.crisis_nudge}{' '}
              <LinkButton href="/strands" variant="ghost" size="sm" className="mt-2">
                Reach a person
              </LinkButton>
            </Alert>
          )}

          <WeeklyReviewPanel review={data.review} coverage={data.coverage} />
          <CoverageStrip coverage={data.coverage} />

          {data.has_enough_data ? (
            <div className="space-y-3">
              {data.cards.map((card, i) => (
                <PersonalCardView key={`${card.kind}-${card.subject ?? i}`} card={card} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<i className="ri-seedling-line text-4xl" aria-hidden="true" />}
              image="/images/app/empty-insights.webp"
              imageAlt="A small seedling growing"
              title={data.coverage.logged_days < 3 ? 'Your patterns start with a check-in' : 'A little more logging unlocks your patterns'}
              description="These reflections come from your own check-ins. The more days you log mood and symptoms together, the more KinSpace can gently show you."
              action={<LinkButton href="/dashboard">Start today&rsquo;s check-in</LinkButton>}
            />
          )}

          {data.locked.length > 0 && (
            <Card className="space-y-2">
              <p className="eyebrow">Keep logging to unlock</p>
              {data.locked.map((l) => (
                <div key={l.title} className="flex items-center gap-2 text-sm text-brand-ink/60">
                  <i className="ri-lock-2-line text-brand-ink/35" aria-hidden="true" />
                  <span>{l.needs}</span>
                </div>
              ))}
            </Card>
          )}

          <p className="px-1 text-xs leading-relaxed text-brand-ink/45">
            These are gentle reflections of what you&rsquo;ve logged, not medical advice, not a diagnosis, and not
            predictions. Patterns here can&rsquo;t tell us what causes what. For anything about your health or treatment,
            your care team is the right place.
          </p>
        </>
      )}
    </section>
  )
}

export default function InsightsPage() {
  const { user } = useAuth()
  const [insights, setInsights] = useState<InsightBundle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    DatabaseService.getFeaturedInsights(8)
      .then((data) => {
        const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
        setInsights(
          rows.map((bundle) => ({
            condition: (bundle.condition ?? {}) as Condition,
            topTreatments: (bundle.top_treatments ?? bundle.topTreatments ?? []) as TopTreatment[],
          })))
      })
      .catch((error) => console.error('Failed to load insights:', error))
      .finally(() => setLoading(false))
  }, [])

  return (
    <PageFrame containerClassName="max-w-5xl">
      <div className="space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink/45">Insights</p>
          <h1 className="text-2xl font-bold text-brand-ink sm:text-3xl">
            {user ? 'Your health, reflected back' : 'What works for our community'}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-brand-ink/65">
            {user
              ? 'Patterns from your own check-ins, plus what the wider community reports works, honest, never a diagnosis.'
              : 'Top-rated treatments by condition, drawn from clinical evidence and real member experiences.'}
          </p>
        </header>

        {user && <PersonalSection />}

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-brand-ink">{user ? 'What works across our community' : 'What works for our community'}</h2>
            <p className="mt-1 max-w-2xl text-sm text-brand-ink/60">
              Top-rated treatments by condition. Open any condition for the full evidence page, stories, and side-effect patterns.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <LinkButton href="/conditions" size="sm">Browse all conditions</LinkButton>
              <LinkButton href="/treatments" variant="secondary" size="sm">Browse treatments</LinkButton>
              <LinkButton href="/share-experience" variant="secondary" size="sm">Share yours</LinkButton>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="space-y-4">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-11 w-full rounded-full" />
                </Card>
              ))}
            </div>
          ) : insights.length === 0 ? (
            <EmptyState
              icon={<i className="ri-heart-pulse-line text-4xl" aria-hidden="true" />}
              title="No insights yet"
              description="Once members start sharing their experiences, the top-rated treatments will gather here."
              action={<LinkButton href="/share-experience">Share your experience</LinkButton>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {insights.map(({ condition, topTreatments }) => (
                <Card key={condition.id} className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <Badge className="bg-brand-accent3/15 capitalize text-brand-accent3">
                      {(condition.category as string) ?? 'condition'}
                    </Badge>
                    <span className="text-xs text-brand-ink/45">
                      {formatCompactNumber((condition.member_count as number | undefined) ?? 0)} members
                    </span>
                  </div>
                  <CardTitle className="mt-3 text-lg">{condition.name as string}</CardTitle>
                  {topTreatments.length === 0 ? (
                    <p className="mt-3 text-sm text-brand-ink/55">No ranked treatments yet.</p>
                  ) : (
                    <ol className="mt-3 space-y-2">
                      {topTreatments
                        .filter((entry) => entry.treatment)
                        .slice(0, 3)
                        .map((entry, index) => (
                          <li key={entry.id} className="flex items-center justify-between gap-3 rounded-xl bg-brand-ink/5 px-3 py-2 text-sm">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="font-bold text-brand-accent2">#{index + 1}</span>
                              <span className="truncate text-brand-ink/85">{entry.treatment?.name as string}</span>
                            </span>
                            <span className="shrink-0 font-semibold text-brand-accent2">
                              {((entry.effectiveness_avg as number | undefined) ?? 0).toFixed(1)}/5
                            </span>
                          </li>
                        ))}
                    </ol>
                  )}
                  <LinkButton href={`/conditions/${condition.id}`} variant="secondary" fullWidth className="mt-4">
                    See full ranking
                  </LinkButton>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
