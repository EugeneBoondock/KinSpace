'use client'

import { useEffect, useMemo, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { DatabaseService } from '@/lib/database'
import { formatRelativeTime } from '@/lib/platform'

type ResearchItem = Record<string, unknown> & { id: string }

export default function ResearchPage() {
  const [loading, setLoading] = useState(true)
  const [researchItems, setResearchItems] = useState<ResearchItem[]>([])
  const [activeTopic, setActiveTopic] = useState('all')

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
            This page no longer invents papers. It only shows resource entries that have actually been tagged as research.
          </p>

          {featured && !loading && (
            <div className="mt-6 rounded-[1.75rem] border border-[#6B8A83]/20 bg-gradient-to-br from-[#6B8A83]/20 to-[#2A4A42] p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge bg-[#6B8A83]/18 text-[#6B8A83]">Featured research</span>
                {(featured.source as string | undefined) && (
                  <span className="text-xs text-[#eedfc8]/45">{featured.source as string}</span>
                )}
              </div>
              <h2 className="mt-4 text-2xl font-bold text-[#eedfc8]">{featured.title as string}</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#eedfc8]/70">
                {(featured.excerpt as string | undefined) || 'A published research update.'}
              </p>
              {(featured.url as string | undefined) && (
                <a
                  href={featured.url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary mt-5 inline-flex !py-2.5 !px-4 text-sm"
                >
                  Read source
                </a>
              )}
            </div>
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

        <section className="page-grid">
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
                  <div className="flex items-center justify-between gap-3">
                    <span className="badge bg-[#6B8A83]/16 text-[#6B8A83]">
                      {(item.topic as string | undefined) || (item.subject as string | undefined) || 'Research'}
                    </span>
                    <span className="text-xs text-[#eedfc8]/45">
                      {formatRelativeTime(item.published_at || item.created_at)}
                    </span>
                  </div>

                  <h2 className="mt-4 text-lg font-semibold text-[#eedfc8]">{item.title as string}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-[#eedfc8]/70">
                    {(item.excerpt as string | undefined) || 'A published research note.'}
                  </p>

                  {Array.isArray(item.key_findings) && item.key_findings.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {(item.key_findings as string[]).slice(0, 3).map((finding) => (
                        <li key={finding} className="flex items-start gap-2 text-sm text-[#eedfc8]/65">
                          <i className="ri-check-line mt-0.5 text-[#6B8A83]" />
                          <span>{finding}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-5 flex items-center justify-between text-xs text-[#eedfc8]/45">
                    {(item.source as string | undefined) && <span>{item.source as string}</span>}
                    {(item.difficulty as string | undefined) && <span>{item.difficulty as string}</span>}
                  </div>

                  {(item.url as string | undefined) && (
                    <a
                      href={item.url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary mt-5 block w-full !py-2.5 text-center text-sm"
                    >
                      Read source
                    </a>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="card-light text-center">
              <i className="ri-flask-line text-4xl text-[#eedfc8]/25" />
              <p className="mt-3 text-sm text-[#eedfc8]/60">No research entries have been published yet.</p>
            </div>
          )}
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
