'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { DatabaseService } from '@/lib/database'

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
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
            Treatments
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Treatment directory</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#eedfc8]/60">
            Browse everything the community is reporting on. Medications, therapies, lifestyle
            changes, supplements, devices — all crowdsourced.
          </p>

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search treatments"
              className="input-field flex-1"
            />
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto">
            {KIND_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setKind(tab.id)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${
                  kind === tab.id ? 'bg-[#eedfc8] text-[#2A4A42]' : 'bg-[#eedfc8]/8 text-[#eedfc8]/65'
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
              <div key={index} className="h-28 skeleton rounded-3xl" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="page-card-grid">
            {filtered.map((treatment) => (
              <Link
                key={treatment.id}
                href={`/treatments/${treatment.id}`}
                className="card transition-colors hover:border-[#D19A58]/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge bg-[#6B8A83]/16 text-[#6B8A83] capitalize">
                    {(treatment.kind as string) ?? 'treatment'}
                  </span>
                  {(treatment.status as string) === 'pending' && (
                    <span className="badge bg-[#D19A58]/15 text-[#D19A58]">Pending review</span>
                  )}
                </div>
                <h2 className="mt-3 text-lg font-semibold text-[#eedfc8]">{treatment.name as string}</h2>
                {(treatment.summary as string | undefined) && (
                  <p className="mt-2 text-sm text-[#eedfc8]/65">{treatment.summary as string}</p>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="card-light text-center">
            <p className="text-sm text-[#eedfc8]/60">
              No treatments in this category yet. Members add new ones as they share experiences.
            </p>
          </div>
        )}
      </div>

      <BottomNav />
    </PageFrame>
  )
}
