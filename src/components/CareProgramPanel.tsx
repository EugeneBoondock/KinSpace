'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { isTransientFetchError } from '@/lib/client-errors'
import { Badge, Card, LinkButton, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'

type Track = {
  id: string
  label: string
  title: string
  body: string
  href: string
  icon: string
  progress: number
  state: 'done' | 'next' | 'active'
}

type WeekDay = {
  day: string
  label: string
  active: boolean
  completed_count: number
  markers: string[]
}

type Program = {
  stage: string
  stage_label: string
  title: string
  body: string
  readiness_score: number
  featured_action: Track
  tracks: Track[]
  week: WeekDay[]
}

type CareProgramPanelProps = {
  compact?: boolean
  className?: string
}

const markerClass: Record<string, string> = {
  checkin: 'bg-brand-accent3',
  body: 'bg-brand-accent2',
  mind: 'bg-brand-accent4',
  people: 'bg-brand-accent5',
  play: 'bg-brand-accent1',
}

function progressLabel(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

export default function CareProgramPanel({ compact = false, className }: CareProgramPanelProps) {
  const { user } = useAuth()
  const [program, setProgram] = useState<Program | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    let active = true
    const userId = user.userId
    async function load() {
      try {
        setLoading(true)
        const result = (await DatabaseService.getCareProgram(userId)) as Program
        if (active) setProgram(result)
      } catch (error) {
        if (!active) return
        setProgram(null)
        if (!isTransientFetchError(error)) console.error('Failed to load care program:', error)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    const refresh = () => void load()
    window.addEventListener('kinspace:daily-quest-refresh', refresh)
    return () => {
      active = false
      window.removeEventListener('kinspace:daily-quest-refresh', refresh)
    }
  }, [user])

  const sortedTracks = useMemo(() => {
    if (!program) return []
    return [...program.tracks].sort((first, second) => {
      if (first.state === 'next') return -1
      if (second.state === 'next') return 1
      return Number(first.progress >= 1) - Number(second.progress >= 1)
    })
  }, [program])

  if (loading) {
    return (
      <Card className={cn('overflow-hidden border-brand-accent5/25 bg-brand-accent5/[0.05]', className)}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-4">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-9 w-80 max-w-full rounded-2xl" />
            <div className="grid gap-2 sm:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-2xl" />
              ))}
            </div>
          </div>
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      </Card>
    )
  }

  if (!program) return null

  return (
    <Card className={cn('overflow-hidden border-brand-accent5/25 bg-brand-accent5/[0.05] p-0', className)}>
      <div className={cn('grid gap-0', compact ? 'lg:grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_18rem]')}>
        <div className="p-5 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">
                  <i className="ri-road-map-line" aria-hidden="true" />
                  Care program
                </Badge>
                <span className="text-xs font-semibold text-brand-background/55">{program.stage_label}</span>
              </div>
              <h2 className="mt-3 max-w-3xl text-xl font-bold text-brand-background sm:text-2xl">
                {program.title}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-brand-background/65">{program.body}</p>
            </div>
            <LinkButton
              href={program.featured_action.href}
              size="sm"
              className="shrink-0"
              leadingIcon={<i className={program.featured_action.icon} aria-hidden="true" />}
            >
              Open next
            </LinkButton>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[13rem_minmax(0,1fr)]">
            <div className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.05] p-4">
              <p className="text-xs font-medium text-brand-background/55">Readiness score</p>
              <p className="mt-2 text-4xl font-bold tracking-normal text-brand-background">{program.readiness_score}</p>
              <div
                className="mt-4 h-2 overflow-hidden rounded-full bg-brand-background/[0.08]"
                role="progressbar"
                aria-label="Care readiness score"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={program.readiness_score}
              >
                <div
                  className="h-full rounded-full bg-brand-accent5 transition-[width] duration-500"
                  style={{ width: `${program.readiness_score}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-brand-background/55">Last 7 days</p>
                <Link href="/timeline" className="text-xs font-semibold text-brand-accent5 hover:text-brand-accent5/80">
                  Timeline
                </Link>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-2">
                {program.week.map((day) => (
                  <div
                    key={day.day}
                    className={cn(
                      'min-h-24 rounded-2xl border p-2 text-center',
                      day.active
                        ? 'border-brand-accent5/35 bg-brand-accent5/[0.10]'
                        : 'border-brand-background/10 bg-brand-background/[0.04]',
                    )}
                  >
                    <p className="text-[11px] font-semibold text-brand-background/60">{day.label}</p>
                    <p className="mt-1 text-[10px] text-brand-background/40">{day.day.slice(8, 10)}</p>
                    <div className="mt-3 flex min-h-7 flex-wrap justify-center gap-1">
                      {day.markers.length > 0 ? (
                        day.markers.slice(0, 5).map((marker) => (
                          <span
                            key={`${day.day}-${marker}`}
                            className={cn('h-2 w-2 rounded-full', markerClass[marker] ?? 'bg-brand-background/30')}
                          />
                        ))
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-brand-background/15" />
                      )}
                    </div>
                    <p className="mt-2 text-[10px] font-semibold text-brand-background/45">
                      {day.completed_count}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {sortedTracks.map((track) => (
              <Link
                href={track.href}
                key={track.id}
                className={cn(
                  'group flex min-h-36 flex-col rounded-2xl border p-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                  track.state === 'next'
                    ? 'border-brand-accent5/45 bg-brand-accent5/[0.10]'
                    : track.state === 'done'
                      ? 'border-brand-accent3/30 bg-brand-accent3/[0.07]'
                      : 'border-brand-background/10 bg-brand-background/[0.04] hover:-translate-y-0.5 hover:bg-brand-background/[0.07]',
                )}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-background/[0.06] text-brand-background">
                    <i className={`${track.state === 'done' ? 'ri-check-line' : track.icon} text-lg`} aria-hidden="true" />
                  </span>
                  <span className="rounded-full bg-brand-background/[0.06] px-2 py-0.5 text-[11px] font-semibold text-brand-background/55">
                    {track.state === 'next' ? 'Next' : progressLabel(track.progress)}
                  </span>
                </span>
                <span className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-background/45">
                  {track.label}
                </span>
                <span className="mt-1 text-sm font-bold leading-tight text-brand-background">{track.title}</span>
                <span className="mt-1 line-clamp-3 text-xs leading-relaxed text-brand-background/55">{track.body}</span>
              </Link>
            ))}
          </div>
        </div>

        {!compact && (
          <aside className="border-t border-brand-background/10 bg-brand-background/[0.04] p-5 lg:border-l lg:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-background/45">Next move</p>
            <div className="mt-3 rounded-2xl border border-brand-background/10 bg-brand-background/[0.05] p-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent5/[0.14] text-brand-accent5">
                <i className={`${program.featured_action.icon} text-2xl`} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-bold text-brand-background">{program.featured_action.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-background/60">{program.featured_action.body}</p>
              <LinkButton href={program.featured_action.href} size="sm" className="mt-4 w-full">
                Start
              </LinkButton>
            </div>
          </aside>
        )}
      </div>
    </Card>
  )
}
