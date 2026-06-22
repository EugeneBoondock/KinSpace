'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import { useToast } from '@/components/Toast'
import { DatabaseService } from '@/lib/database'
import PageFrame from '@/components/PageFrame'
import BottomNav from '@/components/BottomNav'
import { Avatar, Badge, Button, Card, LinkButton, Skeleton, Textarea } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatRelativeTime } from '@/lib/platform'
import { getSessionTemplate } from '@/lib/group-session/templates'

const MESSAGE_POLL_MS = 3000
const DETAIL_POLL_MS = 6000

/** Operational phases the host cycles through (template phases are guidance). */
const PHASE_CYCLE = ['checkin', 'discussion', 'closing'] as const
const PHASE_LABELS: Record<string, string> = {
  checkin: 'Check-in',
  discussion: 'Discussion',
  closing: 'Closing',
  ended: 'Ended',
}

type Profile = {
  full_name: string | null
  pseudonym: string | null
  username: string | null
  is_anonymous?: boolean
  avatar_url: string | null
}

type Participant = {
  user_id: string
  role: string
  hand_raised: boolean
  status: string
  profile: Profile | null
}

type SessionDetail = {
  id: string
  group_id: string
  host_id: string
  title: string
  template: string
  topic: string
  status: 'live' | 'ended'
  phase: string
  floor_holder_id: string | null
  floor_expires_at: string | null
  started_at: string | null
  ended_at: string | null
  is_host: boolean
  my_role: 'host' | 'member' | null
  participants: Participant[]
}

type Message = {
  id: string
  user_id: string
  kind: 'message' | 'system'
  content: string
  created_at: string | null
  profile: Profile | null
}

function personName(profile: Profile | null): string {
  if (!profile || profile.is_anonymous) return 'A member'
  return profile.full_name || profile.pseudonym || profile.username || 'A member'
}

