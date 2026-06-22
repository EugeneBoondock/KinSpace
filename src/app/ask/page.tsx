'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import ProfileAvatar from '@/components/ProfileAvatar'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { formatCompactNumber, formatRelativeTime } from '@/lib/platform'
import { Badge, Button, Card, EmptyState, Input, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { isTransientFetchError } from '@/lib/client-errors'

type AskQuestion = Record<string, unknown> & {
  id: string
  profile: Record<string, unknown> | null
}

type Group = Record<string, unknown> & { id: string }

const HERO_SUGGESTIONS = [
  'my elbow has been swollen for 3 days',
  'dull headache every afternoon - what could cause it?',
  'is it normal to feel dizzy after standing up?',
  'what do people do about ADHD medication wearing off early?',
  'chest tightness when anxious - when should I worry?',
]

export default function AskHubPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const { push: toast } = useToast()

  const [questions, setQuestions] = useState<AskQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState(params.get('q') ?? '')
  const [details, setDetails] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [scope, setScope] = useState<'public' | 'group'>('public')
  const [groupId, setGroupId] = useState<string>('')
  const [groups, setGroups] = useState<Group[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [showComposer, setShowComposer] = useState(Boolean(params.get('q')))

  const loadQuestions = useCallback(async (isActive: () => boolean = () => true) => {
    try {
      const data = await DatabaseService.getAskQuestions({ limit: 30 })
      if (isActive()) setQuestions(data as AskQuestion[])
    } catch (error) {
      if (isActive() && !isTransientFetchError(error)) console.error('Failed to load ask feed:', error)
    } finally {
      if (isActive()) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void loadQuestions(() => active)
    return () => {
      active = false
    }
  }, [loadQuestions])

  useEffect(() => {
    if (!user) return
    DatabaseService.getUserGroupMemberships(user.userId)
      .then((memberships) => {
        setGroups(
          (memberships as Array<Record<string, unknown> & { group?: Record<string, unknown> | null }>)
            .map((membership) => membership.group)
            .filter(Boolean) as Group[],
        )
      })
      .catch(() => undefined)
  }, [user])

  const topTags = useMemo(() => {
    const counts = new Map<string, number>()
    questions.forEach((question) => {
      const tags = (question.tags as string[] | undefined) ?? []
      tags.forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1))
    })
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, count]) => ({ name, count }))
  }, [questions])

  const filtered = useMemo(() => {
    return questions.filter((question) => {
      if (tag) {
        const tags = (question.tags as string[] | undefined) ?? []
        if (!tags.includes(tag)) return false
      }
      if (search.trim()) {
        const needle = search.trim().toLowerCase()
        const haystack = `${question.question ?? ''} ${question.body ?? ''}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })
  }, [questions, search, tag])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!user) {
      router.push('/login')
      return
    }
    const trimmed = draft.trim()
    if (trimmed.length < 6) {
      toast('Give us a bit more to work with - at least a sentence.', 'error')
      return
    }

    setSubmitting(true)
    try {
      const { id: questionId } = await DatabaseService.createAskQuestion(user.userId, {
        question: trimmed,
        body: details.trim(),
        scope,
        group_id: scope === 'group' ? groupId || null : null,
        is_anonymous: isAnonymous,
      })

      // Kick off the AI answer in the background - user navigates to the page immediately.
      void fetch('/api/ask/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId }),
      }).catch((error) => console.error('Ask answer request failed:', error))

      toast('Posted - we are finding an answer now', 'success')
      router.push(`/ask/${questionId}`)
    } catch (error) {
      console.error('Failed to post ask question:', error)
      toast('Could not post question', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageFrame>
      <div className="page-grid">
        <Card className="overflow-hidden !p-0">
          <div className="bg-gradient-to-br from-brand-accent2/15 via-brand-accent3/10 to-transparent p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-background/45">
              Ask
            </p>
            <h1 className="mt-2 text-3xl font-bold text-brand-background md:text-4xl">
              Ask without the scary scroll
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-background/65 md:text-base">
              Describe what is going on. KinSpace&apos;s AI reads real medical sources and
              community threads, then answers you honestly - without telling you that you are
              dying. Other members with similar experiences will see it too.
            </p>

            {!showComposer ? (
              <button
                type="button"
                onClick={() => setShowComposer(true)}
                className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-brand-background/15 bg-brand-background/[0.04] px-4 py-3.5 text-left text-sm text-brand-background/60 transition-colors hover:border-brand-accent2/40 hover:bg-brand-background/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 md:max-w-2xl"
              >
                <i className="ri-search-line text-xl text-brand-accent2" aria-hidden="true" />
                <span className="flex-1">
                  Describe a symptom, ask a question, or paste what your doctor said…
                </span>
                <span className="hidden shrink-0 rounded-full bg-brand-background px-3 py-1.5 text-xs font-semibold text-brand-primary sm:inline">
                  Ask
                </span>
              </button>
            ) : (
              <form onSubmit={handleSubmit} className="mt-5 space-y-3 md:max-w-2xl">
                <div className="rounded-2xl border border-brand-accent2/30 bg-brand-background/[0.04] transition-colors focus-within:border-brand-accent2/60 focus-within:ring-2 focus-within:ring-brand-accent2/15">
                  <label htmlFor="ask-question" className="sr-only">
                    Your question
                  </label>
                  <textarea
                    id="ask-question"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Describe a symptom or ask a question…"
                    rows={2}
                    className="w-full resize-none rounded-2xl bg-transparent px-4 py-3 text-brand-background placeholder:text-brand-background/35 focus:outline-none"
                    autoFocus
                    maxLength={1000}
                  />
                  <div className="border-t border-brand-background/10 px-3 py-2">
                    <label htmlFor="ask-details" className="sr-only">
                      Optional details
                    </label>
                    <input
                      id="ask-details"
                      value={details}
                      onChange={(event) => setDetails(event.target.value)}
                      placeholder="Optional: any details you want the AI and community to know"
                      className="w-full bg-transparent text-sm text-brand-background/80 placeholder:text-brand-background/35 focus:outline-none"
                      maxLength={600}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex gap-1 rounded-full bg-brand-background/[0.08] p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setScope('public')}
                      className={cn(
                        'rounded-full px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                        scope === 'public'
                          ? 'bg-brand-background text-brand-primary'
                          : 'text-brand-background/60 hover:text-brand-background/80',
                      )}
                    >
                      🌍 Whole community
                    </button>
                    <button
                      type="button"
                      onClick={() => setScope('group')}
                      disabled={groups.length === 0}
                      className={cn(
                        'rounded-full px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                        scope === 'group'
                          ? 'bg-brand-background text-brand-primary'
                          : 'text-brand-background/60 hover:text-brand-background/80',
                        groups.length === 0 && 'opacity-40',
                      )}
                    >
                      👥 One of my groups
                    </button>
                  </div>
                  {scope === 'group' && groups.length > 0 && (
                    <select
                      value={groupId}
                      onChange={(event) => setGroupId(event.target.value)}
                      aria-label="Pick a group"
                      className="input-field !py-1.5 text-sm"
                    >
                      <option value="">Pick a group…</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name as string}
                        </option>
                      ))}
                    </select>
                  )}
                  <label className="flex items-center gap-2 text-xs text-brand-background/65">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(event) => setIsAnonymous(event.target.checked)}
                      className="h-4 w-4 accent-brand-accent2"
                    />
                    Ask anonymously
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" isLoading={submitting} disabled={submitting}>
                    {submitting ? 'Asking…' : 'Ask KinSpace'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowComposer(false)
                      setDraft('')
                      setDetails('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>

                <p className="text-[10px] text-brand-background/40">
                  Peer-support AI + community · not medical advice · sources always linked
                </p>
              </form>
            )}

            {!showComposer && (
              <div className="mt-5 flex flex-wrap gap-2">
                {HERO_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setDraft(suggestion)
                      setShowComposer(true)
                    }}
                    className="rounded-full border border-brand-background/12 bg-brand-background/5 px-3 py-1.5 text-xs text-brand-background/70 transition-colors hover:border-brand-accent2/40 hover:text-brand-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="section-title !mb-1">Recent questions</h2>
              <p className="text-xs text-brand-background/50">
                Searchable so you can see what others have asked before posting.
              </p>
            </div>
            <div className="flex-1 md:max-w-xs">
              <div className="relative">
                <i
                  className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-brand-background/40"
                  aria-hidden="true"
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search past questions"
                  aria-label="Search past questions"
                  className="!py-2 !pl-10"
                />
              </div>
            </div>
          </div>

          {topTags.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setTag(null)}
                className={cn(
                  'whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                  tag === null
                    ? 'bg-brand-background text-brand-primary'
                    : 'bg-brand-background/[0.08] text-brand-background/60 hover:text-brand-background/80',
                )}
              >
                All
              </button>
              {topTags.map(({ name, count }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setTag(tag === name ? null : name)}
                  className={cn(
                    'whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                    tag === name
                      ? 'bg-brand-accent2 text-brand-primary'
                      : 'bg-brand-background/[0.08] text-brand-background/60 hover:text-brand-background/80',
                  )}
                >
                  #{name}
                  <span className="ml-1.5 opacity-70">{count}</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index}>
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<i className="ri-question-answer-line text-4xl" aria-hidden="true" />}
            image="/images/app/empty-ask.webp"
            imageAlt="A person raising a hand to ask a question"
            title={questions.length === 0 ? 'No questions yet' : 'Nothing matches that filter'}
            description={
              questions.length === 0
                ? 'Be the first to ask - someone here has probably been through it too.'
                : 'Try a different search term or clear the tags to see everything.'
            }
            action={
              questions.length === 0 ? (
                <Button onClick={() => setShowComposer(true)}>Ask the first question</Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('')
                    setTag(null)
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((question) => {
              const author = question.is_anonymous
                ? 'Anonymous'
                : ((question.profile?.full_name as string | undefined) ||
                    (question.profile?.username as string | undefined) ||
                    'KinSpace member')
              const hasAiAnswer = Boolean(question.ai_answer)
              const status = question.status as string | undefined
              return (
                <Link
                  key={question.id}
                  href={`/ask/${question.id}`}
                  className="block rounded-2xl border border-brand-background/10 bg-brand-primary/50 p-5 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-brand-accent2/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-accent2/15 text-sm font-bold text-brand-accent2">
                      {question.is_anonymous ? (
                        <i className="ri-spy-line" aria-hidden="true" />
                      ) : (
                        <ProfileAvatar
                          alt={author}
                          avatarUrl={question.profile?.avatar_url as string | undefined}
                          className="h-10 w-10 rounded-2xl object-cover"
                          fullName={question.profile?.full_name as string | undefined}
                          userId={question.profile?.id as string | undefined}
                          username={question.profile?.username as string | undefined}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-brand-background/50">
                        <span className="font-semibold text-brand-background/75">{author}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatRelativeTime(question.created_at)}</span>
                        {hasAiAnswer ? (
                          <Badge className="bg-brand-accent3/18 text-[10px] text-brand-accent3">
                            ✨ AI answered
                          </Badge>
                        ) : status === 'pending-answer' ? (
                          <Badge className="bg-brand-accent2/15 text-[10px] text-brand-accent2">
                            Looking for answers…
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-brand-background">
                        {question.question as string}
                      </p>
                      {(question.body as string | undefined) && (
                        <p className="mt-1 line-clamp-2 text-sm text-brand-background/55">
                          {question.body as string}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-brand-background/45">
                        {Array.isArray(question.tags) && (question.tags as string[]).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {(question.tags as string[]).slice(0, 4).map((item) => (
                              <span
                                key={item}
                                className="rounded-full bg-brand-background/[0.08] px-2 py-0.5"
                              >
                                #{item}
                              </span>
                            ))}
                          </div>
                        )}
                        <span className="ml-auto flex items-center gap-1">
                          <i className="ri-chat-1-line" aria-hidden="true" />
                          {formatCompactNumber((question.answers_count as number | undefined) ?? 0)} replies
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {!authLoading && !user && (
          <Card variant="light" className="text-center">
            <p className="text-sm text-brand-background/60">
              <Link href="/login" className="font-medium text-brand-accent2 underline">
                Sign in
              </Link>{' '}
              to ask a question.
            </p>
          </Card>
        )}
      </div>

      <BottomNav />
    </PageFrame>
  )
}
