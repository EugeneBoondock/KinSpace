'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import KinMap from '@/components/maps/KinMap'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { geocodeQueries, getMapDirections, getNearbyFallbackPlaces } from '@/lib/map-client'
import { parseCoordinateString, type Coordinates, type MapDirectionsResult, type SupportMapMarker } from '@/lib/map'
import { formatCompactNumber, formatRelativeTime, getDistanceKm, normalizeKeywords } from '@/lib/platform'

type SortOption = 'recent' | 'popularity' | 'distance'
type Group = Record<string, unknown> & { id: string }

function resolveGroupCoordinates(group: Group) {
  if (typeof group.latitude === 'number' && typeof group.longitude === 'number') {
    return {
      latitude: group.latitude as number,
      longitude: group.longitude as number,
    }
  }

  return parseCoordinateString(group.location as string | undefined)
}

function buildGroupLocationQuery(group: Group) {
  return [group.location, group.name].filter(Boolean).join(', ')
}

export default function NearbySupportPage() {
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<Group[]>([])
  const [joinedGroupIds, setJoinedGroupIds] = useState<Set<string>>(new Set())
  const [fallbackGroups, setFallbackGroups] = useState<SupportMapMarker[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('distance')
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [directions, setDirections] = useState<MapDirectionsResult | null>(null)
  const [routing, setRouting] = useState(false)

  useEffect(() => {
    async function loadNearbyGroups() {
      try {
        const [allGroups, memberships] = await Promise.all([
          DatabaseService.getGroups(),
          user ? DatabaseService.getUserGroupMemberships(user.userId) : Promise.resolve([]),
        ])

        const inPersonGroups = (allGroups as Group[]).filter((group) =>
          ['in-person', 'hybrid'].includes((group.type as string | undefined) || 'virtual'),
        )

        const geocodeTargets = inPersonGroups
          .filter((group) => !resolveGroupCoordinates(group) && buildGroupLocationQuery(group))
          .map((group) => buildGroupLocationQuery(group))

        const geocodes = await geocodeQueries(geocodeTargets)

        const hydratedGroups = inPersonGroups.map((group) => {
          const coordinates = resolveGroupCoordinates(group) || geocodes.get(buildGroupLocationQuery(group))
          return coordinates ? { ...group, ...coordinates } : group
        })

        setGroups(hydratedGroups)
        setJoinedGroupIds(
          new Set(
            (memberships as Array<{ group?: { id?: string } | null }>)
              .map((membership) => membership.group?.id)
              .filter(Boolean) as string[],
          ),
        )
      } catch (error) {
        console.error('Failed to load nearby support groups:', error)
      } finally {
        setLoading(false)
      }
    }

    void loadNearbyGroups()
  }, [user])

  useEffect(() => {
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }, [])

  useEffect(() => {
    if (!userLocation) return

    let active = true
    const currentLocation = userLocation

    async function loadFallbackGroups() {
      try {
        const results = await getNearbyFallbackPlaces(currentLocation, 'group', 9000)
        if (!active) return

        setFallbackGroups(
          results.map((result, index) => ({
            id: `fallback-group-${result.id || index}`,
            kind: 'group',
            title: (result.title as string | undefined) || 'Community support place',
            subtitle: (result.subtitle as string | undefined) || 'Nearby support venue',
            description: (result.address as string | undefined) || 'OpenStreetMap community place',
            address: result.address as string | undefined,
            phone: result.phone as string | undefined,
            hours: result.hours as string | undefined,
            latitude: result.latitude as number,
            longitude: result.longitude as number,
            source: 'osm',
            tags: Array.isArray(result.tags) ? (result.tags as string[]) : [],
          })),
        )
      } catch (error) {
        console.error('Failed to load fallback support places:', error)
      }
    }

    void loadFallbackGroups()

    return () => {
      active = false
    }
  }, [userLocation])

  const groupMarkers = useMemo<SupportMapMarker[]>(() => {
    return groups
      .filter((group) => typeof group.latitude === 'number' && typeof group.longitude === 'number')
      .map((group) => ({
        id: group.id,
        kind: 'group' as const,
        title: (group.name as string | undefined) || 'Support group',
        subtitle: `${(group.category as string | undefined) || 'general'} · ${((group.type as string | undefined) || 'hybrid')}`,
        description: (group.description as string | undefined) || 'In-person support group',
        address: group.location as string | undefined,
        latitude: group.latitude as number,
        longitude: group.longitude as number,
        source: 'community' as const,
        href: '/groups',
        tags: Array.isArray(group.tags) ? (group.tags as string[]) : [],
      }))
      .map((marker) => ({
        ...marker,
        distanceKm: userLocation
          ? getDistanceKm(userLocation.latitude, userLocation.longitude, marker.latitude, marker.longitude)
          : null,
      }))
  }, [groups, userLocation])

  const visibleMarkers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const combined = [...groupMarkers, ...fallbackGroups.map((marker) => ({
      ...marker,
      distanceKm: userLocation
        ? getDistanceKm(userLocation.latitude, userLocation.longitude, marker.latitude, marker.longitude)
        : null,
    }))]

    const filtered = combined.filter((marker) => {
      if (!query) return true
      return normalizeKeywords(marker.title, marker.subtitle, marker.description, marker.address, marker.tags).some(
        (keyword) => keyword.includes(query) || query.includes(keyword),
      )
    })

    return filtered.sort((first, second) => {
      if (sortBy === 'recent') {
        const firstGroup = groups.find((group) => group.id === first.id)
        const secondGroup = groups.find((group) => group.id === second.id)
        return (new Date(secondGroup?.created_at as string | number | Date).getTime() || 0) -
          (new Date(firstGroup?.created_at as string | number | Date).getTime() || 0)
      }

      if (sortBy === 'popularity') {
        const firstGroup = groups.find((group) => group.id === first.id)
        const secondGroup = groups.find((group) => group.id === second.id)
        return ((secondGroup?.members_count as number | undefined) ?? 0) -
          ((firstGroup?.members_count as number | undefined) ?? 0)
      }

      if (first.distanceKm == null && second.distanceKm == null) return first.title.localeCompare(second.title)
      if (first.distanceKm == null) return 1
      if (second.distanceKm == null) return -1
      return first.distanceKm - second.distanceKm
    })
  }, [fallbackGroups, groupMarkers, groups, searchQuery, sortBy, userLocation])

  const selectedMarker = visibleMarkers.find((marker) => marker.id === selectedMarkerId) || visibleMarkers[0] || null

  useEffect(() => {
    if (!selectedMarker && visibleMarkers[0]) {
      setSelectedMarkerId(visibleMarkers[0].id)
      return
    }

    if (selectedMarkerId && !visibleMarkers.some((marker) => marker.id === selectedMarkerId)) {
      setSelectedMarkerId(visibleMarkers[0]?.id || null)
    }
  }, [selectedMarker, selectedMarkerId, visibleMarkers])

  useEffect(() => {
    setDirections(null)
  }, [selectedMarkerId])

  async function handleRouteRequest() {
    if (!selectedMarker || !userLocation) return

    setRouting(true)
    try {
      const result = await getMapDirections(
        userLocation,
        { latitude: selectedMarker.latitude, longitude: selectedMarker.longitude },
        'walking',
      )
      setDirections(result)
    } catch (error) {
      console.error('Failed to build nearby support route:', error)
    } finally {
      setRouting(false)
    }
  }

  async function handleJoinGroup(groupId: string) {
    if (!user || joinedGroupIds.has(groupId)) return

    setJoinedGroupIds((current) => new Set(current).add(groupId))
    try {
      await DatabaseService.joinGroup(groupId, user.userId)
    } catch (error) {
      console.error('Failed to join nearby support group:', error)
    }
  }

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
                Nearby support
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">In-person and hybrid support on a native map</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#eedfc8]/60">
                Community groups with physical locations now live on the same in-app map system as the care directory.
              </p>
            </div>
            <div className="w-full max-w-sm">
              <div className="relative">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-[#eedfc8]/35" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="input-field !pl-11"
                  placeholder="Search by group, category, or venue"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {([
              { value: 'distance' as SortOption, label: 'Nearest' },
              { value: 'popularity' as SortOption, label: 'Popular' },
              { value: 'recent' as SortOption, label: 'Recent' },
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

        <div className="page-grid lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,26rem)] lg:items-start">
          <section className="space-y-4">
            <div className="card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-[#eedfc8]/50">
                  {formatCompactNumber(visibleMarkers.length)} map result{visibleMarkers.length === 1 ? '' : 's'}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleRouteRequest()}
                    disabled={!selectedMarker || !userLocation || routing}
                    className="btn-primary !rounded-2xl !px-4 !py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {routing ? 'Routing...' : 'Walk from me'}
                  </button>
                  {directions && (
                    <button
                      onClick={() => setDirections(null)}
                      className="btn-secondary !rounded-2xl !px-4 !py-2.5 text-sm"
                    >
                      Clear route
                    </button>
                  )}
                </div>
              </div>

              {directions && (
                <div className="mt-4 flex gap-3 text-xs text-[#eedfc8]/55">
                  <span className="badge">{directions.distanceKm.toFixed(1)} km</span>
                  <span className="badge">{directions.durationMinutes} min walk</span>
                </div>
              )}
            </div>

            <KinMap
              markers={visibleMarkers}
              selectedMarkerId={selectedMarker?.id}
              userLocation={userLocation}
              directions={directions}
              onSelectMarker={setSelectedMarkerId}
            />
          </section>

          <aside className="space-y-4">
            {selectedMarker && (
              <section className="card">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge bg-[#6B8A83]/18 text-[#6B8A83]">Nearby support</span>
                  {selectedMarker.source && <span className="badge">{selectedMarker.source}</span>}
                </div>
                <h2 className="mt-4 text-xl font-semibold text-[#eedfc8]">{selectedMarker.title}</h2>
                {selectedMarker.subtitle && (
                  <p className="mt-1 text-sm text-[#eedfc8]/50">{selectedMarker.subtitle}</p>
                )}
                {selectedMarker.description && (
                  <p className="mt-4 text-sm leading-relaxed text-[#eedfc8]/70">{selectedMarker.description}</p>
                )}
                <div className="mt-4 space-y-2 text-sm text-[#eedfc8]/60">
                  {selectedMarker.address && (
                    <p>
                      <i className="ri-map-pin-line mr-1.5 text-[#eedfc8]/35" />
                      {selectedMarker.address}
                    </p>
                  )}
                  {selectedMarker.distanceKm != null && (
                    <p>
                      <i className="ri-route-line mr-1.5 text-[#eedfc8]/35" />
                      {selectedMarker.distanceKm.toFixed(1)} km away
                    </p>
                  )}
                </div>
                {selectedMarker.source === 'community' ? (
                  <div className="mt-5 flex gap-2">
                    <button
                      onClick={() => handleJoinGroup(selectedMarker.id)}
                      disabled={joinedGroupIds.has(selectedMarker.id) || !user}
                      className="btn-primary flex-1 !rounded-2xl !py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {joinedGroupIds.has(selectedMarker.id) ? 'Joined' : user ? 'Join group' : 'Sign in to join'}
                    </button>
                    <Link href="/groups" className="btn-secondary flex-1 !rounded-2xl !py-2.5 text-center text-sm">
                      Open groups
                    </Link>
                  </div>
                ) : (
                  <div className="mt-5">
                    <Link href="/map?type=group" className="btn-secondary block w-full !rounded-2xl !py-2.5 text-center text-sm">
                      Open full support map
                    </Link>
                  </div>
                )}
              </section>
            )}

            <section className="card">
              <h2 className="section-title">Support list</h2>
              <div className="space-y-3">
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-28 skeleton rounded-3xl" />
                  ))
                ) : visibleMarkers.length > 0 ? (
                  visibleMarkers.map((marker) => {
                    const relatedGroup = groups.find((group) => group.id === marker.id)
                    const nextMeetingAt = relatedGroup?.next_meeting_at

                    return (
                      <button
                        key={marker.id}
                        onClick={() => setSelectedMarkerId(marker.id)}
                        className={`w-full rounded-3xl border p-4 text-left transition-all ${
                          selectedMarker?.id === marker.id
                            ? 'border-[#6B8A83]/30 bg-[#6B8A83]/10'
                            : 'border-[#eedfc8]/8 bg-[#eedfc8]/4 hover:bg-[#eedfc8]/8'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#eedfc8]">{marker.title}</p>
                            {marker.subtitle && (
                              <p className="mt-1 text-xs text-[#eedfc8]/45">{marker.subtitle}</p>
                            )}
                          </div>
                          {marker.distanceKm != null && (
                            <span className="badge text-[10px]">{marker.distanceKm.toFixed(1)} km</span>
                          )}
                        </div>
                        {marker.address && (
                          <p className="mt-3 line-clamp-2 text-sm text-[#eedfc8]/60">{marker.address}</p>
                        )}
                        {Boolean(nextMeetingAt) && (
                          <p className="mt-2 text-xs text-[#D19A58]">
                            Next meeting {formatRelativeTime(nextMeetingAt)}
                          </p>
                        )}
                      </button>
                    )
                  })
                ) : (
                  <div className="card-light text-center">
                    <i className="ri-map-pin-2-line text-4xl text-[#eedfc8]/25" />
                    <p className="mt-3 text-sm text-[#eedfc8]/60">
                      No nearby support groups matched that filter yet.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
