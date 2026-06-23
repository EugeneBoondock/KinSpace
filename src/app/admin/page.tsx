'use client'

import { useEffect, useMemo, useState } from 'react'
import PageFrame from '@/components/PageFrame'
import BottomNav from '@/components/BottomNav'
import { DatabaseService } from '@/lib/database'
import { resolveReportAction } from '@/app/actions/moderation'
import { formatCompactNumber, formatRelativeTime } from '@/lib/platform'
import { Badge, Card, EmptyState, Skeleton } from '@/components/ui'

type Stats = {
  users: Record<string, number>
  content: Record<string, number>
  signups_daily: { date: string; count: number }[]
  recent_signups: { username: string; joined: string; verified: boolean }[]
  generated_at: string
}
type Traffic =
  | { configured: false }
  | { configured: true; error?: string; days?: { date: string; pageviews: number; requests: number; uniques: number }[]; totals?: { pageviews: number; requests: number; uniques: number } }
type BugRow = {
  id: string
  title: string
  description: string
  page_url: string | null
  severity: string
  status: string
  created_at: string | number
  reporter: { username?: string; full_name?: string | null } | null
}

type ReportRow = {
  id: string
  target_type: string
  target_id: string
  target_owner_id: string | null
  reason: string
  detail: string | null
  status: string
  created_at: string | number
  reporter_name: string
  owner_name: string | null
  preview: string
}

const REPORT_REASON_LABELS: Record<string, string> = {
  harassment: 'Harassment',
  spam: 'Spam',
  self_harm: 'Self-harm risk',
  misinformation: 'Misinformation',
  nsfw: 'Explicit',
  impersonation: 'Impersonation',
  other: 'Other',
}

