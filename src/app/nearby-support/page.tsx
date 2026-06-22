'use client'

import { useEffect, useMemo, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import KinMap from '@/components/maps/KinMap'
import PageFrame from '@/components/PageFrame'
import { Badge, Button, Card, EmptyState, Input, LinkButton, Skeleton } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { geocodeQueries, getMapDirections, getNearbyFallbackPlaces } from '@/lib/map-client'
import { parseCoordinateString, type Coordinates, type MapDirectionsResult, type SupportMapMarker } from '@/lib/map'
import { formatCompactNumber, formatRelativeTime, getDistanceKm, normalizeKeywords } from '@/lib/platform'

type SortOption = 'recent' | 'popularity' | 'distance'
type Group = Record<string, unknown> & { id: string }

// Fallback map center (Johannesburg, SA) so the care map loads places even when
// the visitor declines or can't share location, geolocation, when granted,
// overrides this. Without it, nothing ever loaded (the silent bug).
const DEFAULT_CENTER: Coordinates = { latitude: -26.2041, longitude: 28.0473 }

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
  // Start at the default center so the map + places load immediately; real
  // geolocation (if granted) overrides it. Never block place-loading on a
  // permission prompt that may hang or be declined.
  const [userLocation, setUserLocation] = useState<Coordinates>(DEFAULT_CENTER)
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
          ['in-person', 'hybrid'].includes((group.type as string | undefined) || 'virtual'))

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
              .filter(Boolean) as string[]))
      } catch (error) {
        console.error('Failed to load nearby support groups:', error)
      } finally {
        setLoading(false)
      }
    }

    void loadNearbyGroups()
  }, [user])

  useEffect(() => {
    if (!navigator.geolocation) {
      setUserLocation(DEFAULT_CENTER)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      // Denied or timed out → fall back to the default center so places still load.
      () => setUserLocation(DEFAULT_CENTER),
      { enableHighAccuracy: true, timeout: 10_000 })
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
          })))
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
        (keyword) => keyword.includes(query) || query.includes(keyword))
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
        'walking')
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
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-background/45">
                Nearby support
              </p>
              <h1 className="mt-2 text-2xl font-bold text-brand-background sm:text-3xl">
                In-person and hybrid groups near you
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-background/65">
                Community groups that meet in person, mapped alongside the care directory so you can find one close by.
              </p>
            </div>
            <div className="w-full max-w-sm">
              <div className="relative">
                <i
                  className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-brand-background/40"
                  aria-hidden="true"
                />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="pl-11"
                  aria-label="Search by group, category, or venue"
                  placeholder="Search by group, category, or venue"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Sort support groups">
            {([
              { value: 'distance' as SortOption, label: 'Nearest' },
              { value: 'popularity' as SortOption, label: 'Popular' },
              { value: 'recent' as SortOption, label: 'Recent' },
            ]).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={sortBy === option.value}
                onClick={() => setSortBy(option.value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 ${
                  sortBy === option.value ? 'tab-active' : 'bg-brand-background/[0.08] text-brand-background/60 hover:text-brand-background/90'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Card>

        <div className="page-grid lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,26rem)] lg:items-start">
          <section className="space-y-4">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-brand-background/55">
                  {formatCompactNumber(visibleMarkers.length)} result{visibleMarkers.length === 1 ? '' : 's'} on the map
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => void handleRouteRequest()}
                    disabled={!selectedMarker || !userLocation || routing}
                    isLoading={routing}
                    leadingIcon={!routing ? <i className="ri-walk-line" aria-hidden="true" /> : undefined}
                  >
                    {routing ? 'Routing…' : 'Walk from me'}
                  </Button>
                  {directions && (
                    <Button variant="secondary" onClick={() => setDirections(null)}>
                      Clear route
                    </Button>
                  )}
                </div>
              </div>

              {directions && (
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <Badge>{directions.distanceKm.toFixed(1)} km</Badge>
                  <Badge>{directions.durationMinutes} min walk</Badge>
                </div>
              )}
            </Card>

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
              <Card>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-brand-accent3/20 text-brand-accent3">Nearby support</Badge>
                  {selectedMarker.source && <Badge>{selectedMarker.source}</Badge>}
                </div>
                <h2 className="mt-4 text-xl font-semibold text-brand-background">{selectedMarker.title}</h2>
                {selectedMarker.subtitle && (
                  <p className="mt-1 text-sm text-brand-background/55">{selectedMarker.subtitle}</p>
                )}
                {selectedMarker.description && (
                  <p className="mt-4 text-sm leading-relaxed text-brand-background/70">{selectedMarker.description}</p>
                )}
                <div className="mt-4 space-y-2 text-sm text-brand-background/65">
                  {selectedMarker.address && (
                    <p className="flex items-start gap-2">
                      <i className="ri-map-pin-line mt-0.5 text-brand-background/40" aria-hidden="true" />
                      <span>{selectedMarker.address}</span>
                    </p>
                  )}
                  {selectedMarker.distanceKm != null && (
                    <p className="flex items-center gap-2">
                      <i className="ri-route-line text-brand-background/40" aria-hidden="true" />
                      <span>{selectedMarker.distanceKm.toFixed(1)} km away</span>
                    </p>
                  )}
                </div>
                {selectedMarker.source === 'community' ? (
                  <div className="mt-5 flex gap-2">
                    <Button
                      fullWidth
                      onClick={() => handleJoinGroup(selectedMarker.id)}
                      disabled={joinedGroupIds.has(selectedMarker.id) || !user}
                      leadingIcon={
                        joinedGroupIds.has(selectedMarker.id) ? <i className="ri-check-line" aria-hidden="true" /> : undefined
                      }
                    >
                      {joinedGroupIds.has(selectedMarker.id) ? 'Joined' : user ? 'Join group' : 'Sign in to join'}
                    </Button>
                    <LinkButton href="/groups" variant="secondary" fullWidth>
                      Open groups
                    </LinkButton>
                  </div>
                ) : (
                  <div className="mt-5">
                    <LinkButton href="/map?type=group" variant="secondary" fullWidth>
                      Open full support map
                    </LinkButton>
                  </div>
                )}
              </Card>
            )}

            <Card>
              <h2 className="mb-3 text-lg font-bold text-brand-background">Support list</h2>
              <div className="space-y-3">
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-28 rounded-2xl" />
                  ))
                ) : visibleMarkers.length > 0 ? (
                  visibleMarkers.map((marker) => {
                    const relatedGroup = groups.find((group) => group.id === marker.id)
                    const nextMeetingAt = relatedGroup?.next_meeting_at

                    return (
                      <button
                        key={marker.id}
                        type="button"
                        onClick={() => setSelectedMarkerId(marker.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 ${
                          selectedMarker?.id === marker.id
                            ? 'border-brand-accent3/30 bg-brand-accent3/10'
                            : 'border-brand-background/10 bg-brand-background/[0.04] hover:bg-brand-background/[0.08]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-brand-background">{marker.title}</p>
                            {marker.subtitle && (
                              <p className="mt-1 text-xs text-brand-background/45">{marker.subtitle}</p>
                            )}
                          </div>
                          {marker.distanceKm != null && (
                            <Badge className="shrink-0 text-[10px]">{marker.distanceKm.toFixed(1)} km</Badge>
                          )}
                        </div>
                        {marker.address && (
                          <p className="mt-3 line-clamp-2 text-sm text-brand-background/60">{marker.address}</p>
                        )}
                        {Boolean(nextMeetingAt) && (
                          <p className="mt-2 flex items-center gap-1.5 text-xs text-brand-accent2">
                            <i className="ri-calendar-event-line" aria-hidden="true" />
                            Next meeting {formatRelativeTime(nextMeetingAt)}
                          </p>
                        )}
                      </button>
                    )
                  })
                ) : (
                  <EmptyState
                    icon={<i className="ri-map-pin-2-line text-4xl" aria-hidden="true" />}
                    title="No groups nearby yet"
                    description="No in-person groups matched that filter. Try a broader search or check back soon."
                  />
                )}
              </div>
            </Card>
          </aside>
        </div>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
