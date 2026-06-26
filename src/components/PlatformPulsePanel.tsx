'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { isTransientFetchError } from '@/lib/client-errors'
import { Badge, Card, LinkButton, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'

type PulseAction = {
  id: string
  label: string
  title: string
  body: string
  href: string
  icon: string
  count: number
  tone: 'gold' | 'sage' | 'blue' | 'violet' | 'terracotta'
}

type PulseStat = {
  id: string
  label: string
  value: number | string
  detail: string
  icon: string
}

type Pulse = {
  status: 'needs_attention' | 'alive' | 'quiet'
  headline: string
  body: string
  priority_actions: PulseAction[]
  stats: PulseStat[]
}

const toneClass: Record<PulseAction['tone'], string> = {
  gold: 'bg-brand-accent2/[0.16] text-brand-accent2',
  sage: 'bg-brand-accent3/[0.16] text-brand-accent3',
  blue: 'bg-brand-accent5/[0.16] text-brand-accent5',
  violet: 'bg-brand-accent4/[0.16] text-brand-accent4',
  terracotta: 'bg-brand-accent1/[0.14] text-brand-accent1',
}

export default function PlatformPulsePanel() {
  const { user } = useAuth()
  const [pulse, setPulse] = useState<Pulse | null>(null)
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
        const result = (await DatabaseService.getPlatformPulse(userId)) as Pulse
        if (active) setPulse(result)
      } catch (error) {
        if (!active) return
        setPulse(null)
        if (!isTransientFetchError(error)) console.error('Failed to load platform pulse:', error)
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

  const primaryAction = pulse?.priority_actions[0] ?? null
  const visibleActions = useMemo(() => pulse?.priority_actions.slice(0, 4) ?? [], [pulse])

  if (loading) {
    return (
      <Card className="overflow-hidden border-brand-accent2/25 bg-brand-accent2/[0.05]">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-4">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-10 w-80 max-w-full rounded-2xl" />
            <div className="grid gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-2xl" />
              ))}
            </div>
          </div>
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      </Card>
    )
  }

  if (!pulse) return null

  return (
    <Card className="overflow-hidden border-brand-accent2/25 bg-brand-accent2/[0.05] p-0">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="p-5 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={pulse.status === 'needs_attention' ? 'gold' : pulse.status === 'alive' ? 'blue' : 'sage'}>
                  <i className="ri-pulse-line" aria-hidden="true" />
                  Live pulse
                </Badge>
                <span className="text-xs font-semibold text-brand-background/55">
                  {pulse.status === 'needs_attention' ? 'Needs you' : pulse.status === 'alive' ? 'Live now' : 'Quiet start'}
                </span>
              </div>
              <h2 className="mt-3 max-w-3xl text-xl font-bold text-brand-background sm:text-2xl">
                {pulse.headline}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-brand-background/65">{pulse.body}</p>
            </div>
            {primaryAction && (
              <LinkButton
                href={primaryAction.href}
                size="sm"
                className="shrink-0"
                leadingIcon={<i className={primaryAction.icon} aria-hidden="true" />}
              >
                Open first
              </LinkButton>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {pulse.stats.map((stat) => (
              <div key={stat.id} className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.05] p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-background/[0.06] text-brand-background">
                    <i className={`${stat.icon} text-lg`} aria-hidden="true" />
                  </span>
                  <p className="text-2xl font-bold tracking-normal text-brand-background">{stat.value}</p>
                </div>
                <p className="mt-3 text-sm font-semibold text-brand-background">{stat.label}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-brand-background/55">{stat.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {visibleActions.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="group flex min-h-32 flex-col rounded-2xl border border-brand-background/10 bg-brand-background/[0.04] p-4 transition-all hover:-translate-y-0.5 hover:bg-brand-background/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', toneClass[item.tone])}>
                    <i className={`${item.icon} text-lg`} aria-hidden="true" />
                  </span>
                  <span className="rounded-full bg-brand-background/[0.06] px-2 py-0.5 text-[11px] font-semibold text-brand-background/55">
                    {item.count}
                  </span>
                </span>
                <span className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-background/45">
                  {item.label}
                </span>
                <span className="mt-1 text-sm font-bold leading-tight text-brand-background">{item.title}</span>
                <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-brand-background/55">{item.body}</span>
              </Link>
            ))}
          </div>
        </div>

        {primaryAction && (
          <aside className="border-t border-brand-background/10 bg-brand-background/[0.04] p-5 lg:border-l lg:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-background/45">Start here</p>
            <div className="mt-3 rounded-2xl border border-brand-background/10 bg-brand-background/[0.05] p-4">
              <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', toneClass[primaryAction.tone])}>
                <i className={`${primaryAction.icon} text-2xl`} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-bold text-brand-background">{primaryAction.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-background/60">{primaryAction.body}</p>
              <LinkButton href={primaryAction.href} size="sm" className="mt-4 w-full">
                Go
              </LinkButton>
            </div>
          </aside>
        )}
      </div>
    </Card>
  )
}
