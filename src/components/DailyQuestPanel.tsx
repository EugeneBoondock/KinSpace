'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { isTransientFetchError } from '@/lib/client-errors'
import { formatCompactNumber } from '@/lib/platform'
import { cn } from '@/lib/cn'
import { Badge, Card, LinkButton, Skeleton } from '@/components/ui'

type DailyQuestTask = {
  id: string
  title: string
  description: string
  href: string
  icon: string
  reward_points: number
  current: number
  goal: number
  completed: boolean
}

type DailyQuest = {
  date: string
  tasks: DailyQuestTask[]
  completed_count: number
  total_count: number
  progress: number
  points_available: number
  points_earned: number
  level: number
  level_title: string
  level_progress: number
  points: number
  next_level_points: number | null
  checkin_streak: number
  next_action: DailyQuestTask | null
}

const taskTones = [
  'bg-brand-accent2/[0.14] text-brand-accent2',
  'bg-brand-accent3/[0.16] text-brand-accent3',
  'bg-brand-accent5/[0.14] text-brand-accent5',
  'bg-brand-accent4/[0.14] text-brand-accent4',
  'bg-brand-accent1/[0.12] text-brand-accent1',
]

function percent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}

export default function DailyQuestPanel() {
  const { user } = useAuth()
  const [quest, setQuest] = useState<DailyQuest | null>(null)
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
        const result = (await DatabaseService.getDailyQuest(userId)) as DailyQuest
        if (active) setQuest(result)
      } catch (error) {
        if (!active) return
        setQuest(null)
        if (!isTransientFetchError(error)) console.error('Failed to load daily loop:', error)
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

  const nextAction = quest?.next_action
  const levelLabel = quest?.next_level_points
    ? `${formatCompactNumber(Math.max(0, quest.next_level_points - quest.points))} pts to next level`
    : 'Top level reached'
  const sortedTasks = useMemo(() => {
    if (!quest) return []
    return [...quest.tasks].sort((first, second) => Number(first.completed) - Number(second.completed))
  }, [quest])

  if (loading) {
    return (
      <Card className="overflow-hidden border-brand-accent3/25 bg-brand-accent3/[0.05]">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-4">
            <Skeleton className="h-5 w-36 rounded-full" />
            <Skeleton className="h-9 w-72 max-w-full rounded-2xl" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
            </div>
          </div>
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      </Card>
    )
  }

  if (!quest) return null

  return (
    <Card className="overflow-hidden border-brand-accent3/25 bg-brand-accent3/[0.05] p-0">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="p-5 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="sage">
                  <i className="ri-sparkling-2-line" aria-hidden="true" />
                  Today’s loop
                </Badge>
                <span className="text-xs font-semibold text-brand-background/55">
                  {quest.completed_count}/{quest.total_count} done
                </span>
              </div>
              <h2 className="mt-3 text-xl font-bold text-brand-background sm:text-2xl">
                Give yourself a reason to come back tomorrow.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-background/65">
                A few small actions make KinSpace more personal, social, and useful each time you return.
              </p>
            </div>
            <LinkButton
              href={nextAction?.href ?? '/dashboard'}
              size="sm"
              className="shrink-0"
              leadingIcon={<i className={nextAction?.icon ?? 'ri-checkbox-circle-line'} aria-hidden="true" />}
            >
              {nextAction ? 'Open next' : 'Loop complete'}
            </LinkButton>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.05] p-4">
              <p className="text-xs font-medium text-brand-background/55">Today’s progress</p>
              <p className="mt-2 text-2xl font-bold text-brand-background">{percent(quest.progress)}</p>
            </div>
            <div className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.05] p-4">
              <p className="text-xs font-medium text-brand-background/55">Points today</p>
              <p className="mt-2 text-2xl font-bold text-brand-background">
                {quest.points_earned}/{quest.points_available}
              </p>
            </div>
            <div className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.05] p-4">
              <p className="text-xs font-medium text-brand-background/55">Check-in streak</p>
              <p className="mt-2 text-2xl font-bold text-brand-background">
                {quest.checkin_streak} day{quest.checkin_streak === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-brand-background/[0.08]" aria-hidden="true">
            <div
              className="h-full rounded-full bg-brand-accent3 transition-[width] duration-500"
              style={{ width: percent(quest.progress) }}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {sortedTasks.map((task, index) => (
              <Link
                key={task.id}
                href={task.href}
                className={cn(
                  'group flex min-h-32 flex-col rounded-2xl border p-3.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                  task.completed
                    ? 'border-brand-accent3/35 bg-brand-accent3/[0.08]'
                    : 'border-brand-background/10 bg-brand-background/[0.04] hover:-translate-y-0.5 hover:bg-brand-background/[0.07]',
                )}
              >
                <span className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                      task.completed ? 'bg-brand-accent3/[0.16] text-brand-accent3' : taskTones[index % taskTones.length],
                    )}
                  >
                    <i className={`${task.completed ? 'ri-check-line' : task.icon} text-lg`} aria-hidden="true" />
                  </span>
                  <span className="rounded-full bg-brand-background/[0.06] px-2 py-0.5 text-[11px] font-semibold text-brand-background/60">
                    {task.completed ? 'Done' : task.reward_points > 0 ? `+${task.reward_points} pts` : 'Set up'}
                  </span>
                </span>
                <span className="mt-3 text-sm font-bold leading-tight text-brand-background">{task.title}</span>
                <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-brand-background/55">
                  {task.description}
                </span>
                <span className="mt-auto pt-3 text-[11px] font-semibold text-brand-background/50">
                  {Math.min(task.current, task.goal)}/{task.goal}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <aside className="border-t border-brand-background/10 bg-brand-background/[0.04] p-5 lg:border-l lg:border-t-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-background/45">Level</p>
          <div className="mt-3 rounded-2xl border border-brand-background/10 bg-brand-background/[0.05] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-3xl font-bold text-brand-background">{quest.level}</p>
                <p className="mt-1 text-sm font-semibold text-brand-background">{quest.level_title}</p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent2/[0.16] text-brand-accent2">
                <i className="ri-medal-2-line text-2xl" aria-hidden="true" />
              </span>
            </div>
            <div
              className="mt-4 h-2 overflow-hidden rounded-full bg-brand-background/[0.08]"
              aria-label={`Level progress ${percent(quest.level_progress)}`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(quest.level_progress * 100)}
            >
              <div
                className="h-full rounded-full bg-brand-accent2 transition-[width] duration-500"
                style={{ width: percent(quest.level_progress) }}
              />
            </div>
            <p className="mt-3 text-xs font-medium text-brand-background/55">{levelLabel}</p>
          </div>
          {nextAction ? (
            <p className="mt-4 text-sm leading-relaxed text-brand-background/65">
              Next up: <span className="font-semibold text-brand-background">{nextAction.title}</span>
            </p>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-brand-background/65">
              Today’s loop is complete. Keep exploring or come back tomorrow.
            </p>
          )}
        </aside>
      </div>
    </Card>
  )
}
