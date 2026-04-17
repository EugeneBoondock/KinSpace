'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import ProfileAvatar from '@/components/ProfileAvatar'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { formatRelativeTime } from '@/lib/platform'
import { renderMarkdown } from '@/lib/markdown'

type ResearchItem = Record<string, unknown> & { id: string }
type Contribution = Record<string, unknown> & { id: string; profile: Record<string, unknown> | null }
type ContributionKind = 'experience' | 'source' | 'note'

export default function ResearchArticlePage() {
  const params = useParams<{ id: string }>()
  const articleId = params?.id as string | undefined
  const { user } = useAuth()
  const { push: toast } = useToast()

  const [article, setArticle] = useState<ResearchItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [contributionKind, setContributionKind] = useState<ContributionKind>('experience')
  const [contributionText, setContributionText] = useState('')
  const [contributionUrl, setContributionUrl] = useState('')
  const [contributionAnonymous, setContributionAnonymous] = useState(false)
  const [posting, setPosting] = useState(false)

  const load = useCallback(async () => {
    if (!articleId) return
    try {
      const { doc, getDoc } = await import('firebase/firestore')
      const { db } = await import('@/lib/firebase')
      const snap = await getDoc(doc(db, 'resources', articleId))
      if (!snap.exists()) {
        setNotFound(true)
        return
      }
      setArticle({ id: snap.id, ...snap.data() })

      const list = (await DatabaseService.getResourceContributions(articleId, 60)) as Contribution[]
      setContributions(list)
    } catch (error) {
      console.error('Failed to load article:', error)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [articleId])

  useEffect(() => {
    void load()
  }, [load])

  async function submitContribution(event: React.FormEvent) {
    event.preventDefault()
    if (!user || !articleId || !contributionText.trim()) return
    if (contributionKind === 'source' && !contributionUrl.trim()) {
      toast('Paste a URL for the source', 'error')
      return
    }
    setPosting(true)
    try {
      await DatabaseService.addResourceContribution(articleId, user.userId, {
        kind: contributionKind,
        content: contributionText.trim(),
        url: contributionKind === 'source' ? contributionUrl.trim() : null,
        is_anonymous: contributionAnonymous,
      })
      setContributionText('')
      setContributionUrl('')
      setContributionAnonymous(false)
      toast('Thanks for contributing', 'success')
      await load()
    } catch (error) {
      console.error('Failed to add contribution:', error)
      toast('Could not save contribution', 'error')
    } finally {
      setPosting(false)
    }
  }

  async function handleUpvote(contributionId: string) {
    if (!user) return
    try {
      await DatabaseService.upvoteContribution(user.userId, contributionId)
      await load()
    } catch (error) {
      console.error('Failed to upvote:', error)
    }
  }

  if (loading) {
    return (
      <PageFrame>
        <div className="space-y-4">
          <div className="h-10 skeleton rounded-2xl" />
          <div className="h-72 skeleton rounded-3xl" />
          <div className="h-96 skeleton rounded-3xl" />
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  if (notFound || !article) {
    return (
      <PageFrame>
        <div className="card-light text-center">
          <i className="ri-file-list-3-line text-4xl text-[#eedfc8]/30" />
          <p className="mt-3 text-sm text-[#eedfc8]/60">Article not found.</p>
          <Link href="/research" className="btn-primary mt-4 inline-block !py-2.5 !px-4 text-sm">
            Back to research feed
          </Link>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  const bodyMarkdown =
    (article.body_markdown as string | undefined) || (article.excerpt as string | undefined) || ''
  const body = renderMarkdown(bodyMarkdown)

  const grouped = {
    experience: contributions.filter((entry) => entry.kind === 'experience'),
    source: contributions.filter((entry) => entry.kind === 'source'),
    note: contributions.filter((entry) => entry.kind === 'note'),
  }

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <Link href="/research" className="text-sm text-[#D19A58]">
            ← Back to research
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="badge bg-[#6B8A83]/16 text-[#6B8A83]">
              {(article.topic as string | undefined) ||
                (article.category as string | undefined) ||
                'Research'}
            </span>
            {Boolean(article.ai_generated) && (
              <span className="badge bg-[#D19A58]/15 text-[#D19A58]">✨ AI summary</span>
            )}
            {(article.source as string | undefined) && (
              <span className="text-xs text-[#eedfc8]/45">{article.source as string}</span>
            )}
            <span className="ml-auto text-xs text-[#eedfc8]/45">
              {formatRelativeTime(article.published_at || article.created_at)}
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-bold text-[#eedfc8] break-words">
            {article.title as string}
          </h1>
          {(article.plain_language_summary as string | undefined) && (
            <p className="mt-3 text-base leading-relaxed text-[#eedfc8]/75">
              {article.plain_language_summary as string}
            </p>
          )}
        </section>

        <section className="page-grid lg:grid-cols-[minmax(0,1fr)_22rem]">
          <article className="card min-w-0">
            <div className="min-w-0 break-words" dangerouslySetInnerHTML={{ __html: body }} />
          </article>

          <aside className="space-y-4">
            {Array.isArray(article.key_findings) && (article.key_findings as string[]).length > 0 && (
              <section className="card">
                <h2 className="section-title">Key findings</h2>
                <ul className="space-y-2 text-sm text-[#eedfc8]/70">
                  {(article.key_findings as string[]).map((finding) => (
                    <li key={finding} className="flex items-start gap-2">
                      <i className="ri-check-line mt-0.5 text-[#6B8A83]" />
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {Array.isArray(article.caveats) && (article.caveats as string[]).length > 0 && (
              <section className="card">
                <h2 className="section-title">Caveats</h2>
                <ul className="space-y-2 text-sm text-[#eedfc8]/65">
                  {(article.caveats as string[]).map((caveat) => (
                    <li key={caveat} className="flex items-start gap-2">
                      <i className="ri-information-line mt-0.5 text-[#D19A58]" />
                      <span>{caveat}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(article.url as string | undefined) && (
              <section className="card">
                <h2 className="section-title">Original source</h2>
                <a
                  href={article.url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary block w-full !py-2.5 text-center text-sm"
                >
                  Read on {(article.source as string | undefined) || 'source'} ↗
                </a>
              </section>
            )}

            {Array.isArray(article.tags) && (article.tags as string[]).length > 0 && (
              <section className="card">
                <h2 className="section-title">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {(article.tags as string[]).map((tag) => (
                    <span key={tag} className="badge bg-[#eedfc8]/10 text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </section>

        {/* Crowd-sourced contributions */}
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="section-title !mb-1">Community contributions</h2>
              <p className="text-sm text-[#eedfc8]/55">
                Share what worked for you, add a primary source, or flag something the AI missed.
              </p>
            </div>
            <span className="badge bg-[#D19A58]/15 text-[#D19A58]">
              {contributions.length} contribution{contributions.length === 1 ? '' : 's'}
            </span>
          </div>

          {user ? (
            <form onSubmit={submitContribution} className="mt-5 space-y-3 rounded-2xl bg-[#eedfc8]/5 p-4">
              <div className="flex flex-wrap gap-1.5">
                {(['experience', 'source', 'note'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setContributionKind(kind)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      contributionKind === kind
                        ? 'bg-[#D19A58] text-[#2A4A42]'
                        : 'bg-[#eedfc8]/10 text-[#eedfc8]/65 hover:bg-[#eedfc8]/18'
                    }`}
                  >
                    {kind === 'experience'
                      ? '💬 My experience'
                      : kind === 'source'
                        ? '📚 Add a source'
                        : '📝 Note / correction'}
                  </button>
                ))}
              </div>

              <textarea
                value={contributionText}
                onChange={(event) => setContributionText(event.target.value)}
                placeholder={
                  contributionKind === 'experience'
                    ? 'Share what you tried, what helped, what did not.'
                    : contributionKind === 'source'
                      ? 'Describe what this source adds in a sentence or two.'
                      : 'Add context or flag something to correct.'
                }
                rows={3}
                className="input-field resize-none"
                maxLength={2000}
              />

              {contributionKind === 'source' && (
                <input
                  type="url"
                  value={contributionUrl}
                  onChange={(event) => setContributionUrl(event.target.value)}
                  placeholder="https://..."
                  className="input-field"
                  maxLength={500}
                />
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-[#eedfc8]/55">
                  <input
                    type="checkbox"
                    checked={contributionAnonymous}
                    onChange={(event) => setContributionAnonymous(event.target.checked)}
                  />
                  Share anonymously
                </label>
                <button
                  type="submit"
                  disabled={posting || !contributionText.trim()}
                  className="btn-primary !py-2 !px-4 text-sm disabled:opacity-50"
                >
                  {posting ? 'Posting…' : 'Add contribution'}
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-4 text-sm text-[#eedfc8]/55">
              <Link href="/login" className="text-[#D19A58] underline">
                Sign in
              </Link>{' '}
              to share your experience or a source.
            </p>
          )}

          <div className="mt-6 space-y-6">
            {(['experience', 'source', 'note'] as const).map((kind) => {
              const items = grouped[kind]
              if (items.length === 0) return null
              return (
                <div key={kind}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/45">
                    {kind === 'experience'
                      ? 'Member experiences'
                      : kind === 'source'
                        ? 'Community sources'
                        : 'Notes & corrections'}
                  </p>
                  <div className="mt-3 space-y-3">
                    {items.map((contribution) => {
                      const authorProfile = contribution.profile
                      const authorName = contribution.is_anonymous
                        ? 'Anonymous'
                        : ((authorProfile?.full_name as string | undefined) ||
                            (authorProfile?.username as string | undefined) ||
                            'Community member')
                      return (
                        <article key={contribution.id} className="rounded-2xl bg-[#eedfc8]/5 p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#6B8A83]/20 text-xs font-bold text-[#6B8A83]">
                              {contribution.is_anonymous ? (
                                <i className="ri-spy-line" />
                              ) : (
                                <ProfileAvatar
                                  alt={authorName}
                                  avatarUrl={authorProfile?.avatar_url as string | undefined}
                                  className="h-9 w-9 rounded-full object-cover"
                                  fullName={authorProfile?.full_name as string | undefined}
                                  userId={authorProfile?.id as string | undefined}
                                  username={authorProfile?.username as string | undefined}
                                />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-[#eedfc8]/50">
                                <span className="font-semibold text-[#eedfc8]/80">{authorName}</span>
                                <span>·</span>
                                <span>{formatRelativeTime(contribution.created_at)}</span>
                              </div>
                              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#eedfc8]/80">
                                {contribution.content as string}
                              </p>
                              {(contribution.url as string | undefined) && (
                                <a
                                  href={contribution.url as string}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-2 inline-flex items-center gap-1 text-xs text-[#D19A58] hover:underline"
                                >
                                  <i className="ri-external-link-line" />
                                  Open source
                                </a>
                              )}
                              <button
                                onClick={() => handleUpvote(contribution.id)}
                                disabled={!user}
                                className="mt-2 flex items-center gap-1 text-xs text-[#eedfc8]/55 transition-colors hover:text-[#D19A58] disabled:opacity-50"
                              >
                                <i className="ri-thumb-up-line" />
                                {((contribution.upvotes as number | undefined) ?? 0)} helpful
                              </button>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            {contributions.length === 0 && (
              <p className="text-sm text-[#eedfc8]/50">
                No contributions yet — be the first to add your experience.
              </p>
            )}
          </div>
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
