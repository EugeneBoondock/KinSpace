'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { DatabaseService } from '@/lib/database'
import { formatCompactNumber, formatRelativeTime } from '@/lib/platform'
import { Alert, Badge, Card, CardTitle, EmptyState, LinkButton, Skeleton } from '@/components/ui'

type TreatmentDoc = Record<string, unknown> & { id: string }
type EvidenceCondition = {
  slug: string
  name: string
  description: string | null
  category: string | null
  report_count: number
  effectiveness_avg: number
  side_effects: Array<{ name: string; count: number; prevalence_pct: number }>
  confidence_label: string
  source_label: string
}
type EvidenceReport = {
  id: string
  condition_slug: string
  condition_name: string
  effectiveness: number | null
  symptoms: string[]
  triggers: string[]
  side_effects: string[]
  updated_at: string | null
  created_at: string | null
  is_anonymized: boolean
}
type TreatmentEvidence = {
  treatment: TreatmentDoc
  total_report_count: number
  condition_count: number
  overall_effectiveness_avg: number | null
  side_effects: Array<{ name: string; count: number; prevalence_pct: number }>
  conditions: EvidenceCondition[]
  reports: EvidenceReport[]
}

function RatingBar({ value }: { value: number | null }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, (value / 5) * 100))
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-brand-background/10"
      role="meter"
      aria-valuenow={value ?? 0}
      aria-valuemin={0}
      aria-valuemax={5}
      aria-label="Average member rating"
    >
      <div className="h-full rounded-full bg-gradient-to-r from-brand-accent3 to-brand-accent2" style={{ width: `${pct}%` }} />
    </div>
  )
}

function EvidencePills({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item} className="capitalize">
          {item}
        </Badge>
      ))}
    </div>
  )
}

