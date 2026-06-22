'use client'

import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import ProfileAvatar from '@/components/ProfileAvatar'
import StrandButton from '@/components/StrandButton'
import { useToast } from '@/components/Toast'
import { Badge, Button, Card, EmptyState, LinkButton, Skeleton } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { formatRelativeTime } from '@/lib/platform'

type Candidate = Record<string, unknown> & { id: string }
type Request = Record<string, unknown> & { id: string }

export default function TraumaBondingPage() {
  const { user, loading: authLoading } = useAuth()
  const { push: toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [receivedRequests, setReceivedRequests] = useState<Request[]>([])
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function loadConnections() {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        const [candidateResults, incomingRequests] = await Promise.all([
          DatabaseService.getConnectionCandidates(user.userId, 12),
          DatabaseService.getReceivedConnectionRequests(user.userId),
        ])
        setCandidates(candidateResults as Candidate[])
        setReceivedRequests(
          (incomingRequests as Request[]).filter((request) => request.status === 'pending'),
        )
      } catch (error) {
        console.error('Failed to load connection finder:', error)
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading) loadConnections()
  }, [authLoading, user])

  async function handleUpdateRequest(requestId: string, status: 'accepted' | 'declined') {
    setUpdatingIds((current) => new Set(current).add(requestId))

    try {
      await DatabaseService.updateConnectionRequest(requestId, status)
      setReceivedRequests((current) => current.filter((request) => request.id !== requestId))
      toast(status === 'accepted' ? 'Connection accepted' : 'Request declined', 'success')
    } catch (error) {
      console.error('Failed to update connection request:', error)
      toast('Could not update request', 'error')
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current)
        next.delete(requestId)
        return next
      })
    }
  }

  return (
    <PageFrame>
      <div className="page-grid">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-background/45">
            Discover
          </p>
          <h1 className="mt-2 text-2xl font-bold text-brand-background sm:text-3xl">Find people to strand with</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-background/65">
            Real profiles, matched by shared groups, location, and how you like to connect. Send a strand
            when someone feels like a good fit - no pressure, no rush.
          </p>
          <LinkButton
            href="/strands"
            variant="secondary"
            size="sm"
            className="mt-4"
            leadingIcon={<i className="ri-links-line" aria-hidden="true" />}
          >
            My strands
          </LinkButton>
        </Card>

        <div className="page-grid lg:grid-cols-[minmax(0,1.1fr)_22rem] lg:items-start">
          <section className="page-grid">
            {loading ? (
              <div className="page-card-grid">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-64 rounded-2xl" />
                ))}
              </div>
            ) : candidates.length > 0 ? (
              <div className="page-card-grid">
                {candidates.map((candidate) => {
                  const displayName =
                    (candidate.full_name as string | undefined) ||
                    (candidate.username as string | undefined) ||
                    'KinSpace member'

                  return (
                    <Card key={candidate.id} interactive className="flex flex-col">
                      <div className="flex items-start gap-4">
                        <ProfileAvatar
                          alt={displayName}
                          avatarUrl={candidate.avatar_url as string | undefined}
                          className="h-16 w-16 rounded-2xl object-cover"
                          fullName={candidate.full_name as string | undefined}
                          userId={candidate.id}
                          username={candidate.username as string | undefined}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-lg font-semibold text-brand-background">{displayName}</h2>
                            <Badge className="bg-brand-accent2/20 text-brand-accent2">
                              {candidate.match_score as number}% fit
                            </Badge>
                          </div>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-brand-background/45">
                            <i className="ri-map-pin-line" aria-hidden="true" />
                            {(candidate.location as string | undefined) || 'Location hidden'}
                          </p>
                        </div>
                      </div>

                      <p className="mt-4 text-sm leading-relaxed text-brand-background/70">
                        {(candidate.bio as string | undefined) || 'No bio shared yet.'}
                      </p>

                      {Array.isArray(candidate.connection_highlights) && candidate.connection_highlights.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {(candidate.connection_highlights as string[]).map((highlight) => (
                            <Badge key={highlight} className="text-[10px]">
                              {highlight}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="mt-5 flex gap-2">
                        <StrandButton
                          targetUserId={candidate.id}
                          className="flex-1"
                          onChanged={(status) => {
                            if (status === 'sent') {
                              setCandidates((current) => current.filter((c) => c.id !== candidate.id))
                            }
                          }}
                        />
                      </div>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon={<i className="ri-user-search-line text-4xl" aria-hidden="true" />}
                title="No suggestions right now"
                description="We're out of fresh matches for the moment. Check back soon - new members join all the time."
                action={
                  <LinkButton href="/strands" variant="secondary" leadingIcon={<i className="ri-links-line" aria-hidden="true" />}>
                    View my strands
                  </LinkButton>
                }
              />
            )}
          </section>

          <aside className="space-y-4">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-brand-background">Incoming requests</h2>
                <Badge>{receivedRequests.length}</Badge>
              </div>

              <div className="mt-4 space-y-3">
                {receivedRequests.length > 0 ? (
                  receivedRequests.map((request) => {
                    const busy = updatingIds.has(request.id)
                    return (
                      <div
                        key={request.id}
                        className="rounded-xl border border-brand-background/10 bg-brand-background/[0.06] p-4"
                      >
                        <p className="flex items-center gap-2 text-sm font-semibold text-brand-background">
                          <i className="ri-user-received-line text-brand-accent2" aria-hidden="true" />
                          New connection request
                        </p>
                        <p className="mt-1 text-xs text-brand-background/45">
                          Received {formatRelativeTime(request.created_at)}
                        </p>
                        <div className="mt-4 flex gap-2">
                          <Button
                            size="sm"
                            fullWidth
                            onClick={() => handleUpdateRequest(request.id, 'accepted')}
                            disabled={busy}
                            isLoading={busy}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            fullWidth
                            onClick={() => handleUpdateRequest(request.id, 'declined')}
                            disabled={busy}
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-brand-background/55">No pending requests yet.</p>
                )}
              </div>
            </Card>

            <Card variant="light">
              <p className="flex items-center gap-2 text-sm font-semibold text-brand-background">
                <i className="ri-information-line text-brand-accent3" aria-hidden="true" />
                How suggestions work
              </p>
              <p className="mt-2 text-sm leading-relaxed text-brand-background/65">
                Matches are ranked by real profile overlap - shared groups, location, and the ways you each
                prefer to communicate. You&apos;re always in control of who you reach out to.
              </p>
            </Card>
          </aside>
        </div>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
