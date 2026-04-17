'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { formatRelativeTime } from '@/lib/platform'

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
      <div className="page-grid">
        <section className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
            Research
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Evidence stream</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#eedfc8]/60">
            AI-summarised health discoveries from NIH, WHO, PubMed, CDC, and more. Every article links back
            to the original source. Written in accessible language — never medical advice.
          </p>

          {featured && !loading && (
            <Link
              href={`/research/${featured.id}`}
              className="mt-6 block rounded-[1.75rem] border border-[#6B8A83]/20 bg-gradient-to-br from-[#6B8A83]/20 to-[#2A4A42] p-6 transition-colors hover:border-[#D19A58]/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge bg-[#6B8A83]/18 text-[#6B8A83]">Featured research</span>
                {Boolean(featured.ai_generated) && (
                  <span className="badge bg-[#D19A58]/15 text-[#D19A58]">✨ AI summary</span>
                )}
                {(featured.source as string | undefined) && (
                  <span className="text-xs text-[#eedfc8]/45">{featured.source as string}</span>
                )}
              </div>
              <h2 className="mt-4 text-2xl font-bold text-[#eedfc8]">{featured.title as string}</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#eedfc8]/70">
                {(featured.plain_language_summary as string | undefined) ||
                  (featured.excerpt as string | undefined) ||
                  'A published research update.'}
              </p>
              <p className="mt-4 text-xs font-semibold text-[#D19A58]">Read full article →</p>
            </Link>
          )}

          <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
            {topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => setActiveTopic(topic.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all ${
                  activeTopic === topic.id
                    ? 'bg-[#eedfc8] text-[#2A4A42]'
                    : 'bg-[#eedfc8]/8 text-[#eedfc8]/65'
                }`}
              >
                {topic.label}
                <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px]">
                  {topic.count}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="page-grid lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            {loading ? (
              <div className="page-card-grid">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-56 skeleton rounded-3xl" />
                ))}
              </div>
            ) : filteredItems.length > 0 ? (
              <div className="page-card-grid">
                {filteredItems.map((item) => (
                  <article key={item.id} className="card">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge bg-[#6B8A83]/16 text-[#6B8A83]">
                        {(item.topic as string | undefined) ||
                          (item.subject as string | undefined) ||
                          'Research'}
                      </span>
                      {Boolean(item.ai_generated) && (
                        <span className="badge bg-[#D19A58]/15 text-[#D19A58]">✨ AI</span>
                      )}
                      <span className="ml-auto text-xs text-[#eedfc8]/45">
                        {formatRelativeTime(item.published_at || item.created_at)}
                      </span>
                    </div>

                    <h2 className="mt-4 text-lg font-semibold text-[#eedfc8]">
                      {item.title as string}
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-[#eedfc8]/70">
                      {(item.plain_language_summary as string | undefined) ||
                        (item.excerpt as string | undefined) ||
                        'A published research note.'}
                    </p>

                    {Array.isArray(item.key_findings) && item.key_findings.length > 0 && (
                      <ul className="mt-4 space-y-2">
                        {(item.key_findings as string[]).slice(0, 3).map((finding) => (
                          <li
                            key={finding}
                            className="flex items-start gap-2 text-sm text-[#eedfc8]/65"
                          >
                            <i className="ri-check-line mt-0.5 text-[#6B8A83]" />
                            <span>{finding}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-5 flex items-center justify-between text-xs text-[#eedfc8]/45">
                      {(item.source as string | undefined) && <span>{item.source as string}</span>}
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Link
                        href={`/research/${item.id}`}
                        className="btn-primary flex-1 !py-2.5 text-center text-sm"
                      >
                        Read summary
                      </Link>
                      {(item.url as string | undefined) && (
                        <a
                          href={item.url as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary flex-1 !py-2.5 text-center text-sm"
                        >
                          Original source ↗
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="card-light text-center">
                <i className="ri-flask-line text-4xl text-[#eedfc8]/25" />
                <p className="mt-3 text-sm text-[#eedfc8]/60">
                  No research entries yet. The AI pipeline runs every 6 hours once the key is set.
                </p>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <section className="card">
              <h2 className="section-title">Request an article</h2>
              <p className="text-sm text-[#eedfc8]/60">
                Is there a condition or study you want us to cover? Send it over — our AI team reviews
                requests and prioritises high-demand topics.
              </p>
              <form onSubmit={handleRequest} className="mt-4 space-y-2">
                <textarea
                  value={requestText}
                  onChange={(event) => setRequestText(event.target.value)}
                  placeholder="e.g., recent studies on vagus nerve stimulation and depression"
                  className="input-field h-24 resize-none"
                  disabled={requestStatus === 'sending'}
                />
                <button
                  type="submit"
                  disabled={!user || requestStatus === 'sending' || !requestText.trim()}
                  className="btn-primary w-full !py-2.5 text-sm disabled:opacity-50"
                >
                  {!user
                    ? 'Sign in to request'
                    : requestStatus === 'sending'
                      ? 'Researching — takes ~30s…'
                      : requestStatus === 'sent'
                        ? 'Sent ✓'
                        : requestStatus === 'error'
                          ? 'Try again'
                          : 'Research this'}
                </button>
                {requestStatus === 'sending' && (
                  <p className="text-xs text-[#eedfc8]/50">
                    Pulling sources, summarising, and saving to the library. Stay on this page —
                    we&apos;ll jump you to the article.
                  </p>
                )}
                {requestStatus === 'error' && (
                  <p className="text-xs text-[#B85C3A]">
                    We could not build an article for that topic. Try rephrasing or narrowing it.
                  </p>
                )}
              </form>
            </section>

            <section className="card">
              <h2 className="section-title">How this feed works</h2>
              <ul className="space-y-2 text-sm text-[#eedfc8]/65">
                <li>Fresh studies pulled from NIH, WHO, PubMed, CDC, ScienceDaily.</li>
                <li>AI rewrites each one in plain language with explicit caveats.</li>
                <li>Every article links back to the source. Nothing is invented.</li>
                <li>This feed is not medical advice.</li>
              </ul>
            </section>
          </aside>
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
