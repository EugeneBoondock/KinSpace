'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import { useToast } from '@/components/Toast'
import { DatabaseService } from '@/lib/database'
import PageFrame from '@/components/PageFrame'
import BottomNav from '@/components/BottomNav'
import { Avatar, Badge, Button, Card, EmptyState, Input, LinkButton, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatRelativeTime } from '@/lib/platform'
import { SESSION_TEMPLATES, getSessionTemplate } from '@/lib/group-session/templates'

type HostProfile = {
  full_name: string | null
  pseudonym: string | null
  username: string | null
  is_anonymous?: boolean
  avatar_url: string | null
}

type SessionSummary = {
  id: string
  group_id: string
  host_id: string
  title: string
  template: string
  topic: string
  status: 'live' | 'ended'
  phase: string
  started_at: string | null
  ended_at: string | null
  host: HostProfile | null
  participant_count: number
}

function hostName(host: HostProfile | null): string {
  if (!host || host.is_anonymous) return 'A member'
  return host.full_name || host.pseudonym || host.username || 'A member'
}

export default function GroupSessionsPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { push: toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<SessionSummary[]>([])

  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [template, setTemplate] = useState<string>(SESSION_TEMPLATES[0].id)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  const loadSessions = useCallback(async () => {
    try {
      const rows = (await DatabaseService.getGroupSessions(groupId)) as SessionSummary[]
      setSessions(Array.isArray(rows) ? rows : [])
    } catch (error) {
      console.error('Failed to load sessions:', error)
      toast('Could not load sessions', 'error')
    }
  }, [groupId, toast])

  useEffect(() => {
    async function load() {
      if (!user) return
      setLoading(true)
      await loadSessions()
      setLoading(false)
    }
    if (user) load()
  }, [user, loadSessions])

  async function handleCreate() {
    const trimmed = title.trim()
    if (!trimmed) {
      toast('Give the session a title', 'error')
      return
    }
    setCreating(true)
    try {
      const result = (await DatabaseService.createGroupSession({
        groupId,
        title: trimmed,
        template,
        topic: topic.trim(),
      })) as { id: string }
      router.push(`/groups/${groupId}/sessions/${result.id}`)
    } catch (error) {
      console.error('Failed to create session:', error)
      toast(error instanceof Error ? error.message : 'Could not start the session', 'error')
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <PageFrame>
        <div className="page-grid space-y-6">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-48 rounded-2xl" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-2xl" />
            ))}
          </div>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  const live = sessions.filter((session) => session.status === 'live')
  const past = sessions.filter((session) => session.status !== 'live')

  return (
    <PageFrame>
      <div className="page-grid space-y-6">
        <header className="space-y-2">
          <LinkButton href={`/groups/${groupId}`} variant="ghost" size="sm" leadingIcon={<i className="ri-arrow-left-line" aria-hidden="true" />}>
            Back to group
          </LinkButton>
          <h1 className="text-2xl font-bold text-brand-background">Support sessions</h1>
          <p className="text-sm text-brand-background/60">
            Live, turn-based circles. One person holds the talking stick at a time so everyone is heard.
          </p>
        </header>

        {/* Live sessions */}
        {live.length > 0 && (
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent2">Happening now</p>
            {live.map((session) => (
              <Card key={session.id} className="space-y-3 border-brand-accent2/30">
                <div className="flex items-start gap-3">
                  <Avatar src={session.host?.is_anonymous ? null : session.host?.avatar_url} name={hostName(session.host)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-brand-background">{session.title}</p>
                      <Badge tone="success">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                          Live
                        </span>
                      </Badge>
                    </div>
                    <p className="text-xs text-brand-background/50">
                      {getSessionTemplate(session.template).label} · Hosted by {hostName(session.host)} · {session.participant_count} here
                    </p>
                    {session.topic && <p className="mt-1 truncate text-xs text-brand-background/60">Topic: {session.topic}</p>}
                  </div>
                  <LinkButton href={`/groups/${groupId}/sessions/${session.id}`} size="sm">
                    Join
                  </LinkButton>
                </div>
              </Card>
            ))}
          </section>
        )}

        {/* Start a session */}
        <Card className="space-y-4">
          <p className="text-sm font-semibold text-brand-background">Start a session</p>

          <div className="space-y-2">
            <p className="text-xs font-medium text-brand-background/70">Choose a format</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SESSION_TEMPLATES.map((option) => {
                const selected = template === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTemplate(option.id)}
                    aria-pressed={selected}
                    className={cn(
                      'rounded-2xl border px-4 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                      selected
                        ? 'border-brand-accent2/40 bg-brand-accent2/12 text-brand-accent2'
                        : 'border-brand-background/8 bg-brand-background/[0.04] text-brand-background/65 hover:bg-brand-background/8',
                    )}
                  >
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className="mt-1 text-xs opacity-80">{option.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="session-title" className="text-sm font-medium text-brand-background">
              Title
            </label>
            <Input
              id="session-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Tuesday evening check-in"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="session-topic" className="text-sm font-medium text-brand-background">
              Topic <span className="text-brand-background/45">(optional)</span>
            </label>
            <Input
              id="session-topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="What is this session about?"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleCreate} disabled={creating || !title.trim()} isLoading={creating}>
              {creating ? 'Starting…' : 'Start session'}
            </Button>
          </div>
        </Card>

        {/* Past sessions */}
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent2">Past sessions</p>
          {past.length === 0 ? (
            <EmptyState
              icon={<i className="ri-calendar-event-line text-3xl" aria-hidden="true" />}
              title="No past sessions yet"
              description="When a session wraps up, it will show here so you can revisit the conversation."
            />
          ) : (
            past.map((session) => (
              <Card key={session.id} className="space-y-2">
                <div className="flex items-start gap-3">
                  <Avatar src={session.host?.is_anonymous ? null : session.host?.avatar_url} name={hostName(session.host)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-background">{session.title}</p>
                    <p className="text-xs text-brand-background/50">
                      {getSessionTemplate(session.template).label} · {hostName(session.host)} ·{' '}
                      {session.ended_at ? formatRelativeTime(session.ended_at) : formatRelativeTime(session.started_at)}
                    </p>
                  </div>
                  <LinkButton href={`/groups/${groupId}/sessions/${session.id}`} variant="secondary" size="sm">
                    Open
                  </LinkButton>
                </div>
              </Card>
            ))
          )}
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
