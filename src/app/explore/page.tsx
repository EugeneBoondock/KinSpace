'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { formatCompactNumber } from '@/lib/platform'

type Group = Record<string, unknown> & { id: string }

export default function ExplorePage() {
  const { user, loading: authLoading } = useAuth()
  const { push: toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<Group[]>([])
  const [joinedGroupIds, setJoinedGroupIds] = useState<Set<string>>(new Set())
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    async function loadExplore() {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        const [allGroups, memberships] = await Promise.all([
          DatabaseService.getGroups(),
          DatabaseService.getUserGroupMemberships(user.userId),
        ])

        setGroups(allGroups as Group[])
        setJoinedGroupIds(
          new Set(
            (memberships as Array<{ group?: { id?: string } | null }>)
              .map((membership) => membership.group?.id)
              .filter(Boolean) as string[],
          ),
        )
      } catch (error) {
        console.error('Failed to load explore page:', error)
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading) loadExplore()
  }, [authLoading, user])

  const categories = useMemo(() => {
    const counts = groups.reduce<Record<string, number>>((accumulator, group) => {
      const category = (group.category as string | undefined) || 'general'
      accumulator[category] = (accumulator[category] || 0) + 1
      return accumulator
    }, {})

    return [
      { id: 'all', label: 'All', count: groups.length },
      ...Object.entries(counts)
        .sort((first, second) => second[1] - first[1])
        .map(([id, count]) => ({
          id,
          label: id.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
          count,
        })),
    ]
  }, [groups])

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return groups.filter((group) => {
      const matchesCategory = activeCategory === 'all' || group.category === activeCategory
      const matchesQuery =
        !query ||
        [group.name, group.description, group.category, ...(group.tags as string[] | undefined || [])]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))

      return matchesCategory && matchesQuery
    })
  }, [activeCategory, groups, searchQuery])

  async function handleJoinGroup(groupId: string) {
    if (!user) return
    if (joinedGroupIds.has(groupId)) return

    setJoinedGroupIds((current) => new Set(current).add(groupId))
    try {
      await DatabaseService.joinGroup(groupId, user.userId)
      const refreshedGroups = await DatabaseService.getGroups()
      setGroups(refreshedGroups as Group[])
      toast('Joined the group', 'success')
    } catch (error) {
      console.error('Failed to join group:', error)
      setJoinedGroupIds((current) => {
        const next = new Set(current)
        next.delete(groupId)
        return next
      })
      toast('Could not join group', 'error')
    }
  }

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
                Explore
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Find the right room to walk into</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#eedfc8]/60">
                Every group listed here is coming from the live platform now. Join what fits, skip what does not.
              </p>
            </div>
            <div className="w-full max-w-sm">
              <div className="relative">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-[#eedfc8]/35" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search groups, topics, or tags"
                  className="input-field !pl-11"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
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
          <div className="flex items-center justify-between text-sm text-[#eedfc8]/45">
            <p>{filteredGroups.length} live group{filteredGroups.length === 1 ? '' : 's'} found</p>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-[#D19A58]">
                Clear search
              </button>
            )}
          </div>

          {loading ? (
            <div className="page-card-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-56 skeleton rounded-3xl" />
              ))}
            </div>
          ) : filteredGroups.length > 0 ? (
            <div className="page-card-grid">
              {filteredGroups.map((group) => {
                const joined = joinedGroupIds.has(group.id)
                const isOwnGroup = user?.userId === (group.created_by as string | undefined)
                const groupType = (group.type as string | undefined) || 'virtual'

                return (
                  <article key={group.id} className="card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-[#eedfc8] break-words">
                            {group.name as string}
                          </h2>
                          {isOwnGroup ? (
                            <span className="badge bg-[#6B8A83]/20 text-[#6B8A83]">You manage this</span>
                          ) : joined ? (
                            <span className="badge bg-[#D19A58]/15 text-[#D19A58]">Joined</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-[#eedfc8]/45">
                          {(group.category as string | undefined) || 'General'} • {groupType}
                        </p>
                      </div>
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#6B8A83]/16 text-[#6B8A83]">
                        <i className={`${(group.icon as string | undefined) || 'ri-group-line'} text-xl`} />
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-[#eedfc8]/70">
                      {(group.description as string | undefined) || 'A live support group on KinSpace.'}
                    </p>

                    {Array.isArray(group.tags) && group.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(group.tags as string[]).slice(0, 4).map((tag) => (
                          <span key={tag} className="badge text-[10px]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#eedfc8]/45">
                      <span>
                        {formatCompactNumber(group.members_count as number | undefined)}{' '}
                        {(group.members_count as number | undefined) === 1 ? 'member' : 'members'}
                      </span>
                      {(group.location as string | undefined) && <span>{group.location as string}</span>}
                    </div>

                    <div className="mt-5 flex gap-2">
                      {isOwnGroup ? (
                        <Link
                          href="/groups"
                          className="btn-secondary flex-1 rounded-full py-2.5 text-center text-sm font-semibold"
                        >
                          Manage in Groups
                        </Link>
                      ) : (
                        <button
                          onClick={() => handleJoinGroup(group.id)}
                          disabled={joined}
                          className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-all ${
                            joined
                              ? 'border border-[#D19A58]/30 bg-[#D19A58]/15 text-[#D19A58]'
                              : 'btn-primary'
                          }`}
                        >
                          {joined ? 'Already joined' : 'Join group'}
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="card-light text-center">
              <i className="ri-search-line text-4xl text-[#eedfc8]/25" />
              <p className="mt-3 text-sm text-[#eedfc8]/60">No groups match that search yet.</p>
            </div>
          )}
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
