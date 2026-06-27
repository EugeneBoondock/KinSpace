'use client'

import { useEffect, useMemo, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { classNames, formatRelativeTime, toDate } from '@/lib/platform'
import { Badge, Card, EmptyState, LinkButton, Skeleton } from '@/components/ui'

type TimelineType = 'mood' | 'symptom' | 'treatment' | 'side_effect' | 'journal' | 'medication' | 'life_event'

type TimelineEvent = {
  id: string
  type: TimelineType
  at: string
  title: string
  detail?: string
  value?: number | null
  condition_slug?: string | null
  symptom?: string | null
  treatment?: string | null
  side_effect?: string | null
  medication?: string | null
}

type TimelineStats = {
  total_events: number
  mood_checkins: number
  symptoms_logged: number
  treatments_logged: number
  side_effects_logged: number
  journal_entries: number
  medication_events: number
  life_events: number
}

type TimelineResponse = {
  events?: unknown
  stats?: unknown
}

type EventStyle = {
  tint: string
  icon: string
  label: string
  /** How to phrase the optional numeric value, e.g. "Severity 3/5". */
  valueLabel: (value: number) => string
}

const EVENT_STYLES: Record<TimelineType, EventStyle> = {
  mood: {
    tint: 'tint-gold',
    icon: 'ri-emotion-line',
    label: 'Mood',
    valueLabel: (value) => `Mood ${value}/5`,
  },
  symptom: {
    tint: 'tint-terracotta',
    icon: 'ri-pulse-line',
    label: 'Symptom',
    valueLabel: (value) => `Severity ${value}/5`,
  },
  treatment: {
    tint: 'tint-sage',
    icon: 'ri-capsule-line',
    label: 'Treatment',
    valueLabel: (value) => `Effectiveness ${value}/5`,
  },
  side_effect: {
    tint: 'tint-terracotta',
    icon: 'ri-alert-line',
    label: 'Side effect',
    valueLabel: (value) => `Intensity ${value}/5`,
  },
  journal: {
    tint: 'tint-cream',
    icon: 'ri-quill-pen-line',
    label: 'Journal',
    valueLabel: (value) => `${value}/5`,
  },
  medication: {
    tint: 'tint-sage',
    icon: 'ri-medicine-bottle-line',
    label: 'Medication',
    valueLabel: (value) => `${value}/5`,
  },
  life_event: {
    tint: 'tint-gold',
    icon: 'ri-calendar-event-line',
    label: 'Life event',
    valueLabel: (value) => `Intensity ${value}/5`,
  },
}

const VALID_TYPES: TimelineType[] = ['mood', 'symptom', 'treatment', 'side_effect', 'journal', 'medication', 'life_event']

const EMPTY_STATS: TimelineStats = {
  total_events: 0,
  mood_checkins: 0,
  symptoms_logged: 0,
  treatments_logged: 0,
  side_effects_logged: 0,
  journal_entries: 0,
  medication_events: 0,
  life_events: 0,
}

function isTimelineType(value: unknown): value is TimelineType {
  return typeof value === 'string' && (VALID_TYPES as string[]).includes(value)
}

function parseEvents(value: unknown): TimelineEvent[] {
  if (!Array.isArray(value)) return []
  const events: TimelineEvent[] = []
  for (const raw of value) {
    const row = raw as Record<string, unknown>
    if (!isTimelineType(row.type)) continue
    const id = typeof row.id === 'string' ? row.id : ''
    const at = typeof row.at === 'string' ? row.at : ''
    const title = typeof row.title === 'string' ? row.title : ''
    if (!id || !at) continue
    events.push({
      id,
      type: row.type,
      at,
      title,
      detail: typeof row.detail === 'string' ? row.detail : undefined,
      value: typeof row.value === 'number' ? row.value : null,
      condition_slug: typeof row.condition_slug === 'string' ? row.condition_slug : null,
      symptom: typeof row.symptom === 'string' ? row.symptom : null,
      treatment: typeof row.treatment === 'string' ? row.treatment : null,
      side_effect: typeof row.side_effect === 'string' ? row.side_effect : null,
      medication: typeof row.medication === 'string' ? row.medication : null,
    })
  }
  return events
}

function parseStats(value: unknown): TimelineStats {
  const row = (value ?? {}) as Record<string, unknown>
  const num = (key: keyof TimelineStats): number =>
    typeof row[key] === 'number' ? (row[key] as number) : 0
  return {
    total_events: num('total_events'),
    mood_checkins: num('mood_checkins'),
    symptoms_logged: num('symptoms_logged'),
    treatments_logged: num('treatments_logged'),
    side_effects_logged: num('side_effects_logged'),
    journal_entries: num('journal_entries'),
    medication_events: num('medication_events'),
    life_events: num('life_events'),
  }
}

function dayKey(iso: string): string {
  const date = toDate(iso)
  if (!date) return iso
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

type DayGroup = {
  key: string
  events: TimelineEvent[]
}

function groupByDay(events: TimelineEvent[]): DayGroup[] {
  const groups: DayGroup[] = []
  let current: DayGroup | null = null
  for (const event of events) {
    const key = dayKey(event.at)
    if (!current || current.key !== key) {
      current = { key, events: [] }
      groups.push(current)
    }
    current.events.push(event)
  }
  return groups
}

const STAT_CARDS: { key: keyof TimelineStats; label: string }[] = [
  { key: 'total_events', label: 'Total' },
  { key: 'mood_checkins', label: 'Mood' },
  { key: 'symptoms_logged', label: 'Symptoms' },
  { key: 'treatments_logged', label: 'Treatments' },
  { key: 'side_effects_logged', label: 'Side effects' },
  { key: 'medication_events', label: 'Meds' },
  { key: 'life_events', label: 'Life' },
  { key: 'journal_entries', label: 'Journal' },
]

function TimelineRow({ event }: { event: TimelineEvent }) {
  const style = EVENT_STYLES[event.type]
  const hasValue = typeof event.value === 'number'
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      <div className="relative z-10 shrink-0">
        <span className={classNames('icon-chip', style.tint)} aria-hidden="true">
          <i className={style.icon} />
        </span>
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-background/40">
            {style.label}
          </span>
          <span aria-hidden="true" className="text-brand-background/30">
            ·
          </span>
          <span className="text-xs text-brand-background/45">{formatRelativeTime(event.at)}</span>
        </div>
        <p className="mt-1 text-base font-semibold capitalize text-brand-background">{event.title}</p>
        {hasValue && (
          <div className="mt-1.5">
            <Badge className="bg-brand-accent2/15 text-brand-accent2">
              {style.valueLabel(event.value as number)}
            </Badge>
          </div>
        )}
        {event.detail && (
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-brand-background/65">
            {event.detail}
          </p>
        )}
        {(event.condition_slug || event.symptom || event.treatment || event.side_effect || event.medication) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {event.condition_slug && <Badge tone="neutral">{event.condition_slug}</Badge>}
            {event.symptom && <Badge tone="gold">{event.symptom}</Badge>}
            {event.treatment && <Badge tone="sage">{event.treatment}</Badge>}
            {event.side_effect && <Badge tone="gold">{event.side_effect}</Badge>}
            {event.medication && <Badge tone="sage">{event.medication}</Badge>}
          </div>
        )}
      </div>
    </li>
  )
}

