'use client'

import { useEffect, useMemo, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { DatabaseService } from '@/lib/database'
import { formatCompactNumber, formatRelativeTime } from '@/lib/platform'

type SortOption = 'recent' | 'popularity' | 'alphabetical'

type Group = Record<string, unknown> & { id: string }

export default function NearbySupportPage() {
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<Group[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('popularity')

  useEffect(() => {
    async function loadGroups() {
      try {
        const allGroups = await DatabaseService.getGroups()
        setGroups(allGroups as Group[])
      } catch (error) {
        console.error('Failed to load nearby support groups:', error)
      } finally {
        setLoading(false)
      }
    }

    loadGroups()
  }, [])

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const candidates = groups
      .filter((group) => ['in-person', 'hybrid'].includes((group.type as string | undefined) || 'virtual'))
      .filter((group) => {
        if (!query) return true
        return [group.name, group.description, group.category, group.location]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      })

    return candidates.sort((first, second) => {
      if (sortBy === 'alphabetical') {
        return String(first.name || '').localeCompare(String(second.name || ''))
      }
      if (sortBy === 'recent') {
        return (new Date(second.created_at as string | number | Date).getTime() || 0) -
          (new Date(first.created_at as string | number | Date).getTime() || 0)
      }
      return ((second.members_count as number | undefined) ?? 0) - ((first.members_count as number | undefined) ?? 0)
    })
  }, [groups, searchQuery, sortBy])

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
                Nearby support
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">In-person and hybrid groups near you</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#eedfc8]/60">
                This page now reuses the live groups collection and filters for groups that can meet in the real world.
              </p>
            </div>
            <div className="w-full max-w-sm">
              <div className="relative">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-[#eedfc8]/35" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="input-field !pl-11"
                  placeholder="Search by group, category, or location"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {([
              { value: 'popularity' as SortOption, label: 'Popular' },
              { value: 'recent' as SortOption, label: 'Recent' },
              { value: 'alphabetical' as SortOption, label: 'A-Z' },
            ]).map((option) => (
              <button
                key={option.value}
                onClick={() => setSortBy(option.value)}
                className={`rounded-full px-4 py-2 text-sm transition-all ${
                  sortBy === option.value ? 'tab-active' : 'bg-[#eedfc8]/8 text-[#eedfc8]/60'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="page-grid">
          <div className="flex items-center justify-between text-sm text-[#eedfc8]/45">
            <p>{formatCompactNumber(filteredGroups.length)} in-person or hybrid group{filteredGroups.length === 1 ? '' : 's'}</p>
          </div>

          {loading ? (
            <div className="page-card-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-56 skeleton rounded-3xl" />
              ))}
            </div>
          ) : filteredGroups.length > 0 ? (
            <div className="page-card-grid">
              {filteredGroups.map((group) => (
                <article key={group.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-[#eedfc8]">{group.name as string}</h2>
                        <span
                          className={`badge ${
                            group.type === 'hybrid'
                              ? 'bg-[#D19A58]/16 text-[#D19A58]'
                              : 'bg-[#6B8A83]/16 text-[#6B8A83]'
                          }`}
                        >
                          {group.type as string}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#eedfc8]/45">{group.category as string}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eedfc8]/8 text-[#D19A58]">
                      <i className="ri-map-pin-2-line text-xl" />
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-[#eedfc8]/70">
                    {(group.description as string | undefined) || 'A live support group published on KinSpace.'}
                  </p>

                  <div className="mt-4 space-y-2 text-sm text-[#eedfc8]/60">
                    {(group.location as string | undefined) && (
                      <p>
                        <i className="ri-map-pin-line mr-1.5 text-[#eedfc8]/35" />
                        {group.location as string}
                      </p>
                    )}
                    {(group.next_meeting_at as string | undefined) && (
                      <p>
                        <i className="ri-calendar-line mr-1.5 text-[#eedfc8]/35" />
                        {formatRelativeTime(group.next_meeting_at)}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-[#eedfc8]/45">
                    <span>{formatCompactNumber(group.members_count as number | undefined)} members</span>
                    <span>Created {formatRelativeTime(group.created_at)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="card-light text-center">
              <i className="ri-map-pin-2-line text-4xl text-[#eedfc8]/25" />
              <p className="mt-3 text-sm text-[#eedfc8]/60">No in-person or hybrid groups match that filter yet.</p>
            </div>
          )}
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
