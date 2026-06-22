'use client'

import { useEffect, useMemo, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { formatCompactNumber } from '@/lib/platform'
import { Card, Button, LinkButton, Input, Badge, Skeleton, EmptyState } from '@/components/ui'
import { cn } from '@/lib/cn'

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
      <div className="page-grid space-y-6">
        <header className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="eyebrow">
                Explore
              </p>
              <h1 className="text-2xl font-bold text-brand-background sm:text-3xl">
                Find a room that fits
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-brand-background/60">
                These are real, active groups on KinSpace. Join the ones that feel right - you can always leave later.
                Can&apos;t find your people? Start your own.
              </p>
            </div>
            <LinkButton
              href="/groups?create=1"
              className="shrink-0"
              leadingIcon={<i className="ri-add-line" aria-hidden="true" />}
            >
              Create group
            </LinkButton>
          </div>

          <div className="relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-brand-background/40" aria-hidden="true" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search groups, topics, or tags"
              aria-label="Search groups"
              className="h-12 pl-11"
            />
          </div>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {categories.map((category) => {
              const isActive = activeCategory === category.id
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  aria-pressed={isActive}
                  className={cn(
                    'flex min-w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                    isActive
                      ? 'bg-brand-background text-brand-primary shadow-sm'
                      : 'bg-brand-background/8 text-brand-background/65 hover:bg-brand-background/15 hover:text-brand-background/90',
                  )}
                >
                  {category.label}
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      isActive ? 'bg-brand-primary/15 text-brand-primary' : 'bg-brand-background/10 text-brand-background/60',
                    )}
                  >
                    {category.count}
                  </span>
                </button>
              )
            })}
          </div>
        </header>

        <section className="space-y-4">
          <div className="flex items-center justify-between text-sm text-brand-background/55">
            <p>
              {filteredGroups.length} live group{filteredGroups.length === 1 ? '' : 's'}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="font-medium text-brand-accent2 transition-colors hover:text-brand-accent2/80"
              >
                Clear search
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-60 rounded-2xl" />
              ))}
            </div>
          ) : filteredGroups.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredGroups.map((group) => {
                const joined = joinedGroupIds.has(group.id)
                const isOwnGroup = user?.userId === (group.created_by as string | undefined)
                const groupType = (group.type as string | undefined) || 'virtual'

                return (
                  <Card key={group.id} interactive className="flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="break-words text-lg font-semibold text-brand-background">
                            {group.name as string}
                          </h2>
                          {isOwnGroup ? (
                            <Badge tone="info">You manage this</Badge>
                          ) : joined ? (
                            <Badge tone="accent">Joined</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs capitalize text-brand-background/45">
                          {(group.category as string | undefined) || 'General'} • {groupType}
                        </p>
                      </div>
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-accent3/16 text-brand-accent3">
                        <i className={`${typeof group.icon === 'string' && group.icon.startsWith('ri-') ? group.icon : 'ri-group-line'} text-xl`} aria-hidden="true" />
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-brand-background/70">
                      {(group.description as string | undefined) || 'A live support group on KinSpace.'}
                    </p>

                    {Array.isArray(group.tags) && group.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(group.tags as string[]).slice(0, 4).map((tag) => (
                          <Badge key={tag}>{tag}</Badge>
                        ))}
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-brand-background/45">
                      <span>
                        {formatCompactNumber(group.members_count as number | undefined)}{' '}
                        {(group.members_count as number | undefined) === 1 ? 'member' : 'members'}
                      </span>
                      {(group.location as string | undefined) && (
                        <span className="inline-flex items-center gap-1">
                          <i className="ri-map-pin-2-line" aria-hidden="true" />
                          {group.location as string}
                        </span>
                      )}
                    </div>

                    <div className="mt-5 flex gap-2 pt-1">
                      {isOwnGroup ? (
                        <LinkButton href="/groups" variant="secondary" fullWidth>
                          Manage in Groups
                        </LinkButton>
                      ) : joined ? (
                        <Button
                          variant="secondary"
                          fullWidth
                          disabled
                          leadingIcon={<i className="ri-check-line" aria-hidden="true" />}
                        >
                          Already joined
                        </Button>
                      ) : (
                        <Button onClick={() => handleJoinGroup(group.id)} fullWidth>
                          Join group
                        </Button>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon={<i className="ri-search-line text-4xl" aria-hidden="true" />}
              image="/images/app/empty-search.webp"
              imageAlt="A person searching with a compass and a map"
              title={searchQuery || activeCategory !== 'all' ? 'No groups match yet' : 'No groups here yet'}
              description={
                searchQuery || activeCategory !== 'all'
                  ? "Try a different search, or clear the filters to see everything that's active right now."
                  : 'Be the first to start a space here. Create a group and others who get it will find you.'
              }
              action={
                searchQuery || activeCategory !== 'all' ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearchQuery('')
                      setActiveCategory('all')
                    }}
                  >
                    Reset filters
                  </Button>
                ) : (
                  <LinkButton
                    href="/groups?create=1"
                    leadingIcon={<i className="ri-add-line" aria-hidden="true" />}
                  >
                    Create the first group
                  </LinkButton>
                )
              }
            />
          )}
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
