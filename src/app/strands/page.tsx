'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { formatRelativeTime, getInitials } from '@/lib/platform'

type StrandRecord = Record<string, unknown> & {
  id: string
  direction: 'sent' | 'received'
  profile: Record<string, unknown> | null
}

type StrandTab = 'accepted' | 'received' | 'sent'

const TABS: Array<{ id: StrandTab; label: string; icon: string }> = [
  { id: 'accepted', label: 'Stranded', icon: 'ri-links-line' },
  { id: 'received', label: 'Incoming', icon: 'ri-inbox-line' },
  { id: 'sent', label: 'Sent', icon: 'ri-send-plane-line' },
]

function displayName(profile: Record<string, unknown> | null) {
  if (!profile) return 'Community member'
  return (
    (profile.full_name as string | undefined) ||
    (profile.username as string | undefined) ||
    'Community member'
  )
}

export default function StrandsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { push: toast } = useToast()

  const [tab, setTab] = useState<StrandTab>('accepted')
  const [loading, setLoading] = useState(true)
  const [accepted, setAccepted] = useState<StrandRecord[]>([])
  const [pendingReceived, setPendingReceived] = useState<StrandRecord[]>([])
  const [pendingSent, setPendingSent] = useState<StrandRecord[]>([])
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const summary = await DatabaseService.getStrandSummary(user.userId)
      setAccepted(summary.accepted as StrandRecord[])
      setPendingReceived(summary.pendingReceived as StrandRecord[])
      setPendingSent(summary.pendingSent as StrandRecord[])
    } catch (error) {
      console.error('Failed to load strands:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
      return
    }
    void load()
  }, [authLoading, load, router, user])

  function startBusy(id: string) {
    setBusyIds((current) => new Set(current).add(id))
  }
  function stopBusy(id: string) {
    setBusyIds((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
  }

  async function acceptStrand(requestId: string) {
    startBusy(requestId)
    try {
      await DatabaseService.updateConnectionRequest(requestId, 'accepted')
      toast('Stranded 🧬', 'success')
      await load()
      setTab('accepted')
    } catch (error) {
      console.error('Failed to accept strand:', error)
      toast('Could not accept strand', 'error')
    } finally {
      stopBusy(requestId)
    }
  }

  async function declineStrand(requestId: string) {
    startBusy(requestId)
    try {
      await DatabaseService.updateConnectionRequest(requestId, 'declined')
      toast('Strand declined', 'info')
      await load()
    } catch (error) {
      console.error('Failed to decline strand:', error)
      toast('Could not decline strand', 'error')
    } finally {
      stopBusy(requestId)
    }
  }

  async function withdrawStrand(requestId: string) {
    startBusy(requestId)
    try {
      await DatabaseService.cancelConnectionRequest(requestId)
      toast('Strand withdrawn', 'info')
      await load()
    } catch (error) {
      console.error('Failed to withdraw strand:', error)
      toast('Could not withdraw strand', 'error')
    } finally {
      stopBusy(requestId)
    }
  }

  const currentList = useMemo(() => {
    if (tab === 'accepted') return accepted
    if (tab === 'received') return pendingReceived
    return pendingSent
  }, [tab, accepted, pendingReceived, pendingSent])

  const counts = {
    accepted: accepted.length,
    received: pendingReceived.length,
    sent: pendingSent.length,
  }

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card overflow-hidden !p-0">
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 opacity-25">
              <svg viewBox="0 0 400 120" className="h-full w-full">
                <path
                  d="M 0 60 Q 50 20, 100 60 T 200 60 T 300 60 T 400 60"
                  stroke="#D19A58"
                  strokeWidth="2"
                  fill="none"
                />
                <path
                  d="M 0 60 Q 50 100, 100 60 T 200 60 T 300 60 T 400 60"
                  stroke="#6B8A83"
                  strokeWidth="2"
                  fill="none"
                />
                {Array.from({ length: 20 }).map((_, index) => (
                  <line
                    key={index}
                    x1={index * 20}
                    y1={60 - Math.sin((index * Math.PI) / 5) * 30}
                    x2={index * 20}
                    y2={60 + Math.sin((index * Math.PI) / 5) * 30}
                    stroke="#eedfc8"
                    strokeOpacity={0.3}
                    strokeWidth="1"
                  />
                ))}
              </svg>
            </div>
            <div className="relative p-6 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/45">
                🧬 Connect Strands
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Your kin strands</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#eedfc8]/60">
                Strands are the KinSpace version of friend connections — warmer, more intentional. Once two
                people strand, you can see each other&apos;s updates and reach out directly.
              </p>

              <div className="mt-5 flex gap-2 overflow-x-auto rounded-2xl bg-[#eedfc8]/5 p-1.5">
                {TABS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setTab(option.id)}
                    className={`flex min-w-fit items-center gap-2 rounded-2xl px-4 py-2.5 text-sm transition-all ${
                      tab === option.id ? 'tab-active' : 'tab-inactive'
                    }`}
                  >
                    <i className={option.icon} />
                    {option.label}
                    <span
                      className={`ml-1 rounded-full px-2 py-0.5 text-[10px] ${
                        tab === option.id ? 'bg-[#2A4A42]/30' : 'bg-[#eedfc8]/10 text-[#eedfc8]/60'
                      }`}
                    >
                      {counts[option.id]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          {loading ? (
            <div className="page-card-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-28 skeleton rounded-3xl" />
              ))}
            </div>
          ) : currentList.length === 0 ? (
            <div className="card-light text-center">
              <i className="ri-links-line text-4xl text-[#eedfc8]/25" />
              <p className="mt-3 text-sm text-[#eedfc8]/60">
                {tab === 'accepted'
                  ? 'No strands yet — send one from someone\'s profile to get started.'
                  : tab === 'received'
                    ? 'No incoming strands right now.'
                    : 'No strands sent right now.'}
              </p>
              {tab !== 'sent' && (
                <Link
                  href="/trauma-bonding"
                  className="btn-primary mt-4 inline-block !py-2.5 !px-4 text-sm"
                >
                  Find people to strand with
                </Link>
              )}
            </div>
          ) : (
            <div className="page-card-grid">
              {currentList.map((strand) => {
                const profile = strand.profile
                const otherUserId = strand.direction === 'sent' ? (strand.target_user_id as string) : (strand.requester_id as string)
                const name = displayName(profile)
                const busy = busyIds.has(strand.id)

                return (
                  <article key={strand.id} className="card">
                    <div className="flex items-start gap-3">
                      <Link
                        href={`/profile/${otherUserId}`}
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D19A58]/18 text-sm font-bold text-[#D19A58]"
                      >
                        {getInitials(name)}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/profile/${otherUserId}`}
                          className="block truncate font-semibold text-[#eedfc8] hover:text-[#D19A58]"
                        >
                          {name}
                        </Link>
                        {(profile?.bio as string | undefined) && (
                          <p className="mt-1 line-clamp-2 text-sm text-[#eedfc8]/60">
                            {profile?.bio as string}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-[#eedfc8]/40">
                          {tab === 'accepted' && 'Stranded '}
                          {tab === 'received' && 'Sent you a strand '}
                          {tab === 'sent' && 'You sent a strand '}
                          {formatRelativeTime(strand.updated_at ?? strand.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {tab === 'received' && (
                        <>
                          <button
                            onClick={() => acceptStrand(strand.id)}
                            disabled={busy}
                            className="btn-primary !rounded-2xl !py-2 !px-4 text-sm disabled:opacity-50"
                          >
                            Accept strand
                          </button>
                          <button
                            onClick={() => declineStrand(strand.id)}
                            disabled={busy}
                            className="btn-secondary !rounded-2xl !py-2 !px-4 text-sm disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {tab === 'sent' && (
                        <button
                          onClick={() => withdrawStrand(strand.id)}
                          disabled={busy}
                          className="btn-secondary !rounded-2xl !py-2 !px-4 text-sm disabled:opacity-50"
                        >
                          Withdraw strand
                        </button>
                      )}
                      {tab === 'accepted' && (
                        <Link
                          href={`/profile/${otherUserId}`}
                          className="btn-secondary !rounded-2xl !py-2 !px-4 text-sm"
                        >
                          View profile
                        </Link>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