export default function SessionRoomPage() {
  const { groupId, sessionId } = useParams<{ groupId: string; sessionId: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { push: toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [composer, setComposer] = useState('')
  const [sending, setSending] = useState(false)
  const [joining, setJoining] = useState(false)

  const lastTsRef = useRef<string | null>(null)
  const streamRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  const loadDetail = useCallback(async () => {
    try {
      const result = (await DatabaseService.getSessionDetail(sessionId)) as SessionDetail | null
      setDetail(result)
      return result
    } catch (error) {
      console.error('Failed to load session detail:', error)
      return null
    }
  }, [sessionId])

  const loadNewMessages = useCallback(async () => {
    try {
      const rows = (await DatabaseService.getSessionMessages(sessionId, lastTsRef.current)) as Message[]
      if (Array.isArray(rows) && rows.length > 0) {
        const newest = rows[rows.length - 1]?.created_at ?? lastTsRef.current
        lastTsRef.current = newest
        setMessages((current) => {
          const seen = new Set(current.map((message) => message.id))
          const fresh = rows.filter((message) => !seen.has(message.id))
          return fresh.length > 0 ? [...current, ...fresh] : current
        })
      }
    } catch (error) {
      console.error('Failed to load session messages:', error)
    }
  }, [sessionId])

  // Initial load.
  useEffect(() => {
    async function load() {
      if (!user) return
      setLoading(true)
      await loadDetail()
      await loadNewMessages()
      setLoading(false)
    }
    if (user) load()
  }, [user, loadDetail, loadNewMessages])

  // Poll messages (3s) and detail (6s), paused while the tab is hidden.
  useEffect(() => {
    if (!user) return
    const messageInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      loadNewMessages()
    }, MESSAGE_POLL_MS)
    const detailInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      loadDetail()
    }, DETAIL_POLL_MS)
    return () => {
      clearInterval(messageInterval)
      clearInterval(detailInterval)
    }
  }, [user, loadNewMessages, loadDetail])

  // Keep the newest message in view.
  useEffect(() => {
    const node = streamRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages])

  async function handleJoin() {
    setJoining(true)
    try {
      await DatabaseService.joinSession(sessionId)
      await loadDetail()
      await loadNewMessages()
    } catch (error) {
      console.error('Failed to join session:', error)
      toast(error instanceof Error ? error.message : 'Could not join the session', 'error')
    } finally {
      setJoining(false)
    }
  }

  async function handleSend() {
    const body = composer.trim()
    if (!body) return
    setSending(true)
    try {
      await DatabaseService.sendSessionMessage(sessionId, body)
      setComposer('')
      await loadNewMessages()
    } catch (error) {
      console.error('Failed to send message:', error)
      toast(error instanceof Error ? error.message : 'Could not send your message', 'error')
    } finally {
      setSending(false)
    }
  }

  async function handleRaiseHand(raised: boolean) {
    try {
      await DatabaseService.raiseHand(sessionId, raised)
      await loadDetail()
    } catch (error) {
      console.error('Failed to toggle hand:', error)
      toast('Could not update your hand', 'error')
    }
  }

  async function handleAdvancePhase() {
    if (!detail) return
    const currentIndex = PHASE_CYCLE.indexOf(detail.phase as (typeof PHASE_CYCLE)[number])
    const next = PHASE_CYCLE[Math.min(currentIndex + 1, PHASE_CYCLE.length - 1)]
    try {
      await DatabaseService.advancePhase(sessionId, next)
      await loadDetail()
    } catch (error) {
      console.error('Failed to advance phase:', error)
      toast(error instanceof Error ? error.message : 'Could not move the session along', 'error')
    }
  }

  async function handlePassFloor(toUserId: string | null) {
    try {
      await DatabaseService.passFloor(sessionId, toUserId)
      await loadDetail()
      await loadNewMessages()
    } catch (error) {
      console.error('Failed to pass floor:', error)
      toast(error instanceof Error ? error.message : 'Could not pass the talking stick', 'error')
    }
  }

  async function handleEnd() {
    if (typeof window !== 'undefined' && !window.confirm('End this session for everyone?')) return
    try {
      await DatabaseService.endSession(sessionId)
      await loadDetail()
    } catch (error) {
      console.error('Failed to end session:', error)
      toast(error instanceof Error ? error.message : 'Could not end the session', 'error')
    }
  }

  if (loading) {
    return (
      <PageFrame>
        <div className="page-grid space-y-6">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  if (!detail) {
    return (
      <PageFrame>
        <div className="page-grid">
          <Card className="space-y-3 text-center">
            <h1 className="text-xl font-bold text-brand-background">Session not found</h1>
            <p className="text-sm text-brand-background/60">This session may have ended or the link is no longer valid.</p>
            <div className="pt-1">
              <LinkButton href={`/groups/${groupId}/sessions`} variant="secondary">
                Back to sessions
              </LinkButton>
            </div>
          </Card>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  const isParticipant = detail.my_role !== null
  const isEnded = detail.status !== 'live'
  const myId = user?.userId ?? null
  const iHaveFloor = detail.floor_holder_id === myId
  const floorActive =
    Boolean(detail.floor_expires_at) && new Date(detail.floor_expires_at as string).getTime() > Date.now()
  const turnBased = detail.phase !== 'checkin'
  // Composer is locked when someone else holds an active floor during a turn-based phase.
  const floorLocked =
    turnBased && !isEnded && Boolean(detail.floor_holder_id) && !iHaveFloor && floorActive
  const floorHolder = detail.participants.find((participant) => participant.user_id === detail.floor_holder_id) ?? null
  const template = getSessionTemplate(detail.template)
  const myHandRaised = detail.participants.find((participant) => participant.user_id === myId)?.hand_raised ?? false

  return (
    <PageFrame>
      <div className="page-grid space-y-4">
        {/* Header */}
        <header className="space-y-2">
          <LinkButton
            href={`/groups/${groupId}/sessions`}
            variant="ghost"
            size="sm"
            leadingIcon={<i className="ri-arrow-left-line" aria-hidden="true" />}
          >
            All sessions
          </LinkButton>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-brand-background">{detail.title}</h1>
            {isEnded ? <Badge tone="neutral">Ended</Badge> : <Badge tone="success">Live</Badge>}
          </div>
          <p className="text-xs text-brand-background/55">
            {template.label} · {PHASE_LABELS[detail.phase] ?? detail.phase}
            {detail.topic ? ` · ${detail.topic}` : ''}
          </p>
        </header>

        {isEnded && (
          <Card className="border-brand-background/10 bg-brand-background/[0.04]">
            <p className="text-sm text-brand-background/70">
              This session has ended. You can still read back through the conversation below.
            </p>
          </Card>
        )}

        {/* Participants strip */}
        <Card className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent2">
            In the circle · {detail.participants.length}
          </p>
          <div className="flex flex-wrap gap-3">
            {detail.participants.map((participant) => {
              const name = personName(participant.profile)
              const holdsFloor = participant.user_id === detail.floor_holder_id
              return (
                <div key={participant.user_id} className="flex w-16 flex-col items-center gap-1 text-center">
                  <div className={cn('relative rounded-full', holdsFloor && 'ring-2 ring-brand-accent2 ring-offset-2 ring-offset-brand-primary')}>
                    <Avatar src={participant.profile?.is_anonymous ? null : participant.profile?.avatar_url} name={name} size="md" />
                    {participant.hand_raised && (
                      <span className="absolute -right-1 -top-1 text-sm" title="Hand raised" aria-label="Hand raised">
                        ✋
                      </span>
                    )}
                    {holdsFloor && (
                      <span className="absolute -bottom-1 -right-1 text-sm" title="Has the talking stick" aria-label="Has the talking stick">
                        🪶
                      </span>
                    )}
                  </div>
                  <span className="w-full truncate text-[11px] text-brand-background/70">{name}</span>
                  {participant.role === 'host' && <Badge tone="info">Host</Badge>}
                </div>
              )
            })}
          </div>
        </Card>

        {/* Join prompt for non-participants */}
        {!isParticipant && !isEnded && (
          <Card className="flex flex-col items-center gap-3 py-5 text-center">
            <p className="text-sm text-brand-background/70">Join the circle to take part in this session.</p>
            <Button onClick={handleJoin} disabled={joining} isLoading={joining}>
              {joining ? 'Joining…' : 'Join session'}
            </Button>
          </Card>
        )}

        {/* Controls */}
        {isParticipant && !isEnded && (
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={myHandRaised ? 'accent' : 'secondary'}
                size="sm"
                onClick={() => handleRaiseHand(!myHandRaised)}
                leadingIcon={<span aria-hidden="true">✋</span>}
              >
                {myHandRaised ? 'Lower hand' : 'Raise hand'}
              </Button>

              {(iHaveFloor || detail.is_host) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePassFloor(null)}
                  leadingIcon={<span aria-hidden="true">🪶</span>}
                >
                  Open the floor
                </Button>
              )}

              {detail.is_host && (
                <>
                  {detail.phase !== 'closing' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleAdvancePhase}
                      leadingIcon={<i className="ri-skip-forward-line" aria-hidden="true" />}
                    >
                      Next phase
                    </Button>
                  )}
                  <Button variant="danger" size="sm" onClick={handleEnd}>
                    End session
                  </Button>
                </>
              )}
            </div>

            {/* Host: pass the stick to a specific participant */}
            {detail.is_host && detail.participants.length > 1 && (
              <div className="space-y-1.5 border-t border-brand-background/8 pt-3">
                <p className="text-xs text-brand-background/55">Pass the talking stick to:</p>
                <div className="flex flex-wrap gap-1.5">
                  {detail.participants.map((participant) => (
                    <Button
                      key={participant.user_id}
                      variant={participant.user_id === detail.floor_holder_id ? 'accent' : 'ghost'}
                      size="sm"
                      onClick={() => handlePassFloor(participant.user_id)}
                    >
                      {participant.hand_raised ? '✋ ' : ''}
                      {personName(participant.profile)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Check-in prompt */}
        {detail.phase === 'checkin' && !isEnded && (
          <Card className="border-brand-accent2/25 bg-brand-accent2/[0.06]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent2">Check-in</p>
            <p className="mt-2 text-sm leading-relaxed text-brand-background/80">{template.checkinPrompt}</p>
          </Card>
        )}

        {/* Message stream */}
        <Card className="space-y-3">
          <div ref={streamRef} className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-brand-background/45">No messages yet. Say hello.</p>
            ) : (
              messages.map((message) => {
                if (message.kind === 'system') {
                  return (
                    <p key={message.id} className="text-center text-[11px] italic text-brand-background/45">
                      {message.content}
                    </p>
                  )
                }
                const name = personName(message.profile)
                const mine = message.user_id === myId
                return (
                  <div key={message.id} className={cn('flex gap-2.5', mine && 'flex-row-reverse')}>
                    <Avatar src={message.profile?.is_anonymous ? null : message.profile?.avatar_url} name={name} size="sm" />
                    <div className={cn('min-w-0 max-w-[80%]', mine && 'text-right')}>
                      <div className={cn('flex items-center gap-2', mine && 'flex-row-reverse')}>
                        <span className="text-xs font-semibold text-brand-background">{mine ? 'You' : name}</span>
                        {message.created_at && (
                          <span className="text-[10px] text-brand-background/40">{formatRelativeTime(message.created_at)}</span>
                        )}
                      </div>
                      <p
                        className={cn(
                          'mt-1 inline-block whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-relaxed',
                          mine ? 'bg-brand-accent2/15 text-brand-background' : 'bg-brand-background/[0.06] text-brand-background/85',
                        )}
                      >
                        {message.content}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Composer */}
          {isParticipant && !isEnded && (
            <div className="space-y-2 border-t border-brand-background/8 pt-3">
              {floorLocked ? (
                <p className="rounded-xl bg-brand-background/[0.05] px-3 py-2 text-center text-xs text-brand-background/60">
                  🪶 {personName(floorHolder?.profile ?? null)} has the floor
                </p>
              ) : (
                <>
                  <Textarea
                    value={composer}
                    onChange={(event) => setComposer(event.target.value)}
                    rows={2}
                    placeholder="Share with the circle…"
                    aria-label="Write a message"
                    className="resize-none"
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleSend} disabled={sending || !composer.trim()} isLoading={sending}>
                      {sending ? 'Sending…' : 'Send'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </Card>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
