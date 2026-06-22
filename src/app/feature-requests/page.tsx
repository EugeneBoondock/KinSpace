'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageFrame from '@/components/PageFrame'
import BottomNav from '@/components/BottomNav'
import { useAuth } from '@/lib/AuthContext'
import { useToast } from '@/components/Toast'
import { DatabaseService } from '@/lib/database'
import { formatRelativeTime, toDate } from '@/lib/platform'
import { Avatar, Badge, Button, Card, EmptyState, Input, Skeleton, Textarea } from '@/components/ui'
import { cn } from '@/lib/cn'

type FeatureRequest = {
  id: string
  title: string
  description: string
  category: string
  status: string
  votes_count: number
  is_anonymous: boolean
  created_at: string | null
  author: { full_name: string | null; username: string | null; avatar_url: string | null } | null
}

const STATUS_META: Record<string, { label: string; tone?: 'accent' | 'info' }> = {
  open: { label: 'Open' },
  planned: { label: 'Planned', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'info' },
  shipped: { label: 'Shipped', tone: 'accent' },
  declined: { label: 'Not planned' },
}

function authorName(request: FeatureRequest): string {
  if (request.is_anonymous || !request.author) return 'Someone'
  return request.author.full_name || request.author.username || 'A member'
}

export default function FeatureRequestsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { push: toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<FeatureRequest[]>([])
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    async function load() {
      if (!user) return
      try {
        const [list, mine] = await Promise.all([
          DatabaseService.getFeatureRequests(100),
          DatabaseService.getMyFeatureVotes(),
        ])
        setRequests(Array.isArray(list) ? (list as FeatureRequest[]) : [])
        setVotedIds(new Set(Array.isArray(mine) ? (mine as string[]) : []))
      } catch (error) {
        console.error('Failed to load feature requests:', error)
      } finally {
        setLoading(false)
      }
    }
    if (user) load()
  }, [user])

  async function handleVote(id: string) {
    const wasVoted = votedIds.has(id)
    setVotedIds((current) => {
      const next = new Set(current)
      if (wasVoted) next.delete(id)
      else next.add(id)
      return next
    })
    setRequests((current) =>
      current.map((request) =>
        request.id === id
          ? { ...request, votes_count: Math.max(0, request.votes_count + (wasVoted ? -1 : 1)) }
          : request))
    try {
      await DatabaseService.toggleFeatureVote(id)
    } catch (error) {
      console.error('Failed to vote:', error)
      // Roll back on failure.
      setVotedIds((current) => {
        const next = new Set(current)
        if (wasVoted) next.add(id)
        else next.delete(id)
        return next
      })
      setRequests((current) =>
        current.map((request) =>
          request.id === id
            ? { ...request, votes_count: Math.max(0, request.votes_count + (wasVoted ? 1 : -1)) }
            : request))
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim() || submitting) return
    setSubmitting(true)
    try {
      await DatabaseService.createFeatureRequest({ title: title.trim(), description: description.trim() })
      setTitle('')
      setDescription('')
      setShowForm(false)
      toast('Idea submitted, thank you', 'success')
      const list = await DatabaseService.getFeatureRequests(100)
      setRequests(Array.isArray(list) ? (list as FeatureRequest[]) : [])
      const mine = await DatabaseService.getMyFeatureVotes()
      setVotedIds(new Set(Array.isArray(mine) ? (mine as string[]) : []))
    } catch (error) {
      console.error('Failed to submit feature request:', error)
      toast('Could not submit your idea', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageFrame>
      <div className="page-grid space-y-6 overflow-x-hidden">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent2">Shape KinSpace</p>
            <h1 className="text-2xl font-bold text-brand-background sm:text-3xl">Feature requests</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-brand-background/60">
              Tell us what would make KinSpace better for you. Upvote the ideas you want most, we build by what helps the
              most people.
            </p>
          </div>
          <Button
            onClick={() => setShowForm((open) => !open)}
            leadingIcon={<i className={showForm ? 'ri-close-line' : 'ri-add-line'} aria-hidden="true" />}
            className="shrink-0"
          >
            {showForm ? 'Cancel' : 'Suggest an idea'}
          </Button>
        </header>

        {showForm && (
          <Card>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="A short title for your idea"
                aria-label="Idea title"
                maxLength={140}
                autoFocus
              />
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What would it do, and how would it help you? (optional)"
                aria-label="Idea description"
                rows={3}
                className="resize-none"
                maxLength={2000}
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" isLoading={submitting} disabled={submitting || !title.trim()}>
                  {submitting ? 'Submitting…' : 'Submit idea'}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <EmptyState
              icon={<i className="ri-lightbulb-flash-line text-3xl" aria-hidden="true" />}
              title="No ideas yet"
              description="Be the first to suggest something that would help you and others here."
              action={<Button onClick={() => setShowForm(true)}>Suggest an idea</Button>}
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => {
              const voted = votedIds.has(request.id)
              const status = STATUS_META[request.status] ?? STATUS_META.open
              const when = toDate(request.created_at)
              return (
                <Card key={request.id} className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleVote(request.id)}
                    aria-pressed={voted}
                    aria-label={voted ? 'Remove your vote' : 'Upvote this idea'}
                    className={cn(
                      'flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                      voted
                        ? 'border-brand-accent2/50 bg-brand-accent2/[0.14] text-brand-accent2'
                        : 'border-brand-background/12 bg-brand-background/[0.04] text-brand-background/60 hover:border-brand-accent2/30')}
                  >
                    <i className={voted ? 'ri-arrow-up-circle-fill text-lg' : 'ri-arrow-up-circle-line text-lg'} aria-hidden="true" />
                    <span className="mt-0.5 text-sm font-bold">{request.votes_count}</span>
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-brand-background">{request.title}</h2>
                      <Badge tone={status.tone} className="text-[10px]">
                        {status.label}
                      </Badge>
                    </div>
                    {request.description && (
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-brand-background/70">
                        {request.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-xs text-brand-background/45">
                      {!request.is_anonymous && (
                        <Avatar src={request.author?.avatar_url} name={authorName(request)} size="sm" className="h-5 w-5 text-[9px]" />
                      )}
                      <span>{authorName(request)}</span>
                      {when && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{formatRelativeTime(when)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </PageFrame>
  )
}