export default function TimelinePage() {
  const { user } = useAuth()

  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [stats, setStats] = useState<TimelineStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let active = true
    const id = requestAnimationFrame(() => {
      setLoading(true)
      DatabaseService.getHealthTimeline(user.userId)
        .then((result: unknown) => {
          if (!active) return
          const data = (result ?? {}) as TimelineResponse
          setEvents(parseEvents(data.events))
          setStats(parseStats(data.stats))
        })
        .catch((error: unknown) => console.error('Failed to load timeline:', error))
        .finally(() => {
          if (active) setLoading(false)
        })
    })
    return () => {
      active = false
      cancelAnimationFrame(id)
    }
  }, [user])

  const groups = useMemo(() => groupByDay(events), [events])

  return (
    <PageFrame containerClassName="max-w-3xl">
      <div className="space-y-6">
        <header className="space-y-3">
          <p className="eyebrow">Your journey</p>
          <h1 className="text-2xl font-bold text-brand-background sm:text-3xl">Health timeline</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-brand-background/65">
            Everything you have tracked across moods, symptoms, treatments, medications, and life
            events in one private chronology. Only you can see this.
          </p>
          <div className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-4">
            {STAT_CARDS.map((card) => (
              <div key={card.key} className="rounded-xl bg-brand-background/[0.06] px-3 py-2.5">
                <p className="text-xl font-semibold text-brand-background">{stats[card.key]}</p>
                <p className="text-xs text-brand-background/50">{card.label}</p>
              </div>
            ))}
          </div>
        </header>

        {loading ? (
          <Card className="space-y-5">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex gap-4">
                <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </Card>
        ) : events.length === 0 ? (
          <EmptyState
            icon={<i className="ri-route-line text-4xl" aria-hidden="true" />}
            title="Your timeline is empty"
            description="Log a mood, symptom, or journal entry to start building your health story."
            action={<LinkButton href="/dashboard">Go to your dashboard</LinkButton>}
          />
        ) : (
          <div className="space-y-7">
            {groups.map((group) => (
              <section key={group.key} className="space-y-3">
                <h2 className="text-sm font-semibold text-brand-background/70">{group.key}</h2>
                <ol className="relative ml-[1.25rem] border-l border-brand-background/12 pl-6">
                  {group.events.map((event) => (
                    <TimelineRow key={event.id} event={event} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </PageFrame>
  )
}
