'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import ProfileAvatar from '@/components/ProfileAvatar'
import StrandButton from '@/components/StrandButton'
import { useToast } from '@/components/Toast'
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
        <section className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
            🧬 Discover
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Find people to strand with</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#eedfc8]/60">
            Real profiles, matched by shared groups, location, and preferences. Send a Connect Strand
            to start a real conversation.
          </p>
          <Link href="/strands" className="btn-secondary mt-4 inline-block !py-2.5 !px-4 text-sm">
            My strands →
          </Link>
        </section>

        <div className="page-grid lg:grid-cols-[minmax(0,1.1fr)_22rem] lg:items-start">
          <section className="page-grid">
            {loading ? (
              <div className="page-card-grid">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-64 skeleton rounded-3xl" />
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
                    <article key={candidate.id} className="card">
                      <div className="flex items-start gap-4">
                        <ProfileAvatar
                          alt={displayName}
                          avatarUrl={candidate.avatar_url as string | undefined}
                          className="h-16 w-16 rounded-3xl object-cover"
                          fullName={candidate.full_name as string | undefined}
                          userId={candidate.id}
                          username={candidate.username as string | undefined}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h2 className="truncate text-lg font-semibold text-[#eedfc8]">{displayName}</h2>
                            <span className="badge bg-[#D19A58]/15 text-[#D19A58]">
                              {candidate.match_score as number}% fit
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[#eedfc8]/45">
                            {(candidate.location as string | undefined) || 'Location hidden'}
                          </p>
                        </div>
                      </div>

                      <p className="mt-4 text-sm leading-relaxed text-[#eedfc8]/70">
                        {(candidate.bio as string | undefined) || 'No bio shared yet.'}
                      </p>

                      {Array.isArray(candidate.connection_highlights) && candidate.connection_highlights.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {(candidate.connection_highlights as string[]).map((highlight) => (
                            <span key={highlight} className="badge text-[10px]">
                              {highlight}
                            </span>
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
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="card-light text-center">
                <i className="ri-user-search-line text-4xl text-[#eedfc8]/25" />
                <p className="mt-3 text-sm text-[#eedfc8]/60">
                  No new connection suggestions are available right now.
                </p>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <section className="card">
              <div className="flex items-center justify-between gap-3">
                <h2 className="section-title !mb-0">Incoming requests</h2>
                <span className="text-xs text-[#eedfc8]/45">{receivedRequests.length}</span>
              </div>

              <div className="mt-4 space-y-3">
                {receivedRequests.length > 0 ? (
                  receivedRequests.map((request) => {
                    const busy = updatingIds.has(request.id)
                    return (
                      <div key={request.id} className="card-light !p-4">
                        <p className="text-sm font-semibold text-[#eedfc8]">New connection request</p>
                        <p className="mt-1 text-xs text-[#eedfc8]/45">
                          Received {formatRelativeTime(request.created_at)}
                        </p>
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => handleUpdateRequest(request.id, 'accepted')}
                            disabled={busy}
                            className="btn-primary flex-1 !py-2 text-xs disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleUpdateRequest(request.id, 'declined')}
                            disabled={busy}
                            className="btn-secondary flex-1 !py-2 text-xs disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-[#eedfc8]/55">No pending requests yet.</p>
                )}
              </div>
            </section>

            <section className="card-light">
              <p className="text-sm font-semibold text-[#eedfc8]">How suggestions work</p>
              <p className="mt-2 text-sm text-[#eedfc8]/60">
                KinSpace now ranks suggestions using real profile overlap like shared groups, location, and communication preferences.
              </p>
            </section>
          </aside>
        </div>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
