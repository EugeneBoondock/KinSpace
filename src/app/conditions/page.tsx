'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import ConditionExplorer from '@/components/ConditionExplorer'
import { DatabaseService } from '@/lib/database'
import { formatCompactNumber } from '@/lib/platform'
import {
  Badge,
  Card,
  EmptyState,
  Input,
  LinkButton,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui'

type Condition = Record<string, unknown> & { id: string }

const CATEGORY_TABS = [
  { id: 'all', label: 'All' },
  { id: 'mental', label: 'Mental health' },
  { id: 'chronic', label: 'Chronic' },
  { id: 'infectious', label: 'Infectious' },
  { id: 'cardiovascular', label: 'Heart & blood pressure' },
  { id: 'disability', label: 'Disabilities' },
  { id: 'autoimmune', label: 'Autoimmune' },
  { id: 'neurological', label: 'Neurological' },
  { id: 'respiratory', label: 'Respiratory' },
  { id: 'pain', label: 'Pain' },
  { id: 'musculoskeletal', label: 'Bones & joints' },
  { id: 'metabolic', label: 'Metabolic' },
  { id: 'blood', label: 'Blood' },
  { id: 'cancer', label: 'Cancer' },
  { id: 'sleep', label: 'Sleep' },
]

export default function ConditionsPage() {
  const [conditions, setConditions] = useState<Condition[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await DatabaseService.getConditions()
        setConditions(data as Condition[])
      } catch (error) {
        console.error('Failed to load conditions:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    return conditions
      .filter((condition) => {
        if (category === 'all') return true
        return String(condition.category) === category
      })
      .filter((condition) => {
        if (!search) return true
        const haystack = `${condition.name} ${
          Array.isArray(condition.aliases) ? (condition.aliases as string[]).join(' ') : ''
        } ${condition.summary ?? ''}`.toLowerCase()
        return haystack.includes(search.toLowerCase())
      })
  }, [conditions, category, search])

  return (
    <PageFrame containerClassName="max-w-5xl">
      <div className="space-y-8">
        <ConditionExplorer />

        <div className="space-y-2 border-t border-brand-line pt-8">
          <h2 className="text-xl font-bold text-brand-background sm:text-2xl">Browse the full directory</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-brand-background/65">
            Browse every condition, search or filter by category. Honest ratings and stories, a starting point
            for your own care conversations, not medical advice.
          </p>
        </div>

        <Card className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <i
                className="ri-search-line pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-background/40"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search conditions, e.g. migraine or fibromyalgia"
                aria-label="Search conditions"
                className="h-11 pl-11"
              />
            </div>
            <LinkButton href="/share-experience" leadingIcon={<i className="ri-add-line" aria-hidden="true" />}>
              Share your experience
            </LinkButton>
          </div>

          <Tabs value={category} onValueChange={setCategory}>
            <TabsList className="flex w-full gap-1 overflow-x-auto">
              {CATEGORY_TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="whitespace-nowrap">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </Card>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </Card>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((condition) => (
              <Link
                key={condition.id}
                href={`/conditions/${condition.id}`}
                className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
              >
                <Card interactive className="h-full">
                  <div className="flex items-start justify-between gap-3">
                    <Badge className="bg-brand-accent3/15 capitalize text-brand-accent3">
                      {(condition.category as string) || 'condition'}
                    </Badge>
                    <span className="rounded-full bg-brand-background/10 px-2.5 py-0.5 text-xs text-brand-background/60">
                      {formatCompactNumber((condition.member_count as number | undefined) ?? 0)} members
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-brand-background group-hover:text-brand-accent2">
                    {condition.name as string}
                  </h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-brand-background/65">
                    {(condition.summary as string | undefined) ?? ''}
                  </p>
                  {Array.isArray(condition.aliases) && (condition.aliases as string[]).length > 0 && (
                    <p className="mt-3 text-xs text-brand-background/45">
                      Also known as: {(condition.aliases as string[]).slice(0, 3).join(', ')}
                    </p>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<i className="ri-pulse-line text-4xl" aria-hidden="true" />}
            title={search || category !== 'all' ? 'No conditions match your search' : 'No conditions yet'}
            description={
              search || category !== 'all'
                ? 'Try a different word or clear the filters to see everything.'
                : 'Once the directory is seeded, conditions will appear here for the community to explore.'
            }
            action={
              search || category !== 'all' ? (
                <LinkButton href="/share-experience" variant="secondary">
                  Share your experience
                </LinkButton>
              ) : undefined
            }
          />
        )}
      </div>

      <BottomNav />
    </PageFrame>
  )
}
