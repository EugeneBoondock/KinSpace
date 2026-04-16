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

type AskQuestion = Record<string, unknown> & {
  id: string
  profile: Record<string, unknown> | null
}

type Group = Record<string, unknown> & { id: string }

const HERO_SUGGESTIONS = [
  'my elbow has been swollen for 3 days',
  'dull headache every afternoon — what could cause it?',
  'is it normal to feel dizzy after standing up?',
  'what do people do about ADHD medication wearing off early?',
  'chest tightness when anxious — when should I worry?',
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

  const loadQuestions = useCallback(async () => {
    try {
      const data = await DatabaseService.getAskQuestions({ limit: 30 })
      setQuestions(data as AskQuestion[])
    } catch (error) {
      console.error('Failed to load ask feed:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadQuestions()
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
      toast('Give us a bit more to work with — at least a sentence.', 'error')
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

      // Kick off the AI answer in the background — user navigates to the page immediately.
      void fetch('/api/ask/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, userId: user.userId, question: trimmed }),
      }).catch((error) => console.error('Ask answer request failed:', error))

      toast('Posted — we are finding an answer now', 'success')
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
        <section className="card overflow-hidden !p-0">
          <div className="bg-gradient-to-br from-[#D19A58]/15 via-[#6B8A83]/10 to-transparent p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/45">
              Ask
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#eedfc8] md:text-4xl">
              Ask without the scary scroll
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#eedfc8]/65 md:text-base">
              Describe what is going on. KinSpace&apos;s AI reads real medical sources and
              community threads, then answers you honestly — without telling you that you are
              dying. Other members with similar experiences will see it too.
            </p>

            {!showComposer ? (
              <button
                onClick={() => setShowComposer(true)}
                className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-[#eedfc8]/12 bg-[#eedfc8]/4 px-4 py-3.5 text-left text-sm text-[#eedfc8]/60 transition-colors hover:border-[#D19A58]/40 hover:bg-[#eedfc8]/8 md:max-w-2xl"
              >
                <i className="ri-search-line text-xl text-[#D19A58]" />
                <span className="flex-1">
                  Describe a symptom, ask a question, or paste what your doctor said…
                </span>
                <span className="btn-primary !px-3 !py-1.5 text-xs">Ask</span>
              </button>
            ) : (
              <form onSubmit={handleSubmit} className="mt-5 space-y-3 md:max-w-2xl">
                <div className="rounded-2xl border border-[#D19A58]/30 bg-[#eedfc8]/4 focus-within:border-[#D19A58]/60">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Describe a symptom or ask a question…"
                    rows={2}
                    className="w-full resize-none rounded-2xl bg-transparent px-4 py-3 text-[#eedfc8] placeholder:text-[#eedfc8]/35 focus:outline-none"
                    autoFocus
                    maxLength={1000}
                  />
                  <div className="border-t border-[#eedfc8]/10 px-3 py-2">
                    <input
                      value={details}
                      onChange={(event) => setDetails(event.target.value)}
                      placeholder="Optional: any details you want the AI and community to know"
                      className="w-full bg-transparent text-sm text-[#eedfc8]/80 placeholder:text-[#eedfc8]/35 focus:outline-none"
                      maxLength={600}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex gap-1 rounded-full bg-[#eedfc8]/8 p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setScope('public')}
                      className={`rounded-full px-3 py-1.5 transition-colors ${
                        scope === 'public' ? 'bg-[#eedfc8] text-[#2A4A42]' : 'text-[#eedfc8]/60'
                      }`}
                    >
                      🌍 Whole community
                    </button>
                    <button
                      type="button"
                      onClick={() => setScope('group')}
                      disabled={groups.length === 0}
                      className={`rounded-full px-3 py-1.5 transition-colors ${
                        scope === 'group' ? 'bg-[#eedfc8] text-[#2A4A42]' : 'text-[#eedfc8]/60'
                      } ${groups.length === 0 ? 'opacity-40' : ''}`}
                    >
                      👥 One of my groups
                    </button>
                  </div>
                  {scope === 'group' && groups.length > 0 && (
                    <select
                      value={groupId}
                      onChange={(event) => setGroupId(event.target.value)}
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
                  <label className="flex items-center gap-2 text-xs text-[#eedfc8]/65">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(event) => setIsAnonymous(event.target.checked)}
                    />
                    Ask anonymously
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary !py-2.5 !px-4 text-sm disabled:opacity-50"
                  >
                    {submitting ? 'Asking…' : 'Ask KinSpace'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowComposer(false)
                      setDraft('')
                      setDetails('')
                    }}
                    className="btn-secondary !py-2.5 !px-4 text-sm"
                  >
                    Cancel
                  </button>
                </div>

                <p className="text-[10px] text-[#eedfc8]/40">
                  Peer-support AI + community · not medical advice · sources always linked
                </p>
              </form>
            )}

            {!showComposer && (
              <div className="mt-5 flex flex-wrap gap-2">
                {HERO_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setDraft(suggestion)
                      setShowComposer(true)
                    }}
                    className="rounded-full border border-[#eedfc8]/12 bg-[#eedfc8]/5 px-3 py-1.5 text-xs text-[#eedfc8]/70 transition-colors hover:border-[#D19A58]/40 hover:text-[#eedfc8]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="section-title !mb-1">Recent questions</h2>
              <p className="text-xs text-[#eedfc8]/50">
                Searchable so you can see what others have asked before posting.
              </p>
            </div>
            <div className="flex-1 md:max-w-xs">
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[#eedfc8]/40" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search past questions"
                  className="input-field !pl-10 !py-2"
                />
              </div>
            </div>
          </div>

          {topTags.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setTag(null)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-colors ${
                  tag === null ? 'bg-[#eedfc8] text-[#2A4A42]' : 'bg-[#eedfc8]/8 text-[#eedfc8]/60'
                }`}
              >
                All
              </button>
              {topTags.map(({ name, count }) => (
                <button
                  key={name}
                  onClick={() => setTag(tag === name ? null : name)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-colors ${
                    tag === name ? 'bg-[#D19A58] text-[#2A4A42]' : 'bg-[#eedfc8]/8 text-[#eedfc8]/60'
                  }`}
                >
                  #{name}
                  <span className="ml-1.5 opacity-70">{count}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-32 skeleton rounded-3xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-light text-center">
            <i className="ri-question-line text-4xl text-[#eedfc8]/25" />
            <p className="mt-3 text-sm text-[#eedfc8]/60">
              {questions.length === 0
                ? 'No one has asked anything yet. Be the first.'
                : 'No questions match that filter.'}
            </p>
          </div>
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
                  className="card block transition-colors hover:border-[#D19A58]/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#D19A58]/15 text-sm font-bold text-[#D19A58]">
                      {question.is_anonymous ? (
                        <i className="ri-spy-line" />
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
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#eedfc8]/50">
                        <span className="font-semibold text-[#eedfc8]/75">{author}</span>
                        <span>·</span>
                        <span>{formatRelativeTime(question.created_at)}</span>
                        {hasAiAnswer ? (
                          <span className="badge bg-[#6B8A83]/18 text-[10px] text-[#6B8A83]">
                            ✨ AI answered
                          </span>
                        ) : status === 'pending-answer' ? (
                          <span className="badge bg-[#D19A58]/15 text-[10px] text-[#D19A58]">
                            Looking for answers…
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[#eedfc8]">
                        {question.question as string}
                      </p>
                      {(question.body as string | undefined) && (
                        <p className="mt-1 line-clamp-2 text-sm text-[#eedfc8]/55">
                          {question.body as string}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#eedfc8]/45">
                        {Array.isArray(question.tags) && (question.tags as string[]).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {(question.tags as string[]).slice(0, 4).map((item) => (
                              <span key={item} className="rounded-full bg-[#eedfc8]/8 px-2 py-0.5">
                                #{item}
                              </span>
                            ))}
                          </div>
                        )}
                        <span className="ml-auto flex items-center gap-1">
                          <i className="ri-chat-1-line" />
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
          <div className="card-light text-center">
            <p className="text-sm text-[#eedfc8]/60">
              <Link href="/login" className="text-[#D19A58] underline">
                Sign in
              </Link>{' '}
              to ask a question.
            </p>
          </div>
        )}
      </div>

      <BottomNav />
    </PageFrame>
  )
}
