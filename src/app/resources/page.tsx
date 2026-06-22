'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { formatRelativeTime } from '@/lib/platform'
import { isTransientFetchError } from '@/lib/client-errors'
import {
  Button,
  LinkButton,
  Card,
  Badge,
  Skeleton,
  EmptyState,
  Alert,
  Modal,
  Field,
  Input,
  Textarea,
} from '@/components/ui'
import { cn } from '@/lib/cn'

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

  async function loadResources(isActive: () => boolean = () => true) {
    try {
      const results = await DatabaseService.getResources()
      if (isActive()) setResources(results as Resource[])
    } catch (error) {
      if (isActive() && !isTransientFetchError(error)) console.error('Failed to load resources:', error)
    } finally {
      if (isActive()) setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    void loadResources(() => active)
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (searchParams.get('submit') === '1') {
      setShowSubmitModal(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      const stored = localStorage.getItem('kinspace-saved-resources')
      if (stored) setSavedIds(JSON.parse(stored) as string[])
      return
    }

    let active = true
    DatabaseService.getSavedResourceIds(user.userId)
      .then((ids: unknown) => {
        if (!active) return
        setSavedIds(Array.isArray(ids) ? ids.map(String) : [])
      })
      .catch((error: unknown) => {
        if (active && !isTransientFetchError(error)) console.error('Failed to load saved resources:', error)
      })

    return () => {
      active = false
    }
  }, [authLoading, user])

  async function toggleSave(resourceId: string) {
    if (!user) {
      setSavedIds((current) => {
        const next = current.includes(resourceId)
          ? current.filter((id) => id !== resourceId)
          : [...current, resourceId]

        localStorage.setItem('kinspace-saved-resources', JSON.stringify(next))
        return next
      })
      return
    }

    const wasSaved = savedIds.includes(resourceId)
    setSavedIds((current) =>
      wasSaved ? current.filter((id) => id !== resourceId) : Array.from(new Set([...current, resourceId])),
    )

    try {
      const result = await DatabaseService.toggleSavedResource(user.userId, resourceId) as { saved?: boolean }
      setSavedIds((current) =>
        result.saved
          ? Array.from(new Set([...current, resourceId]))
          : current.filter((id) => id !== resourceId),
      )
    } catch (error) {
      console.error('Failed to update saved resource:', error)
      setSavedIds((current) =>
        wasSaved ? Array.from(new Set([...current, resourceId])) : current.filter((id) => id !== resourceId),
      )
    }
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
      <div className="space-y-6 overflow-x-hidden">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent2">
              Resources
            </p>
            <h1 className="text-2xl font-bold text-brand-background sm:text-3xl">
              Support material, curated together
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-brand-background/65">
              Guides, articles, tools, and references shared by the community. Save what helps, and add
              your own to help the next person.
            </p>
          </div>
          {authLoading ? null : user ? (
            <Button
              onClick={() => setShowSubmitModal(true)}
              leadingIcon={<i className="ri-add-line" aria-hidden="true" />}
              className="shrink-0"
            >
              Add resource
            </Button>
          ) : (
            <LinkButton href="/login" variant="secondary" className="shrink-0">
              Sign in to contribute
            </LinkButton>
          )}
        </header>

        {submitStatus && <Alert tone="success">{submitStatus}</Alert>}

        {featuredResource && !loading && (
          <div className="rounded-2xl border border-brand-accent2/20 bg-gradient-to-br from-brand-accent1/20 to-brand-accent2/10 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-brand-accent2/16 text-brand-accent2">Featured</Badge>
              {(featuredResource.source as string | undefined) && (
                <span className="text-xs text-brand-background/50">
                  {featuredResource.source as string}
                </span>
              )}
            </div>
            <h2 className="mt-4 text-xl font-bold text-brand-background sm:text-2xl">
              {featuredResource.title as string}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-background/70">
              {(featuredResource.excerpt as string | undefined) ||
                'A featured resource from the live library.'}
            </p>
            {(featuredResource.url as string | undefined) && (
              <LinkButton
                href={featuredResource.url as string}
                external
                className="mt-5"
              >
                Open resource
                <i className="ri-external-link-line" aria-hidden="true" />
              </LinkButton>
            )}
          </div>
        )}

        <div
          className="flex max-w-full gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Filter resources by category"
        >
          {categories.map((category) => {
            const selected = activeCategory === category.id
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  'flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/50',
                  selected
                    ? 'bg-brand-background text-brand-primary shadow-sm'
                    : 'bg-brand-background/[0.08] text-brand-background/70 hover:bg-brand-background/15',
                )}
              >
                {category.label}
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    selected ? 'bg-brand-primary/10 text-brand-primary' : 'bg-brand-background/10',
                  )}
                >
                  {category.count}
                </span>
              </button>
            )
          })}
        </div>

        <section>
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-56 rounded-2xl" />
              ))}
            </div>
          ) : filteredResources.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filteredResources.map((resource) => {
                const isSaved = savedIds.includes(resource.id)

                return (
                  <Card key={resource.id} className="flex flex-col overflow-hidden">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>
                            {categoryLabels[(resource.category as string) || 'article'] || 'Resource'}
                          </Badge>
                          {(resource.type as string | undefined) && (
                            <Badge className="bg-brand-accent3/16 text-brand-accent3">
                              {resource.type as string}
                            </Badge>
                          )}
                          {Boolean(resource.ai_generated) && (
                            <Badge tone="accent">
                              <i className="ri-sparkling-line" aria-hidden="true" /> AI
                            </Badge>
                          )}
                        </div>
                        <h2 className="mt-4 text-lg font-semibold text-brand-background">
                          {resource.title as string}
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => void toggleSave(resource.id)}
                        aria-pressed={isSaved}
                        aria-label={isSaved ? 'Remove from saved' : 'Save resource'}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-background/[0.08] text-brand-background/60 transition-colors hover:bg-brand-background/15 hover:text-brand-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/50"
                      >
                        <i
                          className={isSaved ? 'ri-bookmark-fill text-brand-accent2' : 'ri-bookmark-line'}
                          aria-hidden="true"
                        />
                      </button>
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-brand-background/70">
                      {(resource.excerpt as string | undefined) || 'A published resource entry.'}
                    </p>

                    {Array.isArray(resource.tags) && resource.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(resource.tags as string[]).slice(0, 5).map((tag) => (
                          <Badge key={tag} className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-brand-background/45">
                      <span>{formatRelativeTime(resource.published_at || resource.created_at)}</span>
                      {(resource.source as string | undefined) && (
                        <span className="max-w-[11rem] truncate text-right">
                          {resource.source as string}
                        </span>
                      )}
                    </div>

                    <div className="mt-auto flex gap-2 pt-5">
                      {Boolean(resource.ai_generated) && (
                        <Link href={`/research/${resource.id}`} className="flex-1">
                          <Button fullWidth>Read summary</Button>
                        </Link>
                      )}
                      {(resource.url as string | undefined) ? (
                        <a
                          href={resource.url as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1"
                        >
                          <Button variant={Boolean(resource.ai_generated) ? 'secondary' : 'primary'} fullWidth>
                            {Boolean(resource.ai_generated) ? 'Source' : 'Open'}
                            <i className="ri-external-link-line" aria-hidden="true" />
                          </Button>
                        </a>
                      ) : (
                        !resource.ai_generated && (
                          <span className="flex h-11 flex-1 items-center justify-center rounded-full border border-brand-background/15 text-center text-sm text-brand-background/45">
                            Link unavailable
                          </span>
                        )
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon={<i className="ri-book-open-line text-4xl" aria-hidden="true" />}
              title="Nothing here yet"
              description="No resources have been published in this category yet. If you know something that helped you, be the first to add it."
              action={
                user ? (
                  <Button onClick={() => setShowSubmitModal(true)}>Add a resource</Button>
                ) : (
                  <LinkButton href="/login" variant="secondary">
                    Sign in to contribute
                  </LinkButton>
                )
              }
            />
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card variant="light" interactive className="p-0">
            <Link href="/research" className="block rounded-2xl p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/50">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-accent3/16 text-brand-accent3">
                <i className="ri-flask-line text-xl" aria-hidden="true" />
              </div>
              <h2 className="mt-4 font-semibold text-brand-background">Research stream</h2>
              <p className="mt-2 text-sm leading-relaxed text-brand-background/60">
                View resource entries tagged as research and evidence-based updates.
              </p>
            </Link>
          </Card>
          <Card variant="light" interactive className="p-0">
            <Link href="/map" className="block rounded-2xl p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/50">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-accent2/16 text-brand-accent2">
                <i className="ri-map-pin-line text-xl" aria-hidden="true" />
              </div>
              <h2 className="mt-4 font-semibold text-brand-background">Care directory</h2>
              <p className="mt-2 text-sm leading-relaxed text-brand-background/60">
                Jump to the live directory for doctors, pharmacies, and nearby help.
              </p>
            </Link>
          </Card>
        </section>
      </div>

      <Modal
        open={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Add a community resource"
        className="max-w-2xl"
      >
        <p className="-mt-2 mb-5 text-sm text-brand-background/60">
          Publish a guide, article, tool, or reference directly into the live resource library.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Title" htmlFor="resource-title" className="md:col-span-2">
            <Input
              id="resource-title"
              value={submitTitle}
              onChange={(event) => setSubmitTitle(event.target.value)}
              placeholder="Name the resource"
            />
          </Field>

          <Field label="Summary" htmlFor="resource-summary" className="md:col-span-2">
            <Textarea
              id="resource-summary"
              value={submitExcerpt}
              onChange={(event) => setSubmitExcerpt(event.target.value)}
              className="resize-none"
              rows={4}
              placeholder="Why is this useful for the community?"
            />
          </Field>

          <Field label="Category" htmlFor="resource-category">
            <select
              id="resource-category"
              value={submitCategory}
              onChange={(event) => setSubmitCategory(event.target.value)}
              className="h-11 w-full rounded-xl border border-brand-background/15 bg-brand-background/[0.08] px-4 text-sm text-brand-background transition-colors focus:border-brand-background/40 focus:outline-none focus:ring-2 focus:ring-brand-background/10"
            >
              {Object.entries(categoryLabels)
                .filter(([value]) => value !== 'all')
                .map(([value, label]) => (
                  <option key={value} value={value} className="bg-brand-primary">
                    {label}
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Format" htmlFor="resource-format">
            <select
              id="resource-format"
              value={submitType}
              onChange={(event) => setSubmitType(event.target.value)}
              className="h-11 w-full rounded-xl border border-brand-background/15 bg-brand-background/[0.08] px-4 text-sm text-brand-background transition-colors focus:border-brand-background/40 focus:outline-none focus:ring-2 focus:ring-brand-background/10"
            >
              {typeOptions.map((option) => (
                <option key={option} value={option} className="bg-brand-primary">
                  {categoryLabels[option] || option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Link" htmlFor="resource-link" className="md:col-span-2">
            <Input
              id="resource-link"
              value={submitUrl}
              onChange={(event) => setSubmitUrl(event.target.value)}
              placeholder="https://example.com/resource"
            />
          </Field>

          <Field label="Source" htmlFor="resource-source">
            <Input
              id="resource-source"
              value={submitSource}
              onChange={(event) => setSubmitSource(event.target.value)}
              placeholder="Journal, clinic, creator, or publication"
            />
          </Field>

          <Field label="Tags" htmlFor="resource-tags" hint="Separate with commas">
            <Input
              id="resource-tags"
              value={submitTags}
              onChange={(event) => setSubmitTags(event.target.value)}
              placeholder="anxiety, grief, caregiver"
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button variant="secondary" fullWidth onClick={() => setShowSubmitModal(false)}>
            Cancel
          </Button>
          <Button
            fullWidth
            onClick={handleSubmitResource}
            isLoading={submitting}
            disabled={submitting || !submitTitle.trim() || !submitExcerpt.trim() || !user}
          >
            {submitting ? 'Publishing...' : 'Publish resource'}
          </Button>
        </div>
      </Modal>

      <BottomNav />
    </PageFrame>
  )
}
