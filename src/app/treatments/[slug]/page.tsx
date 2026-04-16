'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { DatabaseService } from '@/lib/database'

type TreatmentDoc = Record<string, unknown> & { id: string }
type ConditionEntry = Record<string, unknown> & {
  id: string
  condition?: (Record<string, unknown> & { id: string }) | null
}

export default function TreatmentDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug as string | undefined

  const [treatment, setTreatment] = useState<TreatmentDoc | null>(null)
  const [conditions, setConditions] = useState<ConditionEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    async function load() {
      const [doc, linked] = await Promise.all([
        DatabaseService.getTreatment(slug as string),
        DatabaseService.getConditionsForTreatment(slug as string, 20),
      ])
      setTreatment((doc as TreatmentDoc) || null)
      setConditions(linked as ConditionEntry[])
      setLoading(false)
    }
    load().catch((error) => {
      console.error('Failed to load treatment:', error)
      setLoading(false)
    })
  }, [slug])

  if (loading) {
    return (
      <PageFrame>
        <div className="h-40 skeleton rounded-3xl" />
        <BottomNav />
      </PageFrame>
    )
  }

  if (!treatment) {
    return (
      <PageFrame>
        <div className="card-light text-center">
          <p className="text-sm text-[#eedfc8]/60">Treatment not found.</p>
          <Link href="/treatments" className="btn-primary mt-4 inline-block !py-2.5 !px-4 text-sm">
            Browse treatments
          </Link>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <Link href="/treatments" className="text-sm text-[#D19A58]">
            ← All treatments
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="badge bg-[#6B8A83]/16 text-[#6B8A83] capitalize">
              {(treatment.kind as string) ?? 'treatment'}
            </span>
            {(treatment.status as string) === 'pending' && (
              <span className="badge bg-[#D19A58]/15 text-[#D19A58]">Pending review</span>
            )}
          </div>
          <h1 className="mt-4 text-3xl font-bold text-[#eedfc8]">{treatment.name as string}</h1>
          {(treatment.summary as string | undefined) && (
            <p className="mt-3 text-base leading-relaxed text-[#eedfc8]/70">
              {treatment.summary as string}
            </p>
          )}
        </section>

        <section className="card">
          <h2 className="section-title">Conditions this treatment is reported for</h2>
          {conditions.length === 0 || !conditions.some((entry) => entry.condition) ? (
            <p className="text-sm text-[#eedfc8]/55">
              No ratings yet. If you use this treatment,{' '}
              <Link href={`/share-experience?treatment=${slug}`} className="text-[#D19A58]">
                share your experience
              </Link>
              .
            </p>
          ) : (
            <ol className="space-y-4">
              {conditions
                .filter((entry) => entry.condition)
                .map((entry, index) => {
                  const condition = entry.condition!
                  const effectiveness = (entry.effectiveness_avg as number | undefined) ?? 0
                  const count = (entry.effectiveness_count as number | undefined) ?? 0
                  return (
                    <li key={entry.id} className="rounded-2xl bg-[#eedfc8]/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-[#D19A58]">#{index + 1}</span>
                            <Link
                              href={`/conditions/${condition.id}`}
                              className="text-lg font-semibold text-[#eedfc8] hover:text-[#D19A58]"
                            >
                              {condition.name as string}
                            </Link>
                          </div>
                          {(condition.summary as string | undefined) && (
                            <p className="mt-2 text-sm text-[#eedfc8]/60">
                              {condition.summary as string}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-[#D19A58]">{effectiveness.toFixed(1)}</p>
                          <p className="text-xs text-[#eedfc8]/45">{count} ratings</p>
                        </div>
                      </div>
                    </li>
                  )
                })}
            </ol>
          )}
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
