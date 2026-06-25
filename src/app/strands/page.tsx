'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { MemberAvatar, MemberName } from '@/components/MemberIdentity'
import SocialStarterPanel from '@/components/SocialStarterPanel'
import StrandButton from '@/components/StrandButton'
import { useToast } from '@/components/Toast'
import { Button, Card, EmptyState, Input, LinkButton, Skeleton } from '@/components/ui'
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
  { id: 'accepted', label: 'Connected', icon: 'ri-links-line' },
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

type PersonResult = {
  user_id: string
  username?: string | null
  full_name?: string | null
  is_anonymous?: boolean | null
  avatar_url?: string | null
  bio?: string | null
  location?: string | null
  strand_status: 'none' | 'pending_sent' | 'pending_received' | 'accepted'
  request_id?: string | null
}

// Map the search row's strand_status onto StrandButton's initialStatus union.
function strandButtonStatus(status: PersonResult['strand_status']): 'idle' | 'sent' | 'received' | 'accepted' {
  if (status === 'pending_sent') return 'sent'
  if (status === 'pending_received') return 'received'
  if (status === 'accepted') return 'accepted'
  return 'idle'
}

const MIN_SEARCH_LEN = 2

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
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PersonResult[]>([])
  const [searching, setSearching] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const summary = await DatabaseService.getStrandSummary(user.userId)
      setAccepted((summary.accepted ?? []) as StrandRecord[])
      setPendingReceived(((summary as { pending_received?: unknown }).pending_received ?? []) as StrandRecord[])
      setPendingSent(((summary as { pending_sent?: unknown }).pending_sent ?? []) as StrandRecord[])
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

  // Debounced people search. Runs only once a query is at least MIN_SEARCH_LEN.
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < MIN_SEARCH_LEN) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const handle = setTimeout(async () => {
      try {
        const rows = await DatabaseService.searchPeople(q)
        setSearchResults((Array.isArray(rows) ? rows : []) as PersonResult[])
      } catch (error) {
        console.error('People search failed:', error)
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(handle)
  }, [searchQuery])

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
      toast('Stranded', 'success')
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

  const isSearching = searchQuery.trim().length >= MIN_SEARCH_LEN

  return (
    <PageFrame>
      <div className="page-grid">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-background/45">
            Find people
          </p>
          <h2 className="mt-2 text-lg font-bold text-brand-background">Search by name or place</h2>
          <p className="mt-1 text-sm text-brand-background/60">
            Look anyone up by name, @username, or city, then send them a strand.
          </p>
          <div className="relative mt-4">
            <i
              className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-background/40"
              aria-hidden="true"
            />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Try a name, @username, or city"
              aria-label="Search people"
              className="!pl-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-brand-background/50 transition-colors hover:bg-brand-background/10 hover:text-brand-background"
              >
                <i className="ri-close-line" aria-hidden="true" />
              </button>
            )}
          </div>
        </Card>

        {isSearching ? (
          <section className="space-y-3">
            {searching ? (
              <div className="page-card-grid">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-28 rounded-2xl" />
                ))}
              </div>
            ) : searchResults.length === 0 ? (
              <EmptyState
                icon={<i className="ri-user-search-line text-4xl" aria-hidden="true" />}
                title="No one found"
                description="Try a different name, username, or city."
              />
            ) : (
              <div className="page-card-grid">
                {searchResults.map((person) => {
                  const isAnonymous = Boolean(person.is_anonymous)
                  const name = isAnonymous
                    ? person.username || 'Community member'
                    : person.full_name || person.username || 'Community member'
                  const avatar = (
                    <MemberAvatar
                      profile={person as unknown as Record<string, unknown>}
                      alt={name}
                      avatarUrl={isAnonymous ? null : person.avatar_url}
                      fullName={isAnonymous ? null : person.full_name}
                      userId={person.user_id}
                      username={person.username ?? undefined}
                      className="h-12 w-12 rounded-2xl object-cover"
                    />
                  )
                  return (
                    <Card key={person.user_id} interactive>
                      <div className="flex items-start gap-3">
                        {isAnonymous ? (
                          <div className="shrink-0 rounded-2xl">{avatar}</div>
                        ) : (
                          <Link
                            href={`/profile/${person.user_id}`}
                            aria-label={`View ${name}’s profile`}
                            className="shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                          >
                            {avatar}
                          </Link>
                        )}
                        <div className="min-w-0 flex-1">
                          <MemberName
                            profile={person as unknown as Record<string, unknown>}
                            userId={person.user_id}
                            name={name}
                            isAnonymous={isAnonymous}
                            className="font-semibold text-brand-background hover:text-brand-accent2"
                          />
                          {person.username && (
                            <p className="truncate text-xs text-brand-background/45">@{person.username}</p>
                          )}
                          {person.location && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-brand-background/55">
                              <i className="ri-map-pin-2-line" aria-hidden="true" />
                              <span className="truncate">{person.location}</span>
                            </p>
                          )}
                          {person.bio && (
                            <p className="mt-1 line-clamp-2 text-sm text-brand-background/60">{person.bio}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-4">
                        <StrandButton
                          targetUserId={person.user_id}
                          initialStatus={strandButtonStatus(person.strand_status)}
                          initialRequestId={person.request_id}
                          size="sm"
                          onChanged={() => void load()}
                        />
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </section>
        ) : (
          <>
        <Card className="overflow-hidden !p-0">
          <div className="p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-background/45">
              Connect Strands
            </p>
            <h1 className="mt-2 text-2xl font-bold text-brand-background sm:text-3xl">Your kin strands</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-background/65">
              Strands are KinSpace’s warmer take on connections. Once two people strand, you can
              follow each other’s updates and reach out directly.
            </p>

            <div
              className="mt-5 flex gap-2 overflow-x-auto rounded-2xl bg-brand-background/5 p-1.5"
              role="tablist"
              aria-label="Filter strands"
            >
              {TABS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === option.id}
                  onClick={() => setTab(option.id)}
                  className={`flex min-w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 ${
                    tab === option.id ? 'tab-active' : 'tab-inactive'
                  }`}
                >
                  <i className={option.icon} aria-hidden="true" />
                  {option.label}
                  <span
                    className={`ml-1 rounded-full px-2 py-0.5 text-[10px] ${
                      tab === option.id ? 'bg-brand-primary/30' : 'bg-brand-background/10 text-brand-background/60'
                    }`}
                  >
                    {counts[option.id]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <section className="space-y-3">
          {loading ? (
            <div className="page-card-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : currentList.length === 0 ? (
            <div className="space-y-4">
              <EmptyState
                icon={<i className="ri-links-line text-4xl" aria-hidden="true" />}
                title={
                  tab === 'accepted'
                    ? 'No strands yet'
                    : tab === 'received'
                      ? 'No incoming strands'
                      : 'Nothing sent yet'
                }
                description={
                  tab === 'accepted'
                    ? 'When you and someone else strand, they will show up here.'
                    : tab === 'received'
                      ? 'Strand requests people send you will appear here.'
                      : 'Strands you send will appear here while you wait for a reply.'
                }
                action={
                  tab !== 'sent' ? (
                    <LinkButton href="/people-like-you" leadingIcon={<i className="ri-user-heart-line" aria-hidden="true" />}>
                      Find people to strand with
                    </LinkButton>
                  ) : undefined
                }
              />
              <SocialStarterPanel
                title="People worth starting with"
                description="Health-signal matches, open peer support, and fresh posts keep the first step from feeling cold."
              />
            </div>
          ) : (
            <div className="page-card-grid">
              {currentList.map((strand) => {
                const profile = strand.profile
                const otherUserId = strand.direction === 'sent' ? (strand.target_user_id as string) : (strand.requester_id as string)
                const name = displayName(profile)
                const busy = busyIds.has(strand.id)

                return (
                  <Card key={strand.id} interactive>
                    <div className="flex items-start gap-3">
                      <Link
                        href={`/profile/${otherUserId}`}
                        aria-label={`View ${name}’s profile`}
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-accent2/20 text-sm font-bold text-brand-accent2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                      >
                        {getInitials(name)}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/profile/${otherUserId}`}
                          className="block truncate font-semibold text-brand-background transition-colors hover:text-brand-accent2 focus-visible:outline-none focus-visible:text-brand-accent2"
                        >
                          {name}
                        </Link>
                        {(profile?.bio as string | undefined) && (
                          <p className="mt-1 line-clamp-2 text-sm text-brand-background/60">
                            {profile?.bio as string}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-brand-background/45">
                          {tab === 'accepted' && 'Connected '}
                          {tab === 'received' && 'Sent you a strand '}
                          {tab === 'sent' && 'You sent a strand '}
                          {formatRelativeTime(strand.updated_at ?? strand.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {tab === 'received' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => acceptStrand(strand.id)}
                            disabled={busy}
                            isLoading={busy}
                          >
                            Accept strand
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => declineStrand(strand.id)}
                            disabled={busy}
                          >
                            Decline
                          </Button>
                        </>
                      )}
                      {tab === 'sent' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => withdrawStrand(strand.id)}
                          disabled={busy}
                          isLoading={busy}
                        >
                          Withdraw strand
                        </Button>
                      )}
                      {tab === 'accepted' && (
                        <LinkButton href={`/profile/${otherUserId}`} variant="secondary" size="sm">
                          View profile
                        </LinkButton>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </section>
          </>
        )}
      </div>

      <BottomNav />
    </PageFrame>
  )
}
