'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { formatRelativeTime, getInitials, normalizeKeywords } from '@/lib/platform'

type SearchResult = {
  id: string
  type: 'group' | 'post' | 'resource' | 'location'
  title: string
  subtitle: string
  snippet: string
  href?: string
  badge?: string
}

const placeholders = [
  'Search groups, posts, resources, or nearby care',
  'Try "anxiety", "grief", or "pharmacy"',
  'Search a city, symptom, topic, or condition',
]

export default function SearchPage() {
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [groups, setGroups] = useState<Record<string, unknown>[]>([])
  const [posts, setPosts] = useState<Record<string, unknown>[]>([])
  const [resources, setResources] = useState<Record<string, unknown>[]>([])
  const [locations, setLocations] = useState<Record<string, unknown>[]>([])
  const [profiles, setProfiles] = useState<Record<string, unknown>[]>([])

  useEffect(() => {
    async function loadSearchData() {
      try {
        const [groupResults, postResults, resourceResults, locationResults, profileResults] = await Promise.all([
          DatabaseService.getGroups(),
          DatabaseService.getCommunityPosts(30),
          DatabaseService.getResources(),
          DatabaseService.getSupportLocations(),
          DatabaseService.listProfiles(),
        ])

        setGroups(groupResults as Record<string, unknown>[])
        setPosts(postResults as Record<string, unknown>[])
        setResources(resourceResults as Record<string, unknown>[])
        setLocations(locationResults as Record<string, unknown>[])
        setProfiles(profileResults as Record<string, unknown>[])
      } catch (error) {
        console.error('Failed to load search data:', error)
      } finally {
        setLoading(false)
      }
    }

    const stored = localStorage.getItem('kinspace-recent-searches')
    if (stored) setRecentSearches(JSON.parse(stored) as string[])

    void loadSearchData()
  }, [])

  const trendingTopics = useMemo(() => {
    const keywords = normalizeKeywords(
      groups.flatMap((group) => [group.category as string, ...(group.tags as string[] | undefined || [])]),
      resources.flatMap((resource) => [resource.category as string, ...(resource.tags as string[] | undefined || [])]),
      profiles.flatMap((profile) => [
        ...(profile.conditions as string[] | undefined || []),
        ...(profile.medications as string[] | undefined || []),
        ...(profile.interests as string[] | undefined || []),
      ]),
    )

    return keywords.slice(0, 10)
  }, [groups, profiles, resources])

  const results = useMemo(() => {
    if (!query.trim()) return []

    const q = query.trim().toLowerCase()
    const output: SearchResult[] = []

    groups.forEach((group) => {
      const groupType = (group.type as string | undefined) || 'virtual'
      const haystack = normalizeKeywords(
        group.name as string | undefined,
        group.description as string | undefined,
        group.category as string | undefined,
        group.location as string | undefined,
        group.tags as string[] | undefined,
      )

      if (haystack.some((keyword) => keyword.includes(q) || q.includes(keyword))) {
        const isMapReadyGroup = ['in-person', 'hybrid'].includes(groupType) && Boolean(group.location)

        output.push({
          id: `group-${group.id as string}`,
          type: 'group',
          title: group.name as string,
          subtitle: `${group.category as string} · ${groupType}`,
          snippet: (group.description as string | undefined) || 'Live community group',
          href: isMapReadyGroup ? `/nearby-support?focus=${group.id as string}` : '/groups',
          badge: 'Group',
        })
      }
    })

    posts.forEach((post) => {
      const author = post.is_anonymous
        ? 'Anonymous'
        : ((post.profile as Record<string, unknown> | undefined)?.full_name as string | undefined) ||
          ((post.profile as Record<string, unknown> | undefined)?.username as string | undefined) ||
          getInitials(user?.displayName || 'Community')

      const haystack = normalizeKeywords(
        post.content as string | undefined,
        post.type as string | undefined,
        author,
      )

      if (haystack.some((keyword) => keyword.includes(q) || q.includes(keyword))) {
        output.push({
          id: `post-${post.id as string}`,
          type: 'post',
          title: author,
          subtitle: formatRelativeTime(post.created_at),
          snippet: (post.content as string | undefined) || 'Community post',
          href: '/community',
          badge: 'Post',
        })
      }
    })

    resources.forEach((resource) => {
      const haystack = normalizeKeywords(
        resource.title as string | undefined,
        resource.excerpt as string | undefined,
        resource.category as string | undefined,
        resource.tags as string[] | undefined,
        resource.source as string | undefined,
      )

      if (haystack.some((keyword) => keyword.includes(q) || q.includes(keyword))) {
        output.push({
          id: `resource-${resource.id as string}`,
          type: 'resource',
          title: resource.title as string,
          subtitle: (resource.source as string | undefined) || 'Resource',
          snippet: (resource.excerpt as string | undefined) || 'Published resource',
          href: '/resources',
          badge: 'Resource',
        })
      }
    })

    locations.forEach((location) => {
      const locationType = (location.type as string | undefined) || 'doctor'
      const haystack = normalizeKeywords(
        location.name as string | undefined,
        location.specialty as string | undefined,
        location.address as string | undefined,
        location.type as string | undefined,
      )

      if (haystack.some((keyword) => keyword.includes(q) || q.includes(keyword))) {
        output.push({
          id: `location-${location.id as string}`,
          type: 'location',
          title: location.name as string,
          subtitle: (location.specialty as string | undefined) || locationType,
          snippet: (location.address as string | undefined) || 'Support location',
          href: `/map?type=${encodeURIComponent(locationType)}&focus=${encodeURIComponent(location.id as string)}`,
          badge: 'Location',
        })
      }
    })

    return output.slice(0, 24)
  }, [groups, locations, posts, query, resources, user?.displayName])

  function rememberSearch(term: string) {
    const next = [term, ...recentSearches.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, 6)
    setRecentSearches(next)
    localStorage.setItem('kinspace-recent-searches', JSON.stringify(next))
  }

  function handleSearch(term: string) {
    setQuery(term)
    rememberSearch(term)
  }

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
            Search
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Search the live platform</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#eedfc8]/60">
            Search now understands groups, posts, resources, care locations, and the topics members are actually talking about.
          </p>

          <div className="relative mt-6">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-[#eedfc8]/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setPlaceholderIndex((current) => (current + 1) % placeholders.length)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && query.trim()) {
                  rememberSearch(query.trim())
                }
              }}
              className="input-field !pl-11"
              placeholder={placeholders[placeholderIndex]}
            />
          </div>
        </section>

        {query.trim() ? (
          <section className="page-grid">
            <div className="flex items-center justify-between text-sm text-[#eedfc8]/45">
              <p>
                {results.length} result{results.length === 1 ? '' : 's'} for &ldquo;{query}&rdquo;
              </p>
              <button onClick={() => setQuery('')} className="text-[#D19A58]">
                Clear
              </button>
            </div>

            {loading ? (
              <div className="page-card-grid">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-40 skeleton rounded-3xl" />
                ))}
              </div>
            ) : results.length > 0 ? (
              <div className="page-card-grid">
                {results.map((result) => (
                  <article key={result.id} className="card">
                    <div className="flex items-center justify-between gap-3">
                      <span className="badge">{result.badge}</span>
                      <span className="text-xs text-[#eedfc8]/45">{result.subtitle}</span>
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-[#eedfc8]">{result.title}</h2>
                    <p className="mt-3 text-sm leading-relaxed text-[#eedfc8]/70">{result.snippet}</p>
                    {result.href && (
                      <Link href={result.href} className="btn-primary mt-5 block w-full !py-2.5 text-center text-sm">
                        Open {result.badge?.toLowerCase()}
                      </Link>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="card-light text-center">
                <i className="ri-search-line text-4xl text-[#eedfc8]/25" />
                <p className="mt-3 text-sm text-[#eedfc8]/60">Nothing matched that search yet.</p>
              </div>
            )}
          </section>
        ) : (
          <section className="page-grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start">
            <div className="card">
              <div className="flex items-center justify-between gap-3">
                <h2 className="section-title !mb-0">Recent searches</h2>
                {recentSearches.length > 0 && (
                  <button
                    onClick={() => {
                      setRecentSearches([])
                      localStorage.removeItem('kinspace-recent-searches')
                    }}
                    className="text-sm text-[#D19A58]"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="mt-4 space-y-2">
                {recentSearches.length > 0 ? (
                  recentSearches.map((term) => (
                    <button
                      key={term}
                      onClick={() => handleSearch(term)}
                      className="flex w-full items-center gap-3 rounded-2xl bg-[#eedfc8]/4 px-4 py-3 text-left transition-colors hover:bg-[#eedfc8]/8"
                    >
                      <i className="ri-history-line text-[#eedfc8]/30" />
                      <span className="flex-1 text-sm text-[#eedfc8]/70">{term}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-[#eedfc8]/55">Your recent searches will show up here.</p>
                )}
              </div>
            </div>

            <div className="card">
              <h2 className="section-title">Trending topics</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {trendingTopics.length > 0 ? (
                  trendingTopics.map((topic) => (
                    <button
                      key={topic}
                      onClick={() => handleSearch(topic)}
                      className="badge transition-colors hover:bg-[#eedfc8]/18"
                    >
                      {topic}
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-[#eedfc8]/55">Topics will appear as content is added.</p>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      <BottomNav />
    </PageFrame>
  )
}
