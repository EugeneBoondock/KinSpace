'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { formatRelativeTime } from '@/lib/platform'
import { Button, Card, Badge, Skeleton, EmptyState, Textarea, Alert } from '@/components/ui'
import { cn } from '@/lib/cn'

type ResearchItem = Record<string, unknown> & { id: string }

export default function ResearchPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [researchItems, setResearchItems] = useState<ResearchItem[]>([])
  const [activeTopic, setActiveTopic] = useState('all')
  const [requestText, setRequestText] = useState('')
  const [requestStatus, setRequestStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  useEffect(() => {
    async function loadResearch() {
      try {
        const resources = await DatabaseService.getResources()
        const research = (resources as ResearchItem[]).filter((resource) => {
          const category = String(resource.category || '').toLowerCase()
          const type = String(resource.type || '').toLowerCase()
          const tags = ((resource.tags as string[] | undefined) || []).map((tag) => tag.toLowerCase())
          return category === 'research' || type.includes('research') || tags.includes('research')
        })
        setResearchItems(research)
      } catch (error) {
        console.error('Failed to load research feed:', error)
      } finally {
        setLoading(false)
      }
    }
    loadResearch()
  }, [])

  async function handleRequest(event: React.FormEvent) {
    event.preventDefault()
    if (!user || !requestText.trim()) return
    setRequestStatus('sending')
    try {
      const response = await fetch('/api/research/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId, topic: requestText.trim() }),
      })
      const data = (await response.json().catch(() => null)) as
        | { ok: boolean; articleId?: string; error?: string }
        | null
      if (!response.ok || !data?.ok || !data.articleId) {
        throw new Error(data?.error ?? 'Request failed')
      }
      setRequestStatus('sent')
      setRequestText('')
      // Navigate directly to the fresh article
      window.location.href = `/research/${data.articleId}`
    } catch (error) {
      console.error('Failed to submit request:', error)
      setRequestStatus('error')
      setTimeout(() => setRequestStatus('idle'), 4000)
    }
  }

  const topics = useMemo(() => {
    const counts = researchItems.reduce<Record<string, number>>((accumulator, item) => {
      const topic = String(item.topic || item.subject || item.category || 'research')
      accumulator[topic] = (accumulator[topic] || 0) + 1
      return accumulator
    }, {})

    return [
      { id: 'all', label: 'All', count: researchItems.length },
      ...Object.entries(counts).map(([id, count]) => ({
        id,
        label: id.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
        count,
      })),
    ]
  }, [researchItems])

  const featured = researchItems.find((item) => item.featured === true) || researchItems[0]

  const filteredItems = useMemo(() => {
    if (activeTopic === 'all') return researchItems
    return researchItems.filter((item) => {
      const topic = String(item.topic || item.subject || item.category || '')
      return topic === activeTopic
    })
  }, [activeTopic, researchItems])

  return (
    <PageFrame>
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent2">
            Research
          </p>
          <h1 className="text-2xl font-bold text-brand-background sm:text-3xl">Evidence stream</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-brand-background/65">
            Plain-language summaries of health discoveries from NIH, WHO, PubMed, CDC, and more. Every
            article links back to the original source. This is information, not medical advice.
          </p>
        </header>

        {featured && !loading && (
          <Link
            href={`/research/${featured.id}`}
            className="group block rounded-2xl border border-brand-accent3/25 bg-gradient-to-br from-brand-accent3/20 to-brand-primary p-6 transition-all hover:-translate-y-0.5 hover:border-brand-accent2/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-primary"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-brand-accent3/20 text-brand-accent3">Featured research</Badge>
              {Boolean(featured.ai_generated) && (
                <Badge tone="accent">
                  <i className="ri-sparkling-line" aria-hidden="true" /> AI summary
                </Badge>
              )}
              {(featured.source as string | undefined) && (
                <span className="text-xs text-brand-background/50">{featured.source as string}</span>
              )}
            </div>
            <h2 className="mt-4 text-xl font-bold text-brand-background sm:text-2xl">
              {featured.title as string}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-background/70">
              {(featured.plain_language_summary as string | undefined) ||
                (featured.excerpt as string | undefined) ||
                'A published research update.'}
            </p>
            <p className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-accent2">
              Read full article
              <i className="ri-arrow-right-line transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </p>
          </Link>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter research by topic">
          {topics.map((topic) => {
            const selected = activeTopic === topic.id
            return (
              <button
                key={topic.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTopic(topic.id)}
                className={cn(
                  'flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/50',
                  selected
                    ? 'bg-brand-background text-brand-primary shadow-sm'
                    : 'bg-brand-background/[0.08] text-brand-background/70 hover:bg-brand-background/15',
                )}
              >
                {topic.label}
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    selected ? 'bg-brand-primary/10 text-brand-primary' : 'bg-brand-background/10',
                  )}
                >
                  {topic.count}
                </span>
              </button>
            )
          })}
        </div>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-56 rounded-2xl" />
                ))}
              </div>
            ) : filteredItems.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {filteredItems.map((item) => (
                  <Card key={item.id} className="flex flex-col">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-brand-accent3/16 text-brand-accent3">
                        {(item.topic as string | undefined) ||
                          (item.subject as string | undefined) ||
                          'Research'}
                      </Badge>
                      {Boolean(item.ai_generated) && (
                        <Badge tone="accent">
                          <i className="ri-sparkling-line" aria-hidden="true" /> AI
                        </Badge>
                      )}
                      <span className="ml-auto text-xs text-brand-background/45">
                        {formatRelativeTime(item.published_at || item.created_at)}
                      </span>
                    </div>

                    <h2 className="mt-4 text-lg font-semibold text-brand-background">
                      {item.title as string}
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-brand-background/70">
                      {(item.plain_language_summary as string | undefined) ||
                        (item.excerpt as string | undefined) ||
                        'A published research note.'}
                    </p>

                    {Array.isArray(item.key_findings) && item.key_findings.length > 0 && (
                      <ul className="mt-4 space-y-2">
                        {(item.key_findings as string[]).slice(0, 3).map((finding) => (
                          <li
                            key={finding}
                            className="flex items-start gap-2 text-sm text-brand-background/65"
                          >
                            <i className="ri-check-line mt-0.5 text-brand-accent3" aria-hidden="true" />
                            <span>{finding}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {(item.source as string | undefined) && (
                      <div className="mt-5 text-xs text-brand-background/45">
                        <span>{item.source as string}</span>
                      </div>
                    )}

                    <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row">
                      <Link href={`/research/${item.id}`} className="flex-1">
                        <Button fullWidth>Read summary</Button>
                      </Link>
                      {(item.url as string | undefined) && (
                        <a
                          href={item.url as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1"
                        >
                          <Button variant="secondary" fullWidth>
                            Original source
                            <i className="ri-external-link-line" aria-hidden="true" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<i className="ri-flask-line text-4xl" aria-hidden="true" />}
                title="No research entries yet"
                description="New summaries arrive automatically as the AI pipeline runs. Check back soon, or request a topic you want covered."
              />
            )}
          </div>

          <aside className="space-y-4">
            <Card>
              <h2 className="text-base font-bold text-brand-background">Request an article</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-brand-background/65">
                Is there a condition or study you want us to cover? Send it over &mdash; we review
                requests and prioritise high-demand topics.
              </p>
              <form onSubmit={handleRequest} className="mt-4 space-y-3">
                <Textarea
                  value={requestText}
                  onChange={(event) => setRequestText(event.target.value)}
                  placeholder="e.g., recent studies on vagus nerve stimulation and depression"
                  className="h-24 resize-none"
                  aria-label="Topic to research"
                  disabled={requestStatus === 'sending'}
                />
                <Button
                  type="submit"
                  fullWidth
                  isLoading={requestStatus === 'sending'}
                  disabled={!user || requestStatus === 'sending' || !requestText.trim()}
                >
                  {!user
                    ? 'Sign in to request'
                    : requestStatus === 'sending'
                      ? 'Researching - takes ~30s…'
                      : requestStatus === 'sent'
                        ? 'Sent ✓'
                        : requestStatus === 'error'
                          ? 'Try again'
                          : 'Research this'}
                </Button>
                {requestStatus === 'sending' && (
                  <p className="text-xs leading-relaxed text-brand-background/55">
                    Pulling sources, summarising, and saving to the library. Stay on this page &mdash;
                    we&apos;ll jump you to the article.
                  </p>
                )}
                {requestStatus === 'error' && (
                  <Alert tone="error">
                    We could not build an article for that topic. Try rephrasing or narrowing it.
                  </Alert>
                )}
              </form>
            </Card>

            <Card variant="light">
              <h2 className="text-base font-bold text-brand-background">How this feed works</h2>
              <ul className="mt-3 space-y-2.5 text-sm text-brand-background/70">
                <li className="flex items-start gap-2">
                  <i className="ri-search-line mt-0.5 text-brand-accent3" aria-hidden="true" />
                  <span>Fresh studies pulled from NIH, WHO, PubMed, CDC, ScienceDaily.</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-quill-pen-line mt-0.5 text-brand-accent3" aria-hidden="true" />
                  <span>Rewritten in plain language with explicit caveats.</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-links-line mt-0.5 text-brand-accent3" aria-hidden="true" />
                  <span>Every article links back to the source. Nothing is invented.</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-heart-pulse-line mt-0.5 text-brand-accent2" aria-hidden="true" />
                  <span>This feed is not medical advice.</span>
                </li>
              </ul>
            </Card>
          </aside>
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
