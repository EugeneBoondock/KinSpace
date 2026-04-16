'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { DatabaseService } from '@/lib/database'
import { formatCompactNumber } from '@/lib/platform'

type Condition = Record<string, unknown> & { id: string }
type TopTreatment = Record<string, unknown> & {
  id: string
  treatment?: (Record<string, unknown> & { id: string }) | null
}
type InsightBundle = {
  condition: Condition
  topTreatments: TopTreatment[]
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<InsightBundle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    DatabaseService.getFeaturedInsights(8)
      .then((data) => setInsights(data as InsightBundle[]))
      .catch((error) => console.error('Failed to load insights:', error))
      .finally(() => setLoading(false))
  }, [])

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
            Insights
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">What works for our community</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#eedfc8]/60">
            Top-rated treatments by condition — drawn from real member experiences. Jump into any
            condition to see stories, side-effect patterns, and share what has worked for you.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/conditions" className="btn-primary !py-2.5 !px-4 text-sm">
              Browse all conditions
            </Link>
            <Link href="/treatments" className="btn-secondary !py-2.5 !px-4 text-sm">
              Browse treatments
            </Link>
            <Link href="/share-experience" className="btn-secondary !py-2.5 !px-4 text-sm">
              Share yours
            </Link>
          </div>
        </section>

        {loading ? (
          <div className="page-card-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-56 skeleton rounded-3xl" />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <div className="card-light text-center">
            <i className="ri-heart-pulse-line text-4xl text-[#eedfc8]/25" />
            <p className="mt-3 text-sm text-[#eedfc8]/60">
              No insights yet. Once members share experiences, rankings will populate here.
            </p>
          </div>
        ) : (
          <div className="page-card-grid">
            {insights.map(({ condition, topTreatments }) => (
              <article key={condition.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="badge bg-[#6B8A83]/16 text-[#6B8A83] capitalize">
                      {(condition.category as string) ?? 'condition'}
                    </span>
                    <h2 className="mt-3 text-lg font-semibold text-[#eedfc8]">
                      {condition.name as string}
                    </h2>
                  </div>
                  <span className="text-xs text-[#eedfc8]/45">
                    {formatCompactNumber((condition.member_count as number | undefined) ?? 0)} members
                  </span>
                </div>

                {topTreatments.length === 0 ? (
                  <p className="mt-3 text-sm text-[#eedfc8]/55">
                    No ranked treatments yet.
                  </p>
                ) : (
                  <ol className="mt-3 space-y-2">
                    {topTreatments.filter((entry) => entry.treatment).slice(0, 3).map((entry, index) => (
                      <li key={entry.id} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="font-bold text-[#D19A58]">#{index + 1}</span>
                          <span className="text-[#eedfc8]/80">{entry.treatment?.name as string}</span>
                        </span>
                        <span className="text-[#D19A58]">
                          {((entry.effectiveness_avg as number | undefined) ?? 0).toFixed(1)}/5
                        </span>
                      </li>
                    ))}
                  </ol>
                )}

                <Link
                  href={`/conditions/${condition.id}`}
                  className="btn-secondary mt-4 block w-full !py-2.5 text-center text-sm"
                >
                  See full ranking →
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </PageFrame>
  )
}