export default function TreatmentDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug as string | undefined

  const [evidence, setEvidence] = useState<TreatmentEvidence | null>(null)
  const [treatment, setTreatment] = useState<TreatmentDoc | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    DatabaseService.getTreatmentEvidence(slug)
      .then((result) => {
        if (cancelled) return
        const doc = result as TreatmentEvidence | null
        setEvidence(doc)
        setTreatment(doc?.treatment ?? null)
      })
      .catch((error) => console.error('Failed to load treatment evidence:', error))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) {
    return (
      <PageFrame containerClassName="max-w-5xl">
        <div className="space-y-5">
          <Card className="space-y-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
          </Card>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  if (!treatment) {
    return (
      <PageFrame containerClassName="max-w-3xl">
        <EmptyState
          icon={<i className="ri-capsule-line text-4xl" aria-hidden="true" />}
          title="We could not find that treatment"
          description="It may have been moved or the link is out of date. Browse the directory to find what you need."
          action={<LinkButton href="/treatments">Browse treatments</LinkButton>}
        />
        <BottomNav />
      </PageFrame>
    )
  }

  const treatmentName = treatment.name as string
  const description = (treatment.description as string | undefined) ?? (treatment.summary as string | undefined)
  const totalReports = evidence?.total_report_count ?? 0
  const conditions = evidence?.conditions ?? []
  const sideEffects = evidence?.side_effects ?? []
  const reports = evidence?.reports ?? []
  const avg = evidence?.overall_effectiveness_avg ?? null

  return (
    <PageFrame containerClassName="max-w-5xl">
      <div className="space-y-6">
        <Link
          href="/treatments"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-accent2 transition-colors hover:text-brand-background"
        >
          <i className="ri-arrow-left-line" aria-hidden="true" />
          All treatments
        </Link>

        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-brand-accent3/15 capitalize text-brand-accent3">
              {(treatment.kind as string) ?? 'treatment'}
            </Badge>
            <Badge>{formatCompactNumber(totalReports)} report summaries</Badge>
            {conditions.length > 0 && <Badge tone="info">{formatCompactNumber(conditions.length)} conditions</Badge>}
            {(treatment.status as string) === 'pending' && <Badge tone="warning">Pending review</Badge>}
          </div>
          <h1 className="text-2xl font-bold text-brand-background sm:text-3xl">{treatmentName}</h1>
          {description && (
            <p className="max-w-2xl text-base leading-relaxed text-brand-background/70">
              {description}
            </p>
          )}
          <div className="pt-1">
            <LinkButton
              href={`/share-experience?treatment=${slug}`}
              leadingIcon={<i className="ri-add-line" aria-hidden="true" />}
            >
              Share your experience
            </LinkButton>
          </div>
        </header>

        <Alert tone="info" title="Member-reported data">
          These summaries come from KinSpace member reports and experience ratings. They are not medical advice.
          Talk with your care team before changing treatment.
        </Alert>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="space-y-5">
            <Card>
              <CardTitle className="text-lg">Reported across conditions</CardTitle>
              {conditions.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-brand-background/60">
                  No member evidence yet. If you use this treatment,{' '}
                  <Link
                    href={`/share-experience?treatment=${slug}`}
                    className="font-medium text-brand-accent2 hover:text-brand-background"
                  >
                    share your experience
                  </Link>{' '}
                  to help others.
                </p>
              ) : (
                <ol className="mt-4 space-y-3">
                  {conditions.map((condition, index) => (
                    <li key={condition.slug} className="rounded-2xl bg-brand-background/[0.05] p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-brand-accent2">#{index + 1}</span>
                            <Link
                              href={`/conditions/${condition.slug}`}
                              className="text-base font-semibold text-brand-background transition-colors hover:text-brand-accent2"
                            >
                              {condition.name}
                            </Link>
                            <Badge tone={condition.confidence_label === 'Well reported' ? 'success' : 'warning'}>
                              {condition.confidence_label}
                            </Badge>
                            <Badge>{condition.source_label}</Badge>
                          </div>
                          {condition.description && (
                            <p className="mt-2 text-sm leading-relaxed text-brand-background/60">
                              {condition.description}
                            </p>
                          )}
                          {condition.side_effects.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {condition.side_effects.slice(0, 4).map((sideEffect) => (
                                <Badge key={sideEffect.name} tone="info">
                                  {sideEffect.name} {sideEffect.prevalence_pct}%
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="w-full shrink-0 sm:w-32 sm:text-right">
                          <p className="text-2xl font-bold text-brand-accent2">{condition.effectiveness_avg.toFixed(1)}</p>
                          <p className="text-xs text-brand-background/45">
                            {condition.report_count} {condition.report_count === 1 ? 'rating' : 'ratings'}
                          </p>
                          <div className="mt-2">
                            <RatingBar value={condition.effectiveness_avg} />
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card>
              <CardTitle className="text-lg">Anonymized report summaries</CardTitle>
              {reports.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-brand-background/60">
                  No anonymized report summaries yet. Structured reports will appear here when members contribute through condition pages.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {reports.map((report) => (
                    <article key={report.id} className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.04] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Link
                            href={`/conditions/${report.condition_slug}`}
                            className="text-sm font-semibold text-brand-background transition-colors hover:text-brand-accent2"
                          >
                            {report.condition_name}
                          </Link>
                          <p className="mt-1 text-xs text-brand-background/45">
                            Updated {formatRelativeTime(report.updated_at ?? report.created_at)}
                          </p>
                        </div>
                        <Badge tone="sage">Anonymized</Badge>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-background/40">
                            Symptoms
                          </p>
                          <div className="mt-2">
                            <EvidencePills items={report.symptoms} />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-background/40">
                            Triggers
                          </p>
                          <div className="mt-2">
                            <EvidencePills items={report.triggers} />
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-brand-background/55">
                        {report.effectiveness != null && (
                          <span className="rounded-full bg-brand-accent2/15 px-2.5 py-1 font-semibold text-brand-accent2">
                            Effectiveness {report.effectiveness}/5
                          </span>
                        )}
                        {report.side_effects.length > 0 && (
                          <span>Side effects: {report.side_effects.join(', ')}</span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <aside className="space-y-5">
            <Card>
              <CardTitle className="text-lg">At a glance</CardTitle>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl bg-brand-background/[0.06] p-4">
                  <p className="text-xs text-brand-background/45">Average rating</p>
                  <p className="mt-1 text-2xl font-bold text-brand-background">
                    {avg == null ? 'Not enough data' : avg.toFixed(1)}
                  </p>
                  <div className="mt-2">
                    <RatingBar value={avg} />
                  </div>
                </div>
                <div className="rounded-xl bg-brand-background/[0.06] p-4">
                  <p className="text-xs text-brand-background/45">Report summaries</p>
                  <p className="mt-1 text-xl font-semibold text-brand-background">{formatCompactNumber(totalReports)}</p>
                </div>
                <div className="rounded-xl bg-brand-background/[0.06] p-4">
                  <p className="text-xs text-brand-background/45">Conditions</p>
                  <p className="mt-1 text-xl font-semibold text-brand-background">
                    {formatCompactNumber(evidence?.condition_count ?? 0)}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <CardTitle className="text-lg">Side effects reported</CardTitle>
              {sideEffects.length === 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-brand-background/60">
                  No side effects have been reported for this treatment yet.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {sideEffects.map((sideEffect) => (
                    <div key={sideEffect.name}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-brand-background">{sideEffect.name}</span>
                        <span className="text-xs font-semibold text-brand-accent2">{sideEffect.prevalence_pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand-background/10">
                        <div
                          className="h-full rounded-full bg-brand-accent2"
                          style={{ width: `${Math.max(4, sideEffect.prevalence_pct)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-brand-background/45">
                        {sideEffect.count} {sideEffect.count === 1 ? 'report' : 'reports'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </aside>
        </div>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
