'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { DatabaseService } from '@/lib/database'
import { formatCompactNumber } from '@/lib/platform'

type Condition = Record<string, unknown> & { id: string }

const CATEGORY_TABS = [
  { id: 'all', label: 'All' },
  { id: 'mental', label: 'Mental health' },
  { id: 'chronic', label: 'Chronic' },
  { id: 'autoimmune', label: 'Autoimmune' },
  { id: 'neurological', label: 'Neurological' },
  { id: 'pain', label: 'Pain' },
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
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
            Insights
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">
            What actually works — crowdsourced by the community
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#eedfc8]/60">
            Pick a condition. See which treatments real people here found most effective, with honest
            ratings and stories. Not medical advice — a starting point for your own care conversations.
          </p>

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conditions, e.g., 'migraine' or 'fibromyalgia'"
              className="input-field flex-1"
            />
            <Link href="/share-experience" className="btn-primary !py-2.5 !px-4 text-sm">
              Share your experience
            </Link>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCategory(tab.id)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${
                  category === tab.id
                    ? 'bg-[#eedfc8] text-[#2A4A42]'
                    : 'bg-[#eedfc8]/8 text-[#eedfc8]/65'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="page-card-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-40 skeleton rounded-3xl" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="page-card-grid">
            {filtered.map((condition) => (
              <Link
                key={condition.id}
                href={`/conditions/${condition.id}`}
                className="card transition-colors hover:border-[#D19A58]/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="badge bg-[#6B8A83]/16 text-[#6B8A83] capitalize">
                      {(condition.category as string) || 'condition'}
                    </span>
                    <h2 className="mt-3 text-xl font-semibold text-[#eedfc8]">
                      {condition.name as string}
                    </h2>
                  </div>
                  <span className="rounded-full bg-[#eedfc8]/10 px-2 py-1 text-xs text-[#eedfc8]/60">
                    {formatCompactNumber((condition.member_count as number | undefined) ?? 0)} members
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[#eedfc8]/65">
                  {(condition.summary as string | undefined) ?? ''}
                </p>
                {Array.isArray(condition.aliases) && (condition.aliases as string[]).length > 0 && (
                  <p className="mt-3 text-xs text-[#eedfc8]/45">
                    Also known as: {(condition.aliases as string[]).slice(0, 3).join(', ')}
                  </p>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="card-light text-center">
            <i className="ri-pulse-line text-4xl text-[#eedfc8]/25" />
            <p className="mt-3 text-sm text-[#eedfc8]/60">
              No conditions match yet. Run the seed script (<code>npm run seed</code>) to populate the directory.
            </p>
          </div>
        )}
      </div>

      <BottomNav />
    </PageFrame>
  )
}
