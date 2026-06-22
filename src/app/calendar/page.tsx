'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageFrame from '@/components/PageFrame'
import BottomNav from '@/components/BottomNav'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { Card, Skeleton } from '@/components/ui'

type DayActivity = {
  day: string
  meds_taken: number
  sessions: number
  mood: string | null
}

const moodColors: Record<string, string> = {
  grounded: '#6b8a83',
  hopeful: '#d19a58',
  tired: '#8896a6',
  stretched: '#c98a5e',
  heavy: '#6b7280',
}

const moodLabels: Record<string, string> = {
  grounded: 'Grounded',
  hopeful: 'Hopeful',
  tired: 'Tired',
  stretched: 'Stretched',
  heavy: 'Heavy',
}

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// UTC YYYY-MM-DD so the grid keys line up with how the server stores days.
function ymd(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activity, setActivity] = useState<Record<string, DayActivity>>({})
  const [monthOffset, setMonthOffset] = useState(0)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    async function load() {
      if (!user) return
      try {
        const rows = (await DatabaseService.getActivityCalendar(user.userId, 180)) as DayActivity[]
        const map: Record<string, DayActivity> = {}
        for (const row of Array.isArray(rows) ? rows : []) map[row.day] = row
        setActivity(map)
      } catch (error) {
        console.error('Failed to load calendar:', error)
      } finally {
        setLoading(false)
      }
    }
    if (user) load()
  }, [user])

  const { cells, monthLabel } = useMemo(() => {
    const now = new Date()
    const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1))
    const year = base.getUTCFullYear()
    const month = base.getUTCMonth()
    const startWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay()
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

    const grid: Array<{ key: string; day: string | null; date: number | null }> = []
    for (let i = 0; i < startWeekday; i += 1) grid.push({ key: `pad-${i}`, day: null, date: null })
    for (let d = 1; d <= daysInMonth; d += 1) {
      const cellDate = new Date(Date.UTC(year, month, d))
      grid.push({ key: ymd(cellDate), day: ymd(cellDate), date: d })
    }

    return {
      cells: grid,
      monthLabel: base.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    }
  }, [monthOffset])

  const todayKey = ymd(new Date())

  return (
    <PageFrame>
      <div className="page-grid space-y-6 overflow-x-hidden">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent2">Your rhythm</p>
          <h1 className="text-2xl font-bold text-brand-background sm:text-3xl">Activity calendar</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-brand-background/60">
            A gentle look back: the days you took your meds, checked in with your mood, and sat with your Guide.
          </p>
        </header>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMonthOffset((value) => value - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-background/[0.06] text-brand-background/70 transition hover:bg-brand-background/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
              aria-label="Previous month"
            >
              <i className="ri-arrow-left-s-line text-lg" aria-hidden="true" />
            </button>
            <h2 className="text-base font-bold text-brand-background">{monthLabel}</h2>
            <button
              type="button"
              onClick={() => setMonthOffset((value) => Math.min(0, value + 1))}
              disabled={monthOffset >= 0}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-background/[0.06] text-brand-background/70 transition hover:bg-brand-background/[0.12] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
              aria-label="Next month"
            >
              <i className="ri-arrow-right-s-line text-lg" aria-hidden="true" />
            </button>
          </div>

          {loading ? (
            <div className="mt-4 grid grid-cols-7 gap-1.5">
              {Array.from({ length: 35 }, (_, index) => (
                <Skeleton key={index} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-7 gap-1.5">
                {weekdayLabels.map((label) => (
                  <div key={label} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-brand-background/40">
                    {label}
                  </div>
                ))}
                {cells.map((cell) => {
                  if (!cell.day) return <div key={cell.key} />
                  const data = activity[cell.day]
                  const isToday = cell.day === todayKey
                  const moodColor = data?.mood ? moodColors[data.mood] ?? '#9aa7a0' : null
                  return (
                    <div
                      key={cell.key}
                      className={`flex aspect-square flex-col items-center justify-between rounded-xl border p-1.5 sm:p-2 ${
                        isToday ? 'border-brand-accent2/60 bg-brand-accent2/[0.08]' : 'border-brand-line bg-brand-background/[0.03]'
                      }`}
                    >
                      <span className="self-end text-xs font-semibold text-brand-background/60 sm:text-sm">{cell.date}</span>
                      <div className="flex flex-1 items-center justify-center">
                        {moodColor && (
                          <span
                            className="h-4 w-4 rounded-full ring-2 ring-brand-surface sm:h-5 sm:w-5"
                            style={{ background: moodColor }}
                            title={data?.mood ? moodLabels[data.mood] ?? data.mood : undefined}
                          />
                        )}
                      </div>
                      <div className="flex items-center justify-center gap-1.5 text-lg leading-none sm:text-xl">
                        {data?.meds_taken ? (
                          <i className="ri-capsule-line text-brand-accent1" title={`${data.meds_taken} dose(s) taken`} aria-hidden="true" />
                        ) : null}
                        {data?.sessions ? (
                          <i className="ri-mental-health-line text-brand-accent3" title="Therapy session" aria-hidden="true" />
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-brand-line pt-4 text-sm text-brand-background/60">
                <span className="flex items-center gap-1.5">
                  <i className="ri-capsule-line text-base text-brand-accent1" aria-hidden="true" /> Meds taken
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="ri-mental-health-line text-base text-brand-accent3" aria-hidden="true" /> Therapy session
                </span>
                {Object.entries(moodLabels).map(([key, label]) => (
                  <span key={key} className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full" style={{ background: moodColors[key] }} /> {label}
                  </span>
                ))}
              </div>
            </>
          )}
        </Card>

        <p className="text-center text-xs text-brand-background/45">
          Meds and sessions show from when you started logging them here. Past days fill in as you go.
        </p>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
