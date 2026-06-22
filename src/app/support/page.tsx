'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { formatRelativeTime } from '@/lib/platform'
import { cn } from '@/lib/cn'
import { Alert, Badge, Button, Card, CardTitle, EmptyState, LinkButton, Skeleton, Textarea } from '@/components/ui'

type SupportRequest = {
  id: string
  status: string
  note: string
  crisis?: boolean
  condition_slug: string | null
  is_anonymous: boolean
  room_id: string | null
  matched_user: { id?: string; user_id?: string; full_name?: string | null; username?: string; avatar_url?: string | null } | null
  expires_at: string
  created_at: string
}
type OpenLantern = {
  id: string
  note: string
  condition_slug: string | null
  is_anonymous: boolean
  seeker: { id?: string; user_id?: string; full_name?: string | null; username?: string; avatar_url?: string | null } | null
  created_at: string
}
type Availability = { available: boolean; available_until: string | null; topics: string[]; note: string | null }

const DURATIONS = [30, 60, 120] as const

function CrisisNote() {
  return (
    <Alert tone="advice" title="This is peer support, not emergency care">
      Lanterns connect you with caring members, not professionals. If you&rsquo;re in crisis or danger right now,
      please reach a crisis line.{' '}
      <Link href="/crisis" className="font-semibold text-brand-accent1 underline">
        Get crisis support
      </Link>
      .
    </Alert>
  )
}

/** Prominent, non-dismissable crisis resources, shown when a note signals risk,
 *  or when no peers are around. Peer support can wait; this can't. */
function CrisisUrgent() {
  return (
    <div role="alert" className="rounded-2xl border border-brand-crisis/40 bg-brand-crisis/10 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-brand-crisis">
        <i className="ri-alarm-warning-line" aria-hidden="true" /> If you might be in danger, please reach a person now
      </p>
      <p className="mt-1 text-sm leading-relaxed text-brand-ink/80">
        A lantern may take a little while, and you deserve support right away. You&rsquo;re not a burden.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <a href="tel:0800567567" className="btn-accent text-center">Call SADAG 0800 567 567 (24/7)</a>
        <LinkButton href="/crisis" variant="secondary">All crisis lines</LinkButton>
      </div>
    </div>
  )
}

