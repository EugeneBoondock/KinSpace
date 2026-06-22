'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/components/Toast'
import { Avatar, Card, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { isTransientFetchError } from '@/lib/client-errors'
import { DatabaseService } from '@/lib/database'

type MySpoon = { spoons: number; note: string | null; emoji: string | null } | null

type CircleProfile = {
  full_name?: string | null
  username?: string | null
  pseudonym?: string | null
  avatar_url?: string | null
  is_anonymous?: boolean
}

type CircleSpoon = {
  user_id: string
  spoons: number
  note: string | null
  emoji: string | null
  profile: CircleProfile | null
}

const SPOON_LABELS = ['Running on empty', 'Low capacity', 'Getting by', 'Pretty good', 'Full capacity']
const CAPACITY_ICONS = [
  'ri-battery-low-line',
  'ri-battery-2-charge-line',
  'ri-battery-charge-line',
  'ri-battery-saver-line',
  'ri-battery-line',
]

function circleName(profile: CircleProfile | null): string {
  if (!profile) return 'Someone in your circle'
  if (profile.is_anonymous) return profile.pseudonym || 'Someone in your circle'
  return profile.full_name || profile.pseudonym || profile.username || 'A connection'
}

export default function SpoonsToday() {
  const { push: toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [mine, setMine] = useState<MySpoon>(null)
  const [circle, setCircle] = useState<CircleSpoon[]>([])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [my, theirs] = await Promise.all([
          DatabaseService.getMySpoonStatus(),
          DatabaseService.getCircleSpoons(),
        ])
        if (cancelled) return
        const typedMine = my as MySpoon
        setMine(typedMine)
        setNote(typedMine?.note ?? '')
        setCircle(Array.isArray(theirs) ? (theirs as CircleSpoon[]) : [])
      } catch (error) {
        if (!cancelled && !isTransientFetchError(error)) console.error('Failed to load spoons:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSetSpoons(level: number) {
    if (saving) return
    setSaving(true)
    const optimistic = { spoons: level, note: note.trim() || null, emoji: null }
    setMine(optimistic)
    try {
      await DatabaseService.setSpoonStatus({ spoons: level, note: note.trim() || null })
      toast('Capacity shared with your circle', 'success')
    } catch (error) {
      console.error('Failed to set spoons:', error)
      toast('Could not save your capacity', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleQuietCheckin(userId: string) {
    if (checkedIn.has(userId)) return
    setCheckedIn((current) => new Set(current).add(userId))
    try {
      await DatabaseService.sendQuietCheckin(userId)
      toast('Sent a quiet check-in', 'success')
    } catch (error) {
      console.error('Failed to send quiet check-in:', error)
      setCheckedIn((current) => {
        const next = new Set(current)
        next.delete(userId)
        return next
      })
      toast('Could not send right now', 'error')
    }
  }

  if (loading) {
    return <Skeleton className="h-48 rounded-2xl" />
  }

  return (
    <Card className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-brand-background">Spoons today</h2>
          <span className="text-xs text-brand-background/45">Resets in 24h - only your circle sees this</span>
        </div>
        <p className="mt-1 text-sm text-brand-background/55">
          How much capacity do you have today? No pressure to do anything with it.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-2" role="group" aria-label="Set your spoons for today">
        {[1, 2, 3, 4, 5].map((level) => {
          const active = (mine?.spoons ?? 0) >= level
          const isExact = mine?.spoons === level
          return (
            <button
              key={level}
              type="button"
              onClick={() => handleSetSpoons(level)}
              disabled={saving}
              aria-pressed={isExact}
              aria-label={`${level} ${level === 1 ? 'spoon' : 'spoons'} - ${SPOON_LABELS[level - 1]}`}
              className={cn(
                'flex flex-col items-center gap-1 rounded-2xl border py-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                active
                  ? 'border-brand-accent2/50 bg-brand-accent2/[0.14]'
                  : 'border-brand-background/10 bg-brand-background/[0.04] hover:bg-brand-background/[0.08]',
              )}
            >
              <i
                className={cn(CAPACITY_ICONS[level - 1], 'text-xl transition-opacity', active ? 'opacity-100' : 'opacity-35')}
                aria-hidden="true"
              />
              <span className="text-[11px] font-semibold text-brand-background/70">{level}</span>
            </button>
          )
        })}
      </div>

      {mine && (
        <p className="text-sm font-medium text-brand-accent2">
          <i className="ri-checkbox-circle-line mr-1" aria-hidden="true" />
          {SPOON_LABELS[mine.spoons - 1]}
        </p>
      )}

      <input
        type="text"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        onBlur={() => {
          if (mine && (note.trim() || null) !== (mine.note ?? null)) handleSetSpoons(mine.spoons)
        }}
        maxLength={140}
        placeholder="Add a word if you want (optional)"
        aria-label="Optional note about your day"
        className="w-full rounded-xl border border-brand-background/12 bg-brand-background/[0.04] px-3 py-2.5 text-sm text-brand-background placeholder:text-brand-background/35 focus:border-brand-accent2/50 focus:outline-none"
      />

      {circle.length > 0 && (
        <div className="space-y-2 border-t border-brand-background/8 pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-background/40">Your circle today</p>
          {circle.map((member) => {
            const name = circleName(member.profile)
            const low = member.spoons <= 2
            const sent = checkedIn.has(member.user_id)
            return (
              <div key={member.user_id} className="flex items-center gap-3">
                <Avatar
                  src={member.profile?.is_anonymous ? null : member.profile?.avatar_url}
                  name={name}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-brand-background">{name}</p>
                  <p className="truncate text-xs text-brand-background/50">
                    <span className="mr-1" aria-hidden="true">
                      {Array.from({ length: member.spoons }).map((_, index) => (
                        <i key={index} className="ri-battery-charge-line" />
                      ))}
                    </span>
                    <span>{SPOON_LABELS[member.spoons - 1]}</span>
                    {member.note ? ` - ${member.note}` : ''}
                  </p>
                </div>
                {low && (
                  <button
                    type="button"
                    onClick={() => handleQuietCheckin(member.user_id)}
                    disabled={sent}
                    className={cn(
                      'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                      sent
                        ? 'bg-brand-background/8 text-brand-background/45'
                        : 'bg-brand-accent1/15 text-brand-accent1 hover:bg-brand-accent1/25',
                    )}
                  >
                    {sent ? 'Sent care' : 'Send care'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
