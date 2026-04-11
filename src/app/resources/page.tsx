'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { DatabaseService } from '@/lib/database'
import { formatRelativeTime } from '@/lib/platform'

type Resource = Record<string, unknown> & { id: string }

const categoryLabels: Record<string, string> = {
  all: 'All',
  article: 'Articles',
  guide: 'Guides',
  tool: 'Tools',
  video: 'Videos',
  podcast: 'Podcasts',
}

export default function ResourcesPage() {
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const [resources, setResources] = useState<Resource[]>([])
  const [savedIds, setSavedIds] = useState<string[]>([])

  useEffect(() => {
    async function loadResources() {
      try {
        const results = await DatabaseService.getResources()
        setResources(results as Resource[])
      } catch (error) {
        console.error('Failed to load resources:', error)
      } finally {
        setLoading(false)
      }
    }

    loadResources()
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('kinspace-saved-resources')
    if (stored) {
      setSavedIds(JSON.parse(stored) as string[])
    }
  }, [])

  function toggleSave(resourceId: string) {
    setSavedIds((current) => {
      const next = current.includes(resourceId)
        ? current.filter((id) => id !== resourceId)
        : [...current, resourceId]

      localStorage.setItem('kinspace-saved-resources', JSON.stringify(next))
      return next
    })
  }

  const categories = useMemo(() => {
    const counts = resources.reduce<Record<string, number>>((accumulator, resource) => {
      const key = (resource.category as string | undefined) || 'article'
      accumulator[key] = (accumulator[key] || 0) + 1
      return accumulator
    }, {})

    return [
      { id: 'all', label: 'All', count: resources.length },
      ...Object.entries(counts).map(([id, count]) => ({
        id,
        label: categoryLabels[id] || id,
        count,
      })),
    ]
  }, [resources])

  const featuredResource = useMemo(
    () => resources.find((resource) => resource.featured === true) || resources[0],
    [resources],
  )

  const filteredResources = useMemo(() => {
    if (activeCategory === 'all') return resources
    return resources.filter((resource) => resource.category === activeCategory)
  }, [activeCategory, resources])

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
            Resources
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Published support material</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#eedfc8]/60">
            This screen is now driven by the live resources collection. If something is missing, it is genuinely missing.
          </p>

          {featuredResource && !loading && (
            <div className="mt-6 rounded-[1.75rem] border border-[#D19A58]/20 bg-gradient-to-br from-[#B85C3A]/20 to-[#D19A58]/10 p-6">
              <div className="flex items-center gap-2">
                <span className="badge bg-[#D19A58]/16 text-[#D19A58]">Featured</span>
                {(featuredResource.source as string | undefined) && (
                  <span className="text-xs text-[#eedfc8]/45">{featuredResource.source as string}</span>
                )}
              </div>
              <h2 className="mt-4 text-2xl font-bold text-[#eedfc8]">
                {featuredResource.title as string}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#eedfc8]/70">
                {(featuredResource.excerpt as string | undefined) || 'A featured resource from the live library.'}
              </p>
              {(featuredResource.url as string | undefined) && (
                <a
                  href={featuredResource.url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary mt-5 inline-flex !py-2.5 !px-4 text-sm"
                >
                  Open resource
                </a>
              )}
            </div>
          )}

          <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all ${
                  activeCategory === category.id
                    ? 'bg-[#eedfc8] text-[#2A4A42]'
                    : 'bg-[#eedfc8]/8 text-[#eedfc8]/65'
                }`}
              >
                {category.label}
                <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px]">
                  {category.count}
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
          ) : filteredResources.length > 0 ? (
            <div className="page-card-grid">
              {filteredResources.map((resource) => {
                const isSaved = savedIds.includes(resource.id)

                return (
                  <article key={resource.id} className="card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="badge">{categoryLabels[(resource.category as string) || 'article'] || 'Resource'}</span>
                          {(resource.type as string | undefined) && (
                            <span className="badge bg-[#6B8A83]/16 text-[#6B8A83]">{resource.type as string}</span>
                          )}
                        </div>
                        <h2 className="mt-4 text-lg font-semibold text-[#eedfc8]">
                          {resource.title as string}
                        </h2>
                      </div>
                      <button
                        onClick={() => toggleSave(resource.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eedfc8]/8 text-[#eedfc8]/60"
                      >
                        <i className={isSaved ? 'ri-bookmark-fill text-[#D19A58]' : 'ri-bookmark-line'} />
                      </button>
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-[#eedfc8]/70">
                      {(resource.excerpt as string | undefined) || 'A published resource entry.'}
                    </p>

                    {Array.isArray(resource.tags) && resource.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(resource.tags as string[]).slice(0, 5).map((tag) => (
                          <span key={tag} className="badge text-[10px]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between text-xs text-[#eedfc8]/45">
                      <span>{formatRelativeTime(resource.published_at || resource.created_at)}</span>
                      {(resource.source as string | undefined) && <span>{resource.source as string}</span>}
                    </div>

                    <div className="mt-5 flex gap-2">
                      {(resource.url as string | undefined) ? (
                        <a
                          href={resource.url as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary flex-1 !py-2.5 text-center text-sm"
                        >
                          Open
                        </a>
                      ) : (
                        <span className="btn-secondary flex-1 !py-2.5 text-center text-sm">
                          Link unavailable
                        </span>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="card-light text-center">
              <i className="ri-book-open-line text-4xl text-[#eedfc8]/25" />
              <p className="mt-3 text-sm text-[#eedfc8]/60">No resources have been published in this category yet.</p>
            </div>
          )}
        </section>

        <section className="page-card-grid">
          <Link href="/research" className="card-light transition-colors hover:bg-[#eedfc8]/12">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6B8A83]/16 text-[#6B8A83]">
              <i className="ri-flask-line text-xl" />
            </div>
            <h2 className="mt-4 font-semibold text-[#eedfc8]">Research stream</h2>
            <p className="mt-2 text-sm text-[#eedfc8]/55">
              View resource entries tagged as research and evidence-based updates.
            </p>
          </Link>
          <Link href="/map" className="card-light transition-colors hover:bg-[#eedfc8]/12">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#D19A58]/16 text-[#D19A58]">
              <i className="ri-map-pin-line text-xl" />
            </div>
            <h2 className="mt-4 font-semibold text-[#eedfc8]">Care directory</h2>
            <p className="mt-2 text-sm text-[#eedfc8]/55">
              Jump to the live directory for doctors, pharmacies, and nearby help.
            </p>
          </Link>
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