// ── Seeker: light a lantern ──────────────────────────────────────────────────
function SeekerPanel() {
  const [request, setRequest] = useState<SupportRequest | null>(null)
  const [available, setAvailable] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [anon, setAnon] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dimmed, setDimmed] = useState(false)
  const prevStatus = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    const [req, avail] = await Promise.all([
      DatabaseService.getMySupportRequest().catch(() => null),
      DatabaseService.getAvailableSupporters().catch(() => ({ count: 0 })),
    ])
    const next = (req as SupportRequest) ?? null
    // An open lantern that vanished without ever matching = no one was free in time.
    if (prevStatus.current === 'open' && !next) setDimmed(true)
    if (next) setDimmed(false)
    prevStatus.current = next?.status ?? null
    setRequest(next)
    setAvailable((avail as { count?: number })?.count ?? 0)
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  // Poll while a lantern is open/waiting so a match appears promptly.
  useEffect(() => {
    if (request?.status !== 'open') return
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [request?.status, refresh])

  const light = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    setDimmed(false)
    try {
      const req = (await DatabaseService.openSupportRequest({ note: note.trim() || undefined, isAnonymous: anon })) as SupportRequest
      prevStatus.current = req?.status ?? null
      setRequest(req)
      setNote('')
    } catch {
      setError('We couldn’t light your lantern just now. Please try again, and if it’s urgent, reach a crisis line below.')
    } finally {
      setBusy(false)
    }
  }
  const cancel = async () => {
    if (busy) return
    setBusy(true)
    try {
      await DatabaseService.cancelSupportRequest()
      await refresh()
    } finally {
      setBusy(false)
    }
  }
  const close = async (id: string) => {
    setBusy(true)
    try {
      await DatabaseService.closeSupportRequest(id)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Skeleton className="h-48 rounded-2xl" />

  if (request && request.status === 'matched') {
    const partnerId = request.matched_user?.id || request.matched_user?.user_id
    const name = request.matched_user?.full_name || request.matched_user?.username || 'A member'
    return (
      <Card className="space-y-4 text-center">
        <div className="celebrate-pop mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-accent3/15 text-3xl">
          💛
        </div>
        <div>
          <CardTitle className="text-lg">{name} answered your lantern</CardTitle>
          <p className="mt-1 text-sm text-brand-ink/65">They&rsquo;re here for you. Open the conversation whenever you&rsquo;re ready.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {partnerId && <LinkButton href={`/messages?to=${partnerId}`} variant="accent">Open the conversation</LinkButton>}
          <Button variant="secondary" onClick={() => close(request.id)} disabled={busy}>
            End support
          </Button>
        </div>
      </Card>
    )
  }

  if (request && request.status === 'open') {
    return (
      <div className="space-y-4">
        {request.crisis && <CrisisUrgent />}
        <Card className="space-y-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent2/10">
          <span className="breath-orb text-3xl">🏮</span>
        </div>
        <div>
          <CardTitle className="text-lg">Your lantern is lit</CardTitle>
          <p className="mt-1 text-sm text-brand-ink/65">
            We&rsquo;re letting available members know you&rsquo;d like someone to talk to. This can take a few minutes.
          </p>
          {available != null && (
            <p className="mt-2 text-xs text-brand-ink/45">
              {available > 0 ? `${available} ${available === 1 ? 'member is' : 'members are'} around right now` : 'Sit tight, we’ll keep looking'}
            </p>
          )}
        </div>
        <Button variant="secondary" onClick={cancel} disabled={busy}>
          Cancel
        </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {dimmed && (
        <Card className="space-y-3">
          <CardTitle className="text-lg">No one was free in time 🏮</CardTitle>
          <p className="text-sm leading-relaxed text-brand-ink/70">
            Your lantern dimmed before someone could answer, that&rsquo;s about who was around, never about you. A
            few other ways to not be alone with it right now:
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <LinkButton href="/therapy" variant="secondary" size="sm">Talk to the AI guide</LinkButton>
            <LinkButton href="/community" variant="secondary" size="sm">Post to the community</LinkButton>
            <LinkButton href="/crisis" variant="secondary" size="sm">Crisis lines</LinkButton>
          </div>
        </Card>
      )}
    <Card className="space-y-4">
      <div>
        <CardTitle className="text-lg">Reach out for support</CardTitle>
        <p className="mt-1 text-sm text-brand-ink/65">
          Light a lantern and a caring member can be there with you, one-to-one.
          {available != null && available > 0 && (
            <span className="font-medium text-brand-accent3"> {available} around right now.</span>
          )}
        </p>
      </div>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        aria-label="What's on your mind"
        placeholder="What's on your mind? (optional), share as little or as much as you like"
        className="resize-none"
      />
      <label className="flex items-start gap-2 text-sm text-brand-ink/70">
        <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-brand-line" />
        <span>
          Stay anonymous in the public list of lanterns.
          <span className="block text-xs text-brand-ink/45">
            When someone answers, you chat directly, they&rsquo;ll see your profile then, even if you chose this.
          </span>
        </span>
      </label>
      {available === 0 && (
        <p className="rounded-xl bg-brand-ink/[0.04] px-3 py-2 text-xs text-brand-ink/60">
          It&rsquo;s quiet right now, your lantern will wait up to 30 minutes for someone. If you need support
          sooner, the{' '}
          <Link href="/therapy" className="font-medium text-brand-accent2 underline">AI guide</Link>,{' '}
          <Link href="/community" className="font-medium text-brand-accent2 underline">community</Link>, and{' '}
          <Link href="/crisis" className="font-medium text-brand-accent1 underline">crisis lines</Link> are here too.
        </p>
      )}
      {error && <p className="text-sm text-brand-crisis">{error}</p>}
      <Button onClick={light} disabled={busy} leadingIcon={<span aria-hidden="true">🏮</span>}>
        {busy ? 'Lighting…' : 'Light a lantern'}
      </Button>
    </Card>
    </div>
  )
}

// ── Supporter: be there for someone ──────────────────────────────────────────
function SupporterPanel() {
  const router = useRouter()
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [lanterns, setLanterns] = useState<OpenLantern[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [minutes, setMinutes] = useState<number>(60)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [acked, setAcked] = useState(false)
  const claimed = useRef(false)

  const refresh = useCallback(async () => {
    const avail = (await DatabaseService.getMySupportAvailability().catch(() => null)) as Availability | null
    setAvailability(avail)
    if (avail?.available) {
      const list = (await DatabaseService.getOpenSupportRequests().catch(() => [])) as OpenLantern[]
      setLanterns(Array.isArray(list) ? list : [])
    } else {
      setLanterns([])
    }
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  useEffect(() => {
    if (!availability?.available) return
    const id = setInterval(refresh, 8000)
    return () => clearInterval(id)
  }, [availability?.available, refresh])

  const goAvailable = async () => {
    if (busy) return
    setBusy(true)
    try {
      await DatabaseService.setSupportAvailability({ minutes })
      await refresh()
    } finally {
      setBusy(false)
    }
  }
  const stepAway = async () => {
    if (busy) return
    setBusy(true)
    try {
      await DatabaseService.endSupportAvailability()
      await refresh()
    } finally {
      setBusy(false)
    }
  }
  const requestAnswer = (id: string) => {
    if (acked) doClaim(id)
    else setPendingId(id)
  }
  const doClaim = async (id: string) => {
    if (claimed.current) return
    setPendingId(null)
    setAcked(true)
    setClaimingId(id)
    try {
      const res = (await DatabaseService.claimSupportRequest(id)) as { ok?: boolean; partner_id?: string }
      if (res?.partner_id) {
        claimed.current = true
        router.push(`/messages?to=${res.partner_id}`)
      } else {
        await refresh()
      }
    } catch {
      // Most likely another member just answered it, refresh the list.
      await refresh()
    } finally {
      setClaimingId(null)
    }
  }

  if (loading) return <Skeleton className="h-48 rounded-2xl" />

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <CardTitle className="text-lg">Be there for someone</CardTitle>
        <p className="text-sm text-brand-ink/65">
          Make yourself available and we&rsquo;ll show you members who&rsquo;d like to talk. You&rsquo;re a peer, not a
          therapist, listening kindly is enough, and it&rsquo;s okay to set your own boundaries.
        </p>
        {availability?.available ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-accent3/10 px-4 py-3">
            <span className="text-sm text-brand-ink/80">
              <i className="ri-checkbox-circle-line mr-1.5 text-brand-accent3" aria-hidden="true" />
              You&rsquo;re available
              {availability.available_until && <> until {new Date(availability.available_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>}
            </span>
            <Button size="sm" variant="secondary" onClick={stepAway} disabled={busy}>
              Step away
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full bg-brand-ink/[0.06] p-0.5 text-xs">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setMinutes(d)}
                  className={cn('rounded-full px-3 py-1.5 font-medium transition-colors', minutes === d ? 'bg-brand-accent2 text-white' : 'text-brand-ink/60 hover:text-brand-ink')}
                >
                  {d}m
                </button>
              ))}
            </div>
            <Button size="sm" onClick={goAvailable} disabled={busy} leadingIcon={<span aria-hidden="true">🤲</span>}>
              {busy ? 'Setting…' : "I'm available"}
            </Button>
          </div>
        )}
      </Card>

      {pendingId && (
        <Card className="space-y-3 border-brand-accent2/50">
          <CardTitle className="text-base">Before you connect 💛</CardTitle>
          <div className="space-y-1.5 text-sm text-brand-ink/75">
            <p><span className="font-semibold text-brand-accent3">Do</span>, listen, validate, and stay kind. Just being present is enough.</p>
            <p><span className="font-semibold text-brand-accent1">Please don&rsquo;t</span>, give medical or medication advice, diagnose, or promise you&rsquo;ll always be available.</p>
            <p>If they mention harming themselves, gently share{' '}
              <Link href="/crisis" className="font-medium text-brand-accent1 underline">crisis support</Link>{' '}, you don&rsquo;t have to carry it alone.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="sm" onClick={() => doClaim(pendingId)} disabled={claimingId === pendingId}>
              {claimingId === pendingId ? 'Connecting…' : 'I understand, connect'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setPendingId(null)}>Back</Button>
          </div>
        </Card>
      )}

      {availability?.available && (
        <div className="space-y-3">
          <p className="eyebrow">Open lanterns</p>
          {lanterns.length === 0 ? (
            <EmptyState
              icon={<span className="text-4xl" aria-hidden="true">🏮</span>}
              image="/images/app/empty-lanterns.webp"
              imageAlt="A warm glowing lantern at dusk"
              title="No lanterns right now"
              description="It's quiet at the moment. We'll show new requests here the moment they come in, thank you for being here."
              className="py-8"
            />
          ) : (
            lanterns.map((l) => {
              const name = l.is_anonymous ? 'A member, anonymously' : l.seeker?.full_name || l.seeker?.username || 'A member'
              return (
                <Card key={l.id} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-brand-ink">{name}</span>
                    <span className="text-xs text-brand-ink/45">{formatRelativeTime(l.created_at)}</span>
                  </div>
                  {l.condition_slug && <Badge tone="sage" className="capitalize">{l.condition_slug.replace(/-/g, ' ')}</Badge>}
                  {l.note && <p className="text-sm leading-relaxed text-brand-ink/80">{l.note}</p>}
                  <Button size="sm" onClick={() => requestAnswer(l.id)} disabled={claimingId === l.id} leadingIcon={<span aria-hidden="true">🏮</span>}>
                    {claimingId === l.id ? 'Connecting…' : 'Answer this lantern'}
                  </Button>
                </Card>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export default function SupportPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<'reach' | 'be'>('reach')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <PageFrame containerClassName="max-w-2xl">
        <Skeleton className="h-48 rounded-2xl" />
        <BottomNav />
      </PageFrame>
    )
  }

  return (
    <PageFrame containerClassName="max-w-2xl">
      <div className="space-y-5">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink/45">Lanterns</p>
          <h1 className="text-2xl font-bold text-brand-ink sm:text-3xl">Someone, right now</h1>
          <p className="max-w-xl text-sm leading-relaxed text-brand-ink/65">
            When you don&rsquo;t want to be alone with it, light a lantern, or answer one, and be there for someone else.
          </p>
        </header>

        <CrisisNote />

        <div className="inline-flex w-full rounded-full bg-brand-ink/[0.06] p-1 text-sm sm:w-auto">
          {([['reach', 'Reach out'], ['be', 'Be there for someone']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'flex-1 rounded-full px-4 py-2 font-medium transition-colors sm:flex-none',
                tab === key ? 'bg-brand-surface text-brand-ink shadow-[var(--shadow-card)]' : 'text-brand-ink/60 hover:text-brand-ink')}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'reach' ? <SeekerPanel /> : <SupporterPanel />}
      </div>

      <BottomNav />
    </PageFrame>
  )
}
