'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { DatabaseService } from '@/lib/database'
import {
  Badge,
  Card,
  EmptyState,
  Input,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui'

type Treatment = Record<string, unknown> & { id: string }

const KIND_TABS = [
  { id: 'all', label: 'All' },
  { id: 'medication', label: 'Medications' },
  { id: 'therapy', label: 'Therapies' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'supplement', label: 'Supplements' },
  { id: 'device', label: 'Devices' },
]

export default function TreatmentsPage() {
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    DatabaseService.getTreatments()
      .then((data) => setTreatments(data as Treatment[]))
      .catch((error) => console.error('Failed to load treatments:', error))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return treatments
      .filter((treatment) => (kind === 'all' ? true : treatment.kind === kind))
      .filter((treatment) => {
        if (!search) return true
        return String(treatment.name).toLowerCase().includes(search.toLowerCase())
      })
  }, [treatments, kind, search])

  return (
    <PageFrame containerClassName="max-w-5xl">
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-background/45">
            Treatments
          </p>
          <h1 className="text-2xl font-bold text-brand-background sm:text-3xl">Treatment directory</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-brand-background/65">
            Browse everything the community is reporting on - medications, therapies, lifestyle
            changes, supplements, and devices, all crowdsourced from real experiences.
          </p>
        </header>

        <Card className="space-y-4">
          <div className="relative">
            <i
              className="ri-search-line pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-background/40"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search treatments"
              aria-label="Search treatments"
              className="h-11 pl-11"
            />
          </div>

          <Tabs value={kind} onValueChange={setKind}>
            <TabsList className="flex w-full gap-1 overflow-x-auto">
              {KIND_TABS.map((tab) => (
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
              <Card key={index} className="space-y-3">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </Card>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((treatment) => (
              <Link
                key={treatment.id}
                href={`/treatments/${treatment.id}`}
                className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
              >
                <Card interactive className="h-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-brand-accent3/15 capitalize text-brand-accent3">
                      {(treatment.kind as string) ?? 'treatment'}
                    </Badge>
                    {(treatment.status as string) === 'pending' && (
                      <Badge tone="warning">Pending review</Badge>
                    )}
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-brand-background group-hover:text-brand-accent2">
                    {treatment.name as string}
                  </h2>
                  {(treatment.summary as string | undefined) && (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-brand-background/65">
                      {treatment.summary as string}
                    </p>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<i className="ri-capsule-line text-4xl" aria-hidden="true" />}
            title={search || kind !== 'all' ? 'No treatments match your search' : 'No treatments here yet'}
            description={
              search || kind !== 'all'
                ? 'Try a different word or switch categories to see more.'
                : 'Members add new treatments as they share experiences. Check back soon, or be the first to add one.'
            }
          />
        )}
      </div>

      <BottomNav />
    </PageFrame>
  )
}
