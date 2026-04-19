'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
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
  research: 'Research',
}

const typeOptions = ['article', 'guide', 'tool', 'video', 'podcast']

export default function ResourcesPage() {
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const [resources, setResources] = useState<Resource[]>([])
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitTitle, setSubmitTitle] = useState('')
  const [submitExcerpt, setSubmitExcerpt] = useState('')
  const [submitUrl, setSubmitUrl] = useState('')
  const [submitSource, setSubmitSource] = useState('')
  const [submitCategory, setSubmitCategory] = useState('article')
  const [submitType, setSubmitType] = useState('guide')
  const [submitTags, setSubmitTags] = useState('')
  const [submitStatus, setSubmitStatus] = useState<string | null>(null)

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

  useEffect(() => {
    void loadResources()
  }, [])

  useEffect(() => {
    if (searchParams.get('submit') === '1') {
      setShowSubmitModal(true)
    }
  }, [searchParams])

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

  async function handleSubmitResource() {
    if (!user || !submitTitle.trim() || !submitExcerpt.trim()) return

    setSubmitting(true)
    setSubmitStatus(null)

    try {
      await DatabaseService.createResource(user.userId, {
        title: submitTitle.trim(),
        excerpt: submitExcerpt.trim(),
        url: submitUrl.trim() || null,
        source: submitSource.trim() || null,
        category: submitCategory,
        type: submitType,
        tags: submitTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      })

      await loadResources()
      setShowSubmitModal(false)
      setSubmitTitle('')
      setSubmitExcerpt('')
      setSubmitUrl('')
      setSubmitSource('')
      setSubmitCategory('article')
      setSubmitType('guide')
      setSubmitTags('')
      setActiveCategory('all')
      setSubmitStatus('Your resource was added to the live library.')
    } catch (error) {
      console.error('Failed to submit resource:', error)
      setSubmitStatus('We could not publish that resource yet. Please try again.')
    } finally {
      setSubmitting(false)
    }
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
      <div className="page-grid overflow-x-clip">
        <section className="card overflow-hidden">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
                Resources
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Published support material</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#eedfc8]/60">
                This screen is driven by the live resources collection, and members can now add to it directly.
              </p>
            </div>
            {authLoading ? null : user ? (
              <button onClick={() => setShowSubmitModal(true)} className="btn-primary !px-4 !py-2.5 text-sm">
                <i className="ri-add-line mr-1.5" />
                Add resource
              </button>
            ) : (
              <Link href="/login" className="btn-secondary !px-4 !py-2.5 text-sm">
                Sign in to contribute
              </Link>
            )}
          </div>

          {submitStatus && (
            <p className="mt-4 rounded-2xl border border-[#6B8A83]/20 bg-[#6B8A83]/10 px-4 py-3 text-sm text-[#eedfc8]/80">
              {submitStatus}
            </p>
          )}

          {featuredResource && !loading && (
            <div className="mt-6 rounded-[1.75rem] border border-[#D19A58]/20 bg-gradient-to-br from-[#B85C3A]/20 to-[#D19A58]/10 p-6">
              <div className="flex flex-wrap items-center gap-2">
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
                  className="btn-primary mt-5 inline-flex !px-4 !py-2.5 text-sm"
                >
                  Open resource
                </a>
              )}
            </div>
          )}

          <div className="mt-6 flex max-w-full gap-2 overflow-x-auto pb-1">
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
                  <article key={resource.id} className="card overflow-hidden">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="badge">
                            {categoryLabels[(resource.category as string) || 'article'] || 'Resource'}
                          </span>
                          {(resource.type as string | undefined) && (
                            <span className="badge bg-[#6B8A83]/16 text-[#6B8A83]">
                              {resource.type as string}
                            </span>
                          )}
                          {Boolean(resource.ai_generated) && (
                            <span className="badge bg-[#D19A58]/15 text-[#D19A58]">✨ AI</span>
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

                    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[#eedfc8]/45">
                      <span>{formatRelativeTime(resource.published_at || resource.created_at)}</span>
                      {(resource.source as string | undefined) && (
                        <span className="max-w-[11rem] truncate text-right">{resource.source as string}</span>
                      )}
                    </div>

                    <div className="mt-5 flex gap-2">
                      {Boolean(resource.ai_generated) && (
                        <Link
                          href={`/research/${resource.id}`}
                          className="btn-primary flex-1 py-2.5 text-center text-sm"
                        >
                          Read summary
                        </Link>
                      )}
                      {(resource.url as string | undefined) ? (
                        <a
                          href={resource.url as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${Boolean(resource.ai_generated) ? 'btn-secondary' : 'btn-primary'} flex-1 py-2.5 text-center text-sm`}
                        >
                          {Boolean(resource.ai_generated) ? 'Source ↗' : 'Open'}
                        </a>
                      ) : (
                        !resource.ai_generated && (
                          <span className="btn-secondary flex-1 py-2.5 text-center text-sm">
                            Link unavailable
                          </span>
                        )
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

      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 md:p-6">
          <button
            aria-label="Close submit resource modal"
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowSubmitModal(false)}
          />
          <div className="relative w-full max-w-2xl rounded-t-[2rem] border border-[#eedfc8]/10 bg-brand-primary p-6 md:rounded-[2rem]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#eedfc8]">Add a community resource</h2>
                <p className="mt-1 text-sm text-[#eedfc8]/50">
                  Publish a guide, article, tool, or reference directly into the live resource library.
                </p>
              </div>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eedfc8]/8 text-[#eedfc8]/60"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#eedfc8]/40">
                  Title
                </label>
                <input
                  value={submitTitle}
                  onChange={(event) => setSubmitTitle(event.target.value)}
                  className="input-field"
                  placeholder="Name the resource"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#eedfc8]/40">
                  Summary
                </label>
                <textarea
                  value={submitExcerpt}
                  onChange={(event) => setSubmitExcerpt(event.target.value)}
                  className="input-field resize-none"
                  rows={4}
                  placeholder="Why is this useful for the community?"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#eedfc8]/40">
                  Category
                </label>
                <select
                  value={submitCategory}
                  onChange={(event) => setSubmitCategory(event.target.value)}
                  className="input-field"
                >
                  {Object.entries(categoryLabels)
                    .filter(([value]) => value !== 'all')
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#eedfc8]/40">
                  Format
                </label>
                <select
                  value={submitType}
                  onChange={(event) => setSubmitType(event.target.value)}
                  className="input-field"
                >
                  {typeOptions.map((option) => (
                    <option key={option} value={option}>
                      {categoryLabels[option] || option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#eedfc8]/40">
                  Link
                </label>
                <input
                  value={submitUrl}
                  onChange={(event) => setSubmitUrl(event.target.value)}
                  className="input-field"
                  placeholder="https://example.com/resource"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#eedfc8]/40">
                  Source
                </label>
                <input
                  value={submitSource}
                  onChange={(event) => setSubmitSource(event.target.value)}
                  className="input-field"
                  placeholder="Journal, clinic, creator, or publication"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[#eedfc8]/40">
                  Tags
                </label>
                <input
                  value={submitTags}
                  onChange={(event) => setSubmitTags(event.target.value)}
                  className="input-field"
                  placeholder="anxiety, grief, caregiver"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => setShowSubmitModal(false)} className="btn-secondary flex-1 py-3 text-sm">
                Cancel
              </button>
              <button
                onClick={handleSubmitResource}
                disabled={submitting || !submitTitle.trim() || !submitExcerpt.trim() || !user}
                className="btn-primary flex-1 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Publishing...' : 'Publish resource'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </PageFrame>
  )
}
