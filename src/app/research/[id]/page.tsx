'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
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
import { Button, LinkButton, Card, Badge, Skeleton, EmptyState, Textarea, Input } from '@/components/ui'
import { cn } from '@/lib/cn'

type ResearchItem = Record<string, unknown> & { id: string }
type Contribution = Record<string, unknown> & { id: string; profile: Record<string, unknown> | null }
type ContributionKind = 'experience' | 'source' | 'note'
type Source = { title?: string; url?: string; domain?: string }

/** A readable label for a source: title → domain → hostname → url. */
function sourceLabel(source: Source): string {
  if (source.title) return source.title
  if (source.domain) return source.domain
  if (source.url) {
    try {
      return new URL(source.url).hostname.replace(/^www\./, '')
    } catch {
      return source.url
    }
  }
  return 'Source'
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Turn [N] citation markers in rendered HTML into in-page links to the numbered
 * source list, with the source name as a hover tooltip. Markers without a
 * matching source are left as plain text.
 */
function addCitationLinksToHtml(html: string, sources: Source[]): string {
  if (!html) return html
  return html.replace(/\[(\d+)\]/g, (full, num: string) => {
    const n = Number(num)
    if (n < 1 || n > sources.length) return full
    const label = escapeAttr(sourceLabel(sources[n - 1]))
    return `<a href="#source-${n}" title="${label}" class="citation-ref" style="color:var(--color-brand-accent2);font-weight:600;text-decoration:none">[${n}]</a>`
  })
}

/** Same idea for plain-text fields rendered through React (summary, findings…). */
function linkifyCitations(text: string, sources: Source[]): ReactNode {
  if (!text) return text
  return text.split(/(\[\d+\])/g).map((part, index) => {
    const match = part.match(/^\[(\d+)\]$/)
    if (match) {
      const n = Number(match[1])
      if (n >= 1 && n <= sources.length) {
        return (
          <a
            key={index}
            href={`#source-${n}`}
            title={sourceLabel(sources[n - 1])}
            className="font-semibold text-brand-accent2 hover:underline"
          >
            [{n}]
          </a>
        )
      }
    }
    return <span key={index}>{part}</span>
  })
}

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
      const found = await DatabaseService.getResource(articleId)
      if (!found) {
        setNotFound(true)
        return
      }
      setArticle(found as Parameters<typeof setArticle>[0])

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
          <Skeleton className="h-10 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  if (notFound || !article) {
    return (
      <PageFrame>
        <EmptyState
          icon={<i className="ri-file-list-3-line text-4xl" aria-hidden="true" />}
          title="Article not found"
          description="This article may have been moved or removed. Head back to the research feed to keep exploring."
          action={<LinkButton href="/research">Back to research feed</LinkButton>}
        />
        <BottomNav />
      </PageFrame>
    )
  }

  const bodyMarkdown =
    (article.body_markdown as string | undefined) || (article.excerpt as string | undefined) || ''
  const sources = (Array.isArray(article.sources) ? article.sources : []) as Source[]
  const body = addCitationLinksToHtml(renderMarkdown(bodyMarkdown), sources)

  const grouped = {
    experience: contributions.filter((entry) => entry.kind === 'experience'),
    source: contributions.filter((entry) => entry.kind === 'source'),
    note: contributions.filter((entry) => entry.kind === 'note'),
  }

  const contributionKinds: { id: ContributionKind; icon: string; label: string }[] = [
    { id: 'experience', icon: 'ri-chat-heart-line', label: 'My experience' },
    { id: 'source', icon: 'ri-book-2-line', label: 'Add a source' },
    { id: 'note', icon: 'ri-edit-line', label: 'Note / correction' },
  ]

  return (
    <PageFrame>
      <div className="space-y-6">
        <Link
          href="/research"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-accent2 transition-colors hover:text-brand-accent2/80"
        >
          <i className="ri-arrow-left-line" aria-hidden="true" />
          Back to research
        </Link>

        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-brand-accent3/16 text-brand-accent3">
              {(article.topic as string | undefined) ||
                (article.category as string | undefined) ||
                'Research'}
            </Badge>
            {Boolean(article.ai_generated) && (
              <Badge tone="accent">
                <i className="ri-sparkling-line" aria-hidden="true" /> AI summary
              </Badge>
            )}
            {(article.source as string | undefined) && (
              <span className="text-xs text-brand-background/50">{article.source as string}</span>
            )}
            <span className="ml-auto text-xs text-brand-background/45">
              {formatRelativeTime(article.published_at || article.created_at)}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-brand-background break-words sm:text-3xl">
            {article.title as string}
          </h1>
          {(article.plain_language_summary as string | undefined) && (
            <p className="text-base leading-relaxed text-brand-background/75">
              {linkifyCitations(article.plain_language_summary as string, sources)}
            </p>
          )}
        </header>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="min-w-0">
            <div className="min-w-0 break-words" dangerouslySetInnerHTML={{ __html: body }} />
          </Card>

          <aside className="space-y-4">
            {sources.length > 0 && (
              <Card>
                <h2 className="text-base font-bold text-brand-background">Sources</h2>
                <p className="mt-1 text-xs text-brand-background/50">
                  Tap a [number] in the article to jump here.
                </p>
                <ol className="mt-3 space-y-2.5 text-sm">
                  {sources.map((source, index) => {
                    const n = index + 1
                    let host = source.domain || ''
                    if (source.url) {
                      try {
                        host = new URL(source.url).hostname.replace(/^www\./, '')
                      } catch {
                        host = source.domain || ''
                      }
                    }
                    return (
                      <li key={n} id={`source-${n}`} className="flex gap-2.5 scroll-mt-24">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-accent2/15 text-[11px] font-bold text-brand-accent2">
                          {n}
                        </span>
                        {source.url ? (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group min-w-0 flex-1"
                          >
                            <span className="block break-words font-medium text-brand-background/85 group-hover:text-brand-accent2 group-hover:underline">
                              {sourceLabel(source)}
                            </span>
                            {host && (
                              <span className="mt-0.5 block truncate text-xs text-brand-background/45">
                                {host} <i className="ri-external-link-line" aria-hidden="true" />
                              </span>
                            )}
                          </a>
                        ) : (
                          <span className="min-w-0 flex-1 break-words text-brand-background/85">
                            {sourceLabel(source)}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </Card>
            )}

            {Array.isArray(article.key_findings) && (article.key_findings as string[]).length > 0 && (
              <Card>
                <h2 className="text-base font-bold text-brand-background">Key findings</h2>
                <ul className="mt-3 space-y-2.5 text-sm text-brand-background/75">
                  {(article.key_findings as string[]).map((finding) => (
                    <li key={finding} className="flex items-start gap-2">
                      <i className="ri-check-line mt-0.5 text-brand-accent3" aria-hidden="true" />
                      <span>{linkifyCitations(finding, sources)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {Array.isArray(article.caveats) && (article.caveats as string[]).length > 0 && (
              <Card>
                <h2 className="text-base font-bold text-brand-background">Caveats</h2>
                <ul className="mt-3 space-y-2.5 text-sm text-brand-background/70">
                  {(article.caveats as string[]).map((caveat) => (
                    <li key={caveat} className="flex items-start gap-2">
                      <i className="ri-information-line mt-0.5 text-brand-accent2" aria-hidden="true" />
                      <span>{linkifyCitations(caveat, sources)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {(article.url as string | undefined) && (
              <Card>
                <h2 className="text-base font-bold text-brand-background">Original source</h2>
                <LinkButton
                  href={article.url as string}
                  external
                  fullWidth
                  className="mt-3"
                >
                  Read on {(article.source as string | undefined) || 'source'}
                  <i className="ri-external-link-line" aria-hidden="true" />
                </LinkButton>
              </Card>
            )}

            {Array.isArray(article.tags) && (article.tags as string[]).length > 0 && (
              <Card>
                <h2 className="text-base font-bold text-brand-background">Tags</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(article.tags as string[]).map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              </Card>
            )}
          </aside>
        </section>

        {/* Crowd-sourced contributions */}
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-brand-background">Community contributions</h2>
              <p className="mt-1 text-sm leading-relaxed text-brand-background/60">
                Share what worked for you, add a primary source, or flag something the AI missed.
              </p>
            </div>
            <Badge tone="accent">
              {contributions.length} contribution{contributions.length === 1 ? '' : 's'}
            </Badge>
          </div>

          {user ? (
            <form
              onSubmit={submitContribution}
              className="mt-5 space-y-3 rounded-2xl bg-brand-background/5 p-4"
            >
              <div className="flex flex-wrap gap-1.5">
                {contributionKinds.map((kind) => {
                  const selected = contributionKind === kind.id
                  return (
                    <button
                      key={kind.id}
                      type="button"
                      onClick={() => setContributionKind(kind.id)}
                      aria-pressed={selected}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/50',
                        selected
                          ? 'bg-brand-accent2 text-brand-primary'
                          : 'bg-brand-background/10 text-brand-background/65 hover:bg-brand-background/[0.18]',
                      )}
                    >
                      <i className={kind.icon} aria-hidden="true" />
                      {kind.label}
                    </button>
                  )
                })}
              </div>

              <Textarea
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
                className="resize-none"
                aria-label="Your contribution"
                maxLength={2000}
              />

              {contributionKind === 'source' && (
                <Input
                  type="url"
                  value={contributionUrl}
                  onChange={(event) => setContributionUrl(event.target.value)}
                  placeholder="https://..."
                  aria-label="Source URL"
                  maxLength={500}
                />
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-brand-background/60">
                  <input
                    type="checkbox"
                    checked={contributionAnonymous}
                    onChange={(event) => setContributionAnonymous(event.target.checked)}
                    className="h-4 w-4 rounded border-brand-background/30 accent-brand-accent2"
                  />
                  Share anonymously
                </label>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={posting}
                  disabled={posting || !contributionText.trim()}
                >
                  {posting ? 'Posting…' : 'Add contribution'}
                </Button>
              </div>
            </form>
          ) : (
            <p className="mt-4 text-sm text-brand-background/60">
              <Link href="/login" className="font-medium text-brand-accent2 underline">
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
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-background/45">
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
                        <article key={contribution.id} className="rounded-2xl bg-brand-background/5 p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-accent3/20 text-xs font-bold text-brand-accent3">
                              {contribution.is_anonymous ? (
                                <i className="ri-spy-line" aria-hidden="true" />
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
                              <div className="flex flex-wrap items-center gap-2 text-xs text-brand-background/50">
                                <span className="font-semibold text-brand-background/80">{authorName}</span>
                                <span aria-hidden="true">·</span>
                                <span>{formatRelativeTime(contribution.created_at)}</span>
                              </div>
                              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-brand-background/80">
                                {contribution.content as string}
                              </p>
                              {(contribution.url as string | undefined) && (
                                <a
                                  href={contribution.url as string}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-accent2 hover:underline"
                                >
                                  <i className="ri-external-link-line" aria-hidden="true" />
                                  Open source
                                </a>
                              )}
                              <button
                                onClick={() => handleUpvote(contribution.id)}
                                disabled={!user}
                                className="mt-2 flex h-8 items-center gap-1 text-xs text-brand-background/55 transition-colors hover:text-brand-accent2 disabled:opacity-50"
                              >
                                <i className="ri-thumb-up-line" aria-hidden="true" />
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
              <p className="text-sm text-brand-background/55">
                No contributions yet &mdash; be the first to add your experience.
              </p>
            )}
          </div>
        </Card>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