const BUG_STATUSES = ['open', 'investigating', 'resolved', 'closed'] as const
const BUG_STATUS_TONE: Record<string, 'gold' | 'violet' | 'sage' | 'blue'> = {
  open: 'gold',
  investigating: 'violet',
  resolved: 'sage',
  closed: 'blue',
}
const SEVERITY_TONE: Record<string, 'terracotta' | 'gold' | 'sage'> = {
  high: 'terracotta',
  normal: 'gold',
  low: 'sage',
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [traffic, setTraffic] = useState<Traffic | null>(null)
  const [bugs, setBugs] = useState<BugRow[] | null>(null)
  const [reports, setReports] = useState<ReportRow[] | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'forbidden' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = (await DatabaseService.getAdminStats()) as Stats
        if (cancelled) return
        setStats(s)
        setState('ready')
        // Traffic is best-effort; never blocks the page.
        DatabaseService.getAdminTraffic()
          .then((t) => !cancelled && setTraffic(t as Traffic))
          .catch(() => !cancelled && setTraffic({ configured: false }))
        DatabaseService.getBugReports()
          .then((b) => !cancelled && setBugs(b as BugRow[]))
          .catch(() => !cancelled && setBugs([]))
        DatabaseService.getModerationReports()
          .then((r) => !cancelled && setReports(r as ReportRow[]))
          .catch(() => !cancelled && setReports([]))
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : ''
        setState(/not authorized/i.test(msg) ? 'forbidden' : 'error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setBugStatus = async (id: string, status: string) => {
    setBugs((prev) => prev?.map((b) => (b.id === id ? { ...b, status } : b)) ?? prev)
    try {
      await DatabaseService.updateBugReportStatus(id, status)
    } catch {
      DatabaseService.getBugReports()
        .then((b) => setBugs(b as BugRow[]))
        .catch(() => undefined)
    }
  }

  const resolveReport = async (report: ReportRow, decision: 'actioned' | 'dismissed') => {
    setReports((prev) => prev?.filter((r) => r.id !== report.id) ?? prev)
    try {
      const options =
        decision === 'actioned' && (report.target_type === 'post' || report.target_type === 'comment')
          ? { targetType: report.target_type, targetId: report.target_id }
          : undefined
      const result = await resolveReportAction(report.id, decision, options)
      if (!result.ok) throw new Error(result.error)
    } catch {
      // Re-sync on failure so the queue reflects the true server state.
      DatabaseService.getModerationReports()
        .then((r) => setReports(r as ReportRow[]))
        .catch(() => undefined)
    }
  }

  return (
    <PageFrame containerClassName="max-w-5xl">
      <div className="space-y-8 pb-12">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink/45">Owner</p>
          <h1 className="text-2xl font-black tracking-tight text-brand-ink sm:text-3xl">Admin overview</h1>
          {stats && (
            <p className="text-sm text-brand-ink/55">
              Live from the database, refreshed {formatRelativeTime(stats.generated_at)}.
            </p>
          )}
        </header>

        {state === 'loading' && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
              </Card>
            ))}
          </div>
        )}

        {state === 'forbidden' && (
          <EmptyState
            icon={<i className="ri-lock-2-line text-4xl" aria-hidden="true" />}
            title="Admins only"
            description="This dashboard is limited to KinSpace administrators. If that should be you, ask an existing admin to grant your account the admin role."
          />
        )}

        {state === 'error' && (
          <EmptyState
            icon={<i className="ri-error-warning-line text-4xl" aria-hidden="true" />}
            title="Couldn't load the dashboard"
            description="Something went wrong fetching the stats. Please refresh and try again."
          />
        )}

        {state === 'ready' && stats && (
          <>
            {/* ── Members ── */}
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-brand-ink">Members</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Total members" value={stats.users.total} icon="ri-team-line" tone="accent2" big />
                <StatCard label="New, last 7 days" value={stats.users.new_7d} icon="ri-user-add-line" tone="accent3" />
                <StatCard label="New, last 30 days" value={stats.users.new_30d} icon="ri-line-chart-line" tone="accent3" />
                <StatCard label="Active, last 7 days" value={stats.users.active_7d} icon="ri-pulse-line" tone="accent5" />
                <StatCard label="Verified" value={stats.users.verified} icon="ri-shield-check-line" tone="accent2" />
                <StatCard label="Onboarded" value={stats.users.onboarded} icon="ri-checkbox-circle-line" tone="accent2" />
                <StatCard label="New, last 24h" value={stats.users.new_24h} icon="ri-time-line" tone="accent4" />
                <StatCard label="Admins" value={stats.users.admins} icon="ri-vip-crown-line" tone="accent1" />
              </div>
              <Sparkline data={stats.signups_daily} />
            </section>

            {/* ── Traffic (Cloudflare) ── */}
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-brand-ink">Traffic</h2>
              <TrafficPanel traffic={traffic} />
            </section>

            {/* ── Content ── */}
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-brand-ink">Content &amp; activity</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Posts" value={stats.content.posts} icon="ri-chat-3-line" tone="accent4" />
                <StatCard label="Comments" value={stats.content.comments} icon="ri-chat-quote-line" tone="accent4" />
                <StatCard label="Messages" value={stats.content.messages} icon="ri-mail-line" tone="accent5" />
                <StatCard label="Groups" value={stats.content.groups} icon="ri-group-line" tone="accent3" />
                <StatCard label="Connections" value={stats.content.connections} icon="ri-links-line" tone="accent2" />
                <StatCard label="Conditions" value={stats.content.conditions} icon="ri-stethoscope-line" tone="accent3" />
                <StatCard label="Therapy sessions" value={stats.content.therapy_sessions} icon="ri-mental-health-line" tone="accent1" />
              </div>
            </section>

            {/* ── Bug reports ── */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-brand-ink">Bug reports</h2>
                {bugs && bugs.length > 0 && (
                  <span className="text-xs text-brand-ink/50">
                    {bugs.filter((b) => b.status === 'open').length} open
                  </span>
                )}
              </div>
              {bugs === null ? (
                <Skeleton className="h-16 rounded-2xl" />
              ) : bugs.length === 0 ? (
                <Card>
                  <p className="text-sm text-brand-ink/55">No bug reports yet.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {bugs.map((b) => (
                    <Card key={b.id} className="space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-brand-ink">{b.title}</p>
                          {b.description && <p className="mt-0.5 text-xs leading-relaxed text-brand-ink/60">{b.description}</p>}
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-brand-ink/45">
                            <span>@{b.reporter?.username ?? 'member'}</span>
                            {b.page_url && <span>· {b.page_url}</span>}
                            <span>· {formatRelativeTime(b.created_at)}</span>
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Badge tone={SEVERITY_TONE[b.severity] ?? 'gold'} className="capitalize">{b.severity}</Badge>
                          <Badge tone={BUG_STATUS_TONE[b.status] ?? 'gold'} className="capitalize">{b.status}</Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 border-t border-brand-line pt-2.5">
                        {BUG_STATUSES.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setBugStatus(b.id, s)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                              b.status === s
                                ? 'bg-brand-accent2 text-white'
                                : 'bg-brand-ink/[0.06] text-brand-ink/60 hover:bg-brand-ink/10'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* ── Moderation reports ── */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-brand-ink">Reports</h2>
                {reports && reports.length > 0 && (
                  <span className="text-xs text-brand-ink/50">{reports.length} open</span>
                )}
              </div>
              {reports === null ? (
                <Skeleton className="h-16 rounded-2xl" />
              ) : reports.length === 0 ? (
                <Card>
                  <p className="text-sm text-brand-ink/55">No open reports. The community is quiet.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {reports.map((r) => {
                    const canTakedown = r.target_type === 'post' || r.target_type === 'comment'
                    return (
                      <Card key={r.id} className="space-y-2.5">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-brand-ink">
                            <Badge tone="terracotta" className="capitalize">
                              {REPORT_REASON_LABELS[r.reason] ?? r.reason}
                            </Badge>
                            <span className="capitalize text-brand-ink/55">{r.target_type}</span>
                          </p>
                          {r.preview && (
                            <p className="mt-1.5 line-clamp-3 rounded-xl bg-brand-ink/[0.04] px-3 py-2 text-xs leading-relaxed text-brand-ink/70">
                              {r.preview}
                            </p>
                          )}
                          {r.detail && <p className="mt-1 text-xs italic text-brand-ink/55">&ldquo;{r.detail}&rdquo;</p>}
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-brand-ink/45">
                            <span>by @{r.reporter_name}</span>
                            {r.owner_name && <span>· on @{r.owner_name}&rsquo;s {r.target_type}</span>}
                            <span>· {formatRelativeTime(r.created_at)}</span>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 border-t border-brand-line pt-2.5">
                          <button
                            type="button"
                            onClick={() => resolveReport(r, 'dismissed')}
                            className="rounded-full bg-brand-ink/[0.06] px-2.5 py-1 text-xs font-medium text-brand-ink/60 transition-colors hover:bg-brand-ink/10"
                          >
                            Dismiss
                          </button>
                          <button
                            type="button"
                            onClick={() => resolveReport(r, 'actioned')}
                            className="rounded-full bg-brand-accent1 px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
                          >
                            {canTakedown ? 'Take down content' : 'Mark handled'}
                          </button>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </section>

            {/* ── Recent signups ── */}
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-brand-ink">Recent signups</h2>
              <Card className="divide-y divide-brand-line p-0">
                {stats.recent_signups.length === 0 ? (
                  <p className="p-4 text-sm text-brand-ink/55">No signups yet.</p>
                ) : (
                  stats.recent_signups.map((u, i) => (
                    <div key={`${u.username}-${i}`} className="flex items-center justify-between gap-3 p-3.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <i className="ri-user-3-line text-brand-ink/40" aria-hidden="true" />
                        <span className="truncate text-sm font-medium text-brand-ink">@{u.username}</span>
                        {u.verified ? (
                          <Badge tone="sage" className="shrink-0">Verified</Badge>
                        ) : (
                          <Badge tone="gold" className="shrink-0">Email unverified</Badge>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-brand-ink/50">{formatRelativeTime(u.joined)}</span>
                    </div>
                  ))
                )}
              </Card>
            </section>
          </>
        )}
      </div>

      <BottomNav />
    </PageFrame>
  )
}

const TONE_CLASS: Record<string, string> = {
  accent1: 'text-brand-accent1',
  accent2: 'text-brand-accent2',
  accent3: 'text-brand-accent3',
  accent4: 'text-brand-accent4',
  accent5: 'text-brand-accent5',
}

function StatCard({ label, value, icon, tone, big }: { label: string; value: number; icon: string; tone: string; big?: boolean }) {
  return (
    <Card className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-brand-ink/55">{label}</span>
        <i className={`${icon} ${TONE_CLASS[tone] ?? 'text-brand-ink/40'}`} aria-hidden="true" />
      </div>
      <p className={`font-black tracking-tight text-brand-ink ${big ? 'text-3xl' : 'text-2xl'}`}>
        {formatCompactNumber(value ?? 0)}
      </p>
    </Card>
  )
}

function Sparkline({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-brand-ink">Signups, last 14 days</span>
        <span className="text-xs text-brand-ink/50">{data.reduce((s, d) => s + d.count, 0)} total</span>
      </div>
      <div className="flex h-24 items-end gap-1.5">
        {data.map((d) => (
          <div key={d.date} className="group relative flex-1" title={`${d.date}: ${d.count}`}>
            <div
              className="w-full rounded-t bg-brand-accent2/70 transition-colors group-hover:bg-brand-accent2"
              style={{ height: `${Math.max(4, (d.count / max) * 96)}px` }}
            />
          </div>
        ))}
      </div>
    </Card>
  )
}

function TrafficPanel({ traffic }: { traffic: Traffic | null }) {
  if (traffic === null) {
    return (
      <Card className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-32" />
      </Card>
    )
  }

  if (!traffic.configured) {
    return (
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <i className="ri-bar-chart-box-line text-brand-accent3" aria-hidden="true" />
          <span className="text-sm font-semibold text-brand-ink">Connect Cloudflare analytics</span>
        </div>
        <p className="text-sm leading-relaxed text-brand-ink/65">
          Live traffic comes from Cloudflare&rsquo;s own zone analytics. To switch it on, add two secrets to the
          Worker, then redeploy:
        </p>
        <ul className="space-y-1 text-sm text-brand-ink/70">
          <li><code className="rounded bg-brand-ink/[0.06] px-1.5 py-0.5 text-xs">CLOUDFLARE_API_TOKEN</code> (scope: Analytics, Read)</li>
          <li><code className="rounded bg-brand-ink/[0.06] px-1.5 py-0.5 text-xs">CLOUDFLARE_ZONE_TAG</code> (the kinspace.co.za zone ID)</li>
        </ul>
        <a
          href="https://dash.cloudflare.com/?to=/:account/:zone/analytics/traffic"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent2 hover:underline"
        >
          Open the Cloudflare traffic dashboard <i className="ri-external-link-line" aria-hidden="true" />
        </a>
      </Card>
    )
  }

  if (traffic.error) {
    return (
      <Card className="space-y-2">
        <span className="text-sm font-semibold text-brand-ink">Traffic unavailable</span>
        <p className="text-sm text-brand-ink/65">{traffic.error}</p>
      </Card>
    )
  }

  const days = traffic.days ?? []
  const totals = traffic.totals ?? { pageviews: 0, requests: 0, uniques: 0 }
  const max = Math.max(1, ...days.map((d) => d.pageviews))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Page views, 7d" value={totals.pageviews} icon="ri-eye-line" tone="accent2" big />
        <StatCard label="Unique visitors, 7d" value={totals.uniques} icon="ri-user-line" tone="accent3" big />
        <StatCard label="Requests, 7d" value={totals.requests} icon="ri-exchange-line" tone="accent5" big />
      </div>
      <Card className="space-y-3">
        <span className="text-sm font-semibold text-brand-ink">Page views by day</span>
        <div className="flex h-24 items-end gap-2">
          {days.map((d) => (
            <div key={d.date} className="flex-1" title={`${d.date}: ${d.pageviews} views`}>
              <div
                className="w-full rounded-t bg-brand-accent3/70"
                style={{ height: `${Math.max(4, (d.pageviews / max) * 96)}px` }}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
