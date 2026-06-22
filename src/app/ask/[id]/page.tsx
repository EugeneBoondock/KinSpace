'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import ProfileAvatar from '@/components/ProfileAvatar'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { renderMarkdown } from '@/lib/markdown'
import { formatRelativeTime } from '@/lib/platform'
import { Badge, Button, Card, EmptyState, LinkButton, Skeleton, Textarea } from '@/components/ui'

type AskQuestion = Record<string, unknown> & {
  id: string
  profile: Record<string, unknown> | null
}

type AskAnswer = Record<string, unknown> & {
  id: string
  profile: Record<string, unknown> | null
}

export default function AskQuestionPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id as string | undefined
  const router = useRouter()
  const { user } = useAuth()
  const { push: toast } = useToast()

  const [question, setQuestion] = useState<AskQuestion | null>(null)
  const [answers, setAnswers] = useState<AskAnswer[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [reply, setReply] = useState('')
  const [postingReply, setPostingReply] = useState(false)
  const [replyAnonymously, setReplyAnonymously] = useState(false)

  const reload = useCallback(async () => {
    if (!id) return
    try {
      const [doc, answerList] = await Promise.all([
        DatabaseService.getAskQuestion(id),
        DatabaseService.getAskAnswers(id, 40),
      ])
      if (!doc) {
        setNotFound(true)
        return
      }
      setQuestion(doc as AskQuestion)
      setAnswers(answerList as AskAnswer[])
    } catch (error) {
      console.error('Failed to load ask question:', error)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void reload()
  }, [reload])

  // If the question is still pending an AI answer when we open it, poll once or twice.
  useEffect(() => {
    if (!question || question.ai_answer) return
    if ((question.status as string | undefined) !== 'pending-answer') return
    const timer = setTimeout(() => {
      void reload()
    }, 4000)
    return () => clearTimeout(timer)
  }, [question, reload])

  async function triggerAiAnswer() {
    if (!question) return
    setAiBusy(true)
    try {
      const response = await fetch('/api/ask/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? 'AI answer failed')
      }
      toast('Answer refreshed', 'success')
      await reload()
    } catch (error) {
      console.error('AI answer request failed:', error)
      toast('Could not generate an answer right now', 'error')
    } finally {
      setAiBusy(false)
    }
  }

  async function submitReply(event: React.FormEvent) {
    event.preventDefault()
    if (!user || !question || !reply.trim()) return
    setPostingReply(true)
    try {
      await DatabaseService.addAskAnswer(question.id, user.userId, reply.trim(), replyAnonymously)
      toast('Reply posted', 'success')
      setReply('')
      setReplyAnonymously(false)
      await reload()
    } catch (error) {
      console.error('Failed to post reply:', error)
      toast('Could not post reply', 'error')
    } finally {
      setPostingReply(false)
    }
  }

  async function handleUpvote(answerId: string) {
    if (!user) {
      router.push('/login')
      return
    }
    await DatabaseService.upvoteAskAnswer(user.userId, answerId)
    await reload()
  }

  if (loading) {
    return (
      <PageFrame>
        <div className="space-y-4" aria-busy="true">
          <Card className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </Card>
          <Card className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </Card>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  if (notFound || !question) {
    return (
      <PageFrame>
        <EmptyState
          icon={<i className="ri-question-line text-4xl" aria-hidden="true" />}
          title="We couldn't find that question"
          description="It may have been removed, or the link might be off. Head back to browse what others are asking."
          action={<LinkButton href="/ask">Back to Ask</LinkButton>}
        />
        <BottomNav />
      </PageFrame>
    )
  }

  const author = question.is_anonymous
    ? 'Anonymous'
    : ((question.profile?.full_name as string | undefined) ||
        (question.profile?.username as string | undefined) ||
        'KinSpace member')

  const isOwner = user && (question.user_id as string) === user.userId
  const aiAnswerHtml = question.ai_answer ? renderMarkdown(question.ai_answer as string) : null
  const relatedQuestions =
    (question.ai_related_questions as Array<{ id: string; question: string }> | undefined) ?? []
  const redditThreads =
    (question.ai_reddit_threads as Array<{ title: string; url: string; subreddit: string; snippet: string }> | undefined) ?? []
  const sources =
    (question.ai_sources as
      | Array<{ index: number; title: string; url: string; domain: string; kind?: string }>
      | undefined) ?? []

  return (
    <PageFrame>
      <div className="page-grid">
        <Card>
          <Link
            href="/ask"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-accent2 transition-colors hover:text-brand-accent2/80"
          >
            <i className="ri-arrow-left-line" aria-hidden="true" /> All questions
          </Link>
          <div className="mt-3 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-accent2/15 text-sm font-bold text-brand-accent2">
              {question.is_anonymous ? (
                <i className="ri-spy-line text-base" aria-hidden="true" />
              ) : (
                <ProfileAvatar
                  alt={author}
                  avatarUrl={question.profile?.avatar_url as string | undefined}
                  className="h-11 w-11 rounded-2xl object-cover"
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
                <Badge className="text-[10px]">
                  {(question.scope as string) === 'group' ? 'Group question' : 'Public question'}
                </Badge>
              </div>
              <h1 className="mt-2 text-2xl font-bold text-brand-background">
                {question.question as string}
              </h1>
              {(question.body as string | undefined) && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-brand-background/70">
                  {question.body as string}
                </p>
              )}
              {Array.isArray(question.tags) && (question.tags as string[]).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(question.tags as string[]).map((item) => (
                    <Link
                      key={item}
                      href={`/ask?tag=${encodeURIComponent(item)}`}
                      className="rounded-full bg-brand-background/[0.08] px-2.5 py-1 text-xs text-brand-background/65 transition-colors hover:bg-brand-background/[0.14]"
                    >
                      #{item}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="page-grid lg:grid-cols-[minmax(0,1.2fr)_22rem] lg:items-start">
          <div className="space-y-4">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="section-title !mb-0">✨ AI synthesis</h2>
                {(isOwner || !question.ai_answer) && (
                  <button
                    type="button"
                    onClick={triggerAiAnswer}
                    disabled={aiBusy}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-accent2 transition-colors hover:text-brand-accent2/80 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 rounded-md px-1"
                  >
                    {aiBusy && <i className="ri-loader-4-line animate-spin" aria-hidden="true" />}
                    {aiBusy
                      ? 'Thinking…'
                      : question.ai_answer
                        ? 'Re-ask AI'
                        : 'Ask AI now'}
                  </button>
                )}
              </div>

              {(question.ai_plain_summary as string | undefined) && (
                <p className="mt-3 rounded-2xl bg-brand-accent3/10 px-4 py-3 text-sm leading-relaxed text-brand-background/85">
                  {question.ai_plain_summary as string}
                </p>
              )}

              {Array.isArray(question.ai_red_flags) && (question.ai_red_flags as string[]).length > 0 && (
                <div className="mt-4 rounded-2xl border border-brand-accent1/30 bg-brand-accent1/10 p-4 text-sm">
                  <p className="font-semibold text-brand-accent1">Red flags - seek care if any apply</p>
                  <ul className="mt-2 space-y-1 text-brand-background/75">
                    {(question.ai_red_flags as string[]).map((flag) => (
                      <li key={flag} className="flex items-start gap-2">
                        <i className="ri-alarm-warning-line mt-0.5 text-brand-accent1" aria-hidden="true" />
                        <span>{flag}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {aiAnswerHtml ? (
                <div className="mt-4" dangerouslySetInnerHTML={{ __html: aiAnswerHtml }} />
              ) : (
                <p className="mt-4 text-sm text-brand-background/55">
                  The AI is still reading sources - refresh in a moment, or tap &quot;Ask AI now&quot; to try again.
                </p>
              )}

              {Array.isArray(question.ai_self_care) && (question.ai_self_care as string[]).length > 0 && (
                <div className="mt-4 rounded-2xl bg-brand-accent3/12 p-4">
                  <p className="text-sm font-semibold text-brand-accent3">Reasonable self-care</p>
                  <ul className="mt-2 space-y-1 text-sm text-brand-background/75">
                    {(question.ai_self_care as string[]).map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <i className="ri-leaf-line mt-0.5 text-brand-accent3" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {Array.isArray(question.ai_see_professional) && (question.ai_see_professional as string[]).length > 0 && (
                <div className="mt-4 rounded-2xl bg-brand-accent2/12 p-4">
                  <p className="text-sm font-semibold text-brand-accent2">When to see a professional</p>
                  <ul className="mt-2 space-y-1 text-sm text-brand-background/75">
                    {(question.ai_see_professional as string[]).map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <i className="ri-stethoscope-line mt-0.5 text-brand-accent2" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-5 text-[10px] text-brand-background/40">
                This is peer-support AI, not medical advice. Always talk with your care team.
              </p>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="section-title !mb-0">Community replies</h2>
                <span className="text-xs text-brand-background/45">{answers.length}</span>
              </div>

              <div className="mt-4 space-y-3">
                {answers.length === 0 ? (
                  <p className="text-sm text-brand-background/55">
                    No one has replied yet. Be the first voice.
                  </p>
                ) : (
                  answers.map((answer) => {
                    const replyAuthor = answer.is_anonymous
                      ? 'Anonymous'
                      : ((answer.profile?.full_name as string | undefined) ||
                          (answer.profile?.username as string | undefined) ||
                          'KinSpace member')
                    return (
                      <article key={answer.id} className="rounded-2xl bg-brand-background/5 p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-accent3/25 text-xs font-bold text-brand-accent3">
                            {answer.is_anonymous ? (
                              <i className="ri-spy-line text-sm" aria-hidden="true" />
                            ) : (
                              <ProfileAvatar
                                alt={replyAuthor}
                                avatarUrl={answer.profile?.avatar_url as string | undefined}
                                className="h-8 w-8 rounded-full object-cover"
                                fullName={answer.profile?.full_name as string | undefined}
                                userId={answer.profile?.id as string | undefined}
                                username={answer.profile?.username as string | undefined}
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-brand-background/50">
                              <span className="font-semibold text-brand-background/75">{replyAuthor}</span>
                              <span aria-hidden="true">·</span>
                              <span>{formatRelativeTime(answer.created_at)}</span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-brand-background/80">
                              {answer.content as string}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleUpvote(answer.id)}
                              className="mt-2 inline-flex items-center gap-1 rounded-md px-1 text-xs text-brand-background/55 transition-colors hover:text-brand-accent2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                            >
                              <i className="ri-thumb-up-line" aria-hidden="true" />
                              {((answer.upvotes as number | undefined) ?? 0)} helpful
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })
                )}
              </div>

              {user && (
                <form onSubmit={submitReply} className="mt-5 space-y-2">
                  <label htmlFor="ask-reply" className="sr-only">
                    Your reply
                  </label>
                  <Textarea
                    id="ask-reply"
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Share what helped you, or offer an honest perspective…"
                    rows={3}
                    className="resize-none"
                    maxLength={2000}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-brand-background/60">
                      <input
                        type="checkbox"
                        checked={replyAnonymously}
                        onChange={(event) => setReplyAnonymously(event.target.checked)}
                        className="h-4 w-4 accent-brand-accent2"
                      />
                      Reply anonymously
                    </label>
                    <Button
                      type="submit"
                      size="sm"
                      isLoading={postingReply}
                      disabled={!reply.trim() || postingReply}
                    >
                      {postingReply ? 'Posting…' : 'Post reply'}
                    </Button>
                  </div>
                </form>
              )}
              {!user && (
                <p className="mt-4 text-sm text-brand-background/55">
                  <Link href="/login" className="font-medium text-brand-accent2 underline">
                    Sign in
                  </Link>{' '}
                  to reply.
                </p>
              )}
            </Card>
          </div>

          <aside className="space-y-4">
            {relatedQuestions.length > 0 && (
              <Card>
                <h2 className="section-title">Similar questions</h2>
                <ul className="space-y-2 text-sm">
                  {relatedQuestions.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/ask/${item.id}`}
                        className="block rounded-2xl bg-brand-background/5 p-3 text-brand-background/75 transition-colors hover:bg-brand-background/10"
                      >
                        {item.question}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {redditThreads.length > 0 && (
              <Card>
                <h2 className="section-title">From Reddit threads</h2>
                <ul className="space-y-3 text-sm">
                  {redditThreads.map((thread) => (
                    <li key={thread.url} className="rounded-2xl bg-brand-background/5 p-3">
                      <p className="text-xs font-semibold text-brand-accent2">r/{thread.subreddit}</p>
                      <a
                        href={thread.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block font-medium text-brand-background transition-colors hover:text-brand-accent2"
                      >
                        {thread.title}
                      </a>
                      {thread.snippet && (
                        <p className="mt-1 line-clamp-3 text-xs text-brand-background/55">
                          {thread.snippet}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {sources.length > 0 && (
              <Card>
                <h2 className="section-title">Sources the AI used</h2>
                <ol className="space-y-2 text-sm">
                  {sources.map((source) => (
                    <li key={source.index}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 text-brand-background/75 transition-colors hover:text-brand-accent2"
                      >
                        <span className="text-xs font-bold text-brand-accent2">[{source.index}]</span>
                        <span className="flex-1">
                          <span className="block">{source.title}</span>
                          <span className="text-xs text-brand-background/45">
                            {source.domain}
                            {source.kind && source.kind !== 'web' && (
                              <span
                                className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                  source.kind === 'journal'
                                    ? 'bg-brand-accent3/20 text-brand-accent3'
                                    : source.kind === 'trial'
                                      ? 'bg-brand-accent2/20 text-brand-accent2'
                                      : 'bg-brand-accent1/20 text-brand-accent1'
                                }`}
                              >
                                {source.kind === 'journal'
                                  ? 'Peer-reviewed'
                                  : source.kind === 'trial'
                                    ? 'Clinical trial'
                                    : 'Preprint'}
                              </span>
                            )}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ol>
              </Card>
            )}

            <Card variant="light">
              <p className="flex items-center gap-2 text-sm font-semibold text-brand-background">
                <i className="ri-lifebuoy-line text-brand-accent2" aria-hidden="true" /> If this is urgent…
              </p>
              <p className="mt-2 text-xs text-brand-background/60">
                Ask is peer support. If you&apos;re in danger, call emergency services right now. In South
                Africa: <span className="font-semibold text-brand-background">10111</span> (police) or{' '}
                <span className="font-semibold text-brand-background">112</span> (from a cell). For emotional
                crisis: SADAG <span className="font-semibold text-brand-background">0800 567 567</span> (24h) or
                SMS <span className="font-semibold text-brand-background">31393</span>; Suicide line{' '}
                <span className="font-semibold text-brand-background">0800 12 13 14</span>. Outside SA:{' '}
                <a
                  href="https://findahelpline.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand-accent2 underline"
                >
                  findahelpline.com
                </a>
                .
              </p>
            </Card>
          </aside>
        </div>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
