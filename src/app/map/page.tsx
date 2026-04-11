'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import KinMap from '@/components/maps/KinMap'
import PageFrame from '@/components/PageFrame'
import { DatabaseService } from '@/lib/database'
import { geocodeQueries, getMapDirections, getNearbyFallbackPlaces, searchMapPlaces } from '@/lib/map-client'
import { parseCoordinateString, type Coordinates, type MapDirectionsResult, type MapSearchResult, type SupportMapMarker } from '@/lib/map'
import { formatCompactNumber, getDistanceKm, normalizeKeywords } from '@/lib/platform'

type DirectoryTab = 'doctor' | 'pharmacy' | 'group'

type SupportLocation = Record<string, unknown> & {
  id: string
  name?: string
  type?: string
  specialty?: string
  address?: string
  hours?: string
  phone?: string
  rating?: number
  is_open?: boolean
  latitude?: number
  longitude?: number
}

type Group = Record<string, unknown> & { id: string }

const tabs: Array<{ id: DirectoryTab; label: string; icon: string }> = [
  { id: 'doctor', label: 'Doctors', icon: 'ri-stethoscope-line' },
  { id: 'pharmacy', label: 'Pharmacies', icon: 'ri-capsule-line' },
  { id: 'group', label: 'Support groups', icon: 'ri-group-line' },
]

function toCoordinates(record: Record<string, unknown> & { latitude?: number; longitude?: number }) {
  if (typeof record.latitude === 'number' && typeof record.longitude === 'number') {
    return {
      latitude: record.latitude,
      longitude: record.longitude,
    }
  }

  const parsed = parseCoordinateString(record.location as string | undefined)
  return parsed
}

function buildSupportLocationQuery(location: SupportLocation) {
  return [location.name, location.address, location.specialty].filter(Boolean).join(', ')
}

function buildGroupLocationQuery(group: Group) {
  return [group.location, group.name].filter(Boolean).join(', ')
}

function dedupeMarkers(markers: SupportMapMarker[]) {
  const seen = new Set<string>()
  return markers.filter((marker) => {
    const key = `${marker.kind}:${marker.title.toLowerCase()}:${marker.latitude.toFixed(4)}:${marker.longitude.toFixed(4)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export default function MapPage() {
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<DirectoryTab>('doctor')
  const [directoryMarkers, setDirectoryMarkers] = useState<Record<DirectoryTab, SupportMapMarker[]>>({
    doctor: [],
    pharmacy: [],
    group: [],
  })
  const [fallbackMarkers, setFallbackMarkers] = useState<Record<DirectoryTab, SupportMapMarker[]>>({
    doctor: [],
    pharmacy: [],
    group: [],
  })
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null)
  const [locationEnabled, setLocationEnabled] = useState(false)
  const [query, setQuery] = useState('')
  const [placeSuggestions, setPlaceSuggestions] = useState<MapSearchResult[]>([])
  const [searchMarker, setSearchMarker] = useState<SupportMapMarker | null>(null)
  const [directions, setDirections] = useState<MapDirectionsResult | null>(null)
  const [routing, setRouting] = useState(false)
  const [loadingFallback, setLoadingFallback] = useState(false)

  useEffect(() => {
    const requestedType = searchParams.get('type')
    if (requestedType === 'doctor' || requestedType === 'pharmacy' || requestedType === 'group') {
      setActiveTab(requestedType)
    }
  }, [searchParams])

  useEffect(() => {
    async function loadDirectoryData() {
      try {
        const [locations, groups] = await Promise.all([
          DatabaseService.getSupportLocations(),
          DatabaseService.getGroups(),
        ])

        const typedLocations = locations as SupportLocation[]
        const typedGroups = (groups as Group[]).filter((group) =>
          ['in-person', 'hybrid'].includes((group.type as string | undefined) || 'virtual'),
        )

        const geocodeTargets = [
          ...typedLocations
            .filter((location) => !toCoordinates(location) && buildSupportLocationQuery(location))
            .map((location) => buildSupportLocationQuery(location)),
          ...typedGroups
            .filter((group) => !toCoordinates(group) && buildGroupLocationQuery(group))
            .map((group) => buildGroupLocationQuery(group)),
        ]

        const geocodes = await geocodeQueries(geocodeTargets)

        const doctors = typedLocations
          .filter((location) => location.type === 'doctor')
          .map((location) => {
            const coordinates = toCoordinates(location) || geocodes.get(buildSupportLocationQuery(location))
            if (!coordinates) return null

            return {
              id: location.id,
              kind: 'doctor',
              title: (location.name as string | undefined) || 'Doctor',
              subtitle: (location.specialty as string | undefined) || 'Care provider',
              description: (location.address as string | undefined) || 'Published support directory entry',
              address: location.address as string | undefined,
              phone: location.phone as string | undefined,
              hours: location.hours as string | undefined,
              rating: location.rating as number | undefined,
              isOpen: location.is_open as boolean | undefined,
              latitude: coordinates.latitude,
              longitude: coordinates.longitude,
              source: 'directory',
              tags: [location.specialty as string | undefined].filter(Boolean) as string[],
            } satisfies SupportMapMarker
          })
          .filter(Boolean) as SupportMapMarker[]

        const pharmacies = typedLocations
          .filter((location) => location.type === 'pharmacy')
          .map((location) => {
            const coordinates = toCoordinates(location) || geocodes.get(buildSupportLocationQuery(location))
            if (!coordinates) return null

            return {
              id: location.id,
              kind: 'pharmacy',
              title: (location.name as string | undefined) || 'Pharmacy',
              subtitle: (location.specialty as string | undefined) || 'Medication support',
              description: (location.address as string | undefined) || 'Published pharmacy listing',
              address: location.address as string | undefined,
              phone: location.phone as string | undefined,
              hours: location.hours as string | undefined,
              rating: location.rating as number | undefined,
              isOpen: location.is_open as boolean | undefined,
              latitude: coordinates.latitude,
              longitude: coordinates.longitude,
              source: 'directory',
              tags: [location.specialty as string | undefined].filter(Boolean) as string[],
            } satisfies SupportMapMarker
          })
          .filter(Boolean) as SupportMapMarker[]

        const supportGroups = typedGroups
          .map((group) => {
            const coordinates = toCoordinates(group) || geocodes.get(buildGroupLocationQuery(group))
            if (!coordinates) return null

            return {
              id: group.id,
              kind: 'group',
              title: (group.name as string | undefined) || 'Support group',
              subtitle: `${(group.category as string | undefined) || 'general'} · ${((group.type as string | undefined) || 'virtual')}`,
              description: (group.description as string | undefined) || 'Community support group',
              address: group.location as string | undefined,
              latitude: coordinates.latitude,
              longitude: coordinates.longitude,
              source: 'community',
              href: '/groups',
              tags: Array.isArray(group.tags) ? (group.tags as string[]) : [],
            } satisfies SupportMapMarker
          })
          .filter(Boolean) as SupportMapMarker[]

        setDirectoryMarkers({
          doctor: dedupeMarkers(doctors),
          pharmacy: dedupeMarkers(pharmacies),
          group: dedupeMarkers(supportGroups),
        })
      } catch (error) {
        console.error('Failed to load native map directory:', error)
      } finally {
        setLoading(false)
      }
    }

    void loadDirectoryData()
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationEnabled(true)
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      () => setLocationEnabled(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }, [])

  useEffect(() => {
    if (!userLocation) return

    let active = true
    const currentLocation = userLocation

    async function loadFallback() {
      setLoadingFallback(true)
      try {
        const results = await getNearbyFallbackPlaces(
          currentLocation,
          activeTab,
          activeTab === 'group' ? 8000 : 6000,
        )
        if (!active) return

        const markers = (results || []).map((result, index) => ({
          id: `${activeTab}-fallback-${result.id || index}`,
          kind: (result.kind as SupportMapMarker['kind']) || activeTab,
          title: (result.title as string | undefined) || 'Nearby place',
          subtitle: (result.subtitle as string | undefined) || 'OpenStreetMap place',
          description: (result.address as string | undefined) || 'Nearby result found on the map',
          address: result.address as string | undefined,
          phone: result.phone as string | undefined,
          hours: result.hours as string | undefined,
          latitude: result.latitude as number,
          longitude: result.longitude as number,
          source: 'osm',
          tags: Array.isArray(result.tags) ? (result.tags as string[]) : [],
        })) as SupportMapMarker[]

        setFallbackMarkers((current) => ({
          ...current,
          [activeTab]: dedupeMarkers(markers),
        }))
      } catch (error) {
        console.error('Failed to load fallback map places:', error)
      } finally {
        if (active) setLoadingFallback(false)
      }
    }

    void loadFallback()

    return () => {
      active = false
    }
  }, [activeTab, userLocation])

  useEffect(() => {
    if (query.trim().length < 3) {
      setPlaceSuggestions([])
      return
    }

    const timeout = window.setTimeout(async () => {
      try {
        const results = await searchMapPlaces(query.trim())
        setPlaceSuggestions(results)
      } catch (error) {
        console.error('Failed to search map places:', error)
      }
    }, 260)

    return () => window.clearTimeout(timeout)
  }, [query])

  const mergedMarkers = useMemo(() => {
    const markers = [...directoryMarkers[activeTab], ...(fallbackMarkers[activeTab] || [])]

    const withDistance = markers.map((marker) => ({
      ...marker,
      distanceKm:
        userLocation
          ? getDistanceKm(userLocation.latitude, userLocation.longitude, marker.latitude, marker.longitude)
          : null,
    }))

    return dedupeMarkers(withDistance).sort((first, second) => {
      if (first.distanceKm == null && second.distanceKm == null) return first.title.localeCompare(second.title)
      if (first.distanceKm == null) return 1
      if (second.distanceKm == null) return -1
      return first.distanceKm - second.distanceKm
    })
  }, [activeTab, directoryMarkers, fallbackMarkers, userLocation])

  const visibleMarkers = useMemo(() => {
    const haystackQuery = query.trim().toLowerCase()
    const markers = searchMarker ? [searchMarker, ...mergedMarkers] : mergedMarkers

    if (!haystackQuery) return markers

    return markers.filter((marker) =>
      normalizeKeywords(
        marker.title,
        marker.subtitle,
        marker.description,
        marker.address,
        marker.tags,
      ).some((keyword) => keyword.includes(haystackQuery) || haystackQuery.includes(keyword)),
    )
  }, [mergedMarkers, query, searchMarker])

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
    const requestedFocus = searchParams.get('focus')
    if (requestedFocus && visibleMarkers.some((marker) => marker.id === requestedFocus)) {
      setSelectedMarkerId(requestedFocus)
    }
  }, [searchParams, visibleMarkers])

  useEffect(() => {
    setDirections(null)
  }, [activeTab, selectedMarkerId])

  async function handleSelectSuggestion(result: MapSearchResult) {
    const marker: SupportMapMarker = {
      id: `search-${result.id}`,
      kind: 'search',
      title: result.label,
      subtitle: result.subtitle,
      description: 'Location searched from inside KinSpace',
      latitude: result.latitude,
      longitude: result.longitude,
      source: 'search',
    }

    setSearchMarker(marker)
    setSelectedMarkerId(marker.id)
    setQuery(result.label)
    setPlaceSuggestions([])
  }

  async function handleRouteRequest() {
    if (!selectedMarker || !userLocation) return

    setRouting(true)
    try {
      const result = await getMapDirections(
        userLocation,
        { latitude: selectedMarker.latitude, longitude: selectedMarker.longitude },
        activeTab === 'group' ? 'walking' : 'driving',
      )
      setDirections(result)
    } catch (error) {
      console.error('Failed to build route:', error)
    } finally {
      setRouting(false)
    }
  }

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
                Native map
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Doctors, pharmacies, and support on our own map</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#eedfc8]/60">
                KinSpace now keeps care discovery inside the product with live directory entries,
                nearby OpenStreetMap fallbacks, place search, and in-app routing.
              </p>
            </div>
            <div className="card-light !p-4">
              <p className="text-xs text-[#eedfc8]/45">Location access</p>
              <p className="mt-1 text-sm font-semibold text-[#eedfc8]">
                {locationEnabled ? 'Enabled for nearby results' : 'Off'}
              </p>
            </div>
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto rounded-2xl bg-[#eedfc8]/5 p-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-w-fit items-center gap-2 rounded-2xl px-4 py-2.5 text-sm transition-all ${
                  activeTab === tab.id ? 'tab-active' : 'tab-inactive'
                }`}
              >
                <i className={tab.icon} />
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        <div className="page-grid lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,26rem)] lg:items-start">
          <section className="space-y-4">
            <div className="card">
              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative flex-1">
                  <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-[#eedfc8]/35" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="input-field !pl-11"
                    placeholder="Search places, addresses, specialties, or group names"
                  />

                  {placeSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-3xl border border-[#eedfc8]/10 bg-[#24423b] p-2 shadow-2xl">
                      {placeSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          onClick={() => void handleSelectSuggestion(suggestion)}
                          className="flex w-full flex-col rounded-2xl px-4 py-3 text-left transition-colors hover:bg-[#eedfc8]/6"
                        >
                          <span className="text-sm font-semibold text-[#eedfc8]">{suggestion.label}</span>
                          {suggestion.subtitle && (
                            <span className="mt-1 text-xs text-[#eedfc8]/45">{suggestion.subtitle}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setQuery('')
                      setSearchMarker(null)
                      setPlaceSuggestions([])
                    }}
                    className="btn-secondary !rounded-2xl !px-4 !py-3 text-sm"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => void handleRouteRequest()}
                    disabled={!locationEnabled || !selectedMarker || routing}
                    className="btn-primary !rounded-2xl !px-4 !py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {routing ? 'Routing...' : 'Route from me'}
                  </button>
                </div>
              </div>

              {directions && (
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-[#eedfc8]/55">
                  <span className="badge">{directions.distanceKm.toFixed(1)} km</span>
                  <span className="badge">{directions.durationMinutes} min</span>
                  <button onClick={() => setDirections(null)} className="text-[#D19A58]">
                    Clear route
                  </button>
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
            <section className="card">
              <div className="flex items-center justify-between gap-3">
                <h2 className="section-title !mb-0">Results</h2>
                <span className="text-sm text-[#eedfc8]/45">
                  {formatCompactNumber(visibleMarkers.length)}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {selectedMarker && (
                  <div className="rounded-[1.5rem] border border-[#D19A58]/20 bg-[#D19A58]/8 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge bg-[#D19A58]/18 text-[#D19A58]">Selected</span>
                      {selectedMarker.source && <span className="badge">{selectedMarker.source}</span>}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-[#eedfc8]">{selectedMarker.title}</h3>
                    {selectedMarker.subtitle && (
                      <p className="mt-1 text-sm text-[#eedfc8]/55">{selectedMarker.subtitle}</p>
                    )}
                    {selectedMarker.description && (
                      <p className="mt-3 text-sm leading-relaxed text-[#eedfc8]/70">{selectedMarker.description}</p>
                    )}
                    <div className="mt-4 space-y-2 text-sm text-[#eedfc8]/60">
                      {selectedMarker.address && (
                        <p>
                          <i className="ri-map-pin-line mr-1.5 text-[#eedfc8]/35" />
                          {selectedMarker.address}
                        </p>
                      )}
                      {selectedMarker.phone && (
                        <p>
                          <i className="ri-phone-line mr-1.5 text-[#eedfc8]/35" />
                          {selectedMarker.phone}
                        </p>
                      )}
                      {selectedMarker.hours && (
                        <p>
                          <i className="ri-time-line mr-1.5 text-[#eedfc8]/35" />
                          {selectedMarker.hours}
                        </p>
                      )}
                      {selectedMarker.distanceKm != null && (
                        <p>
                          <i className="ri-route-line mr-1.5 text-[#eedfc8]/35" />
                          {selectedMarker.distanceKm.toFixed(1)} km away
                        </p>
                      )}
                    </div>
                    <div className="mt-4 flex gap-2">
                      {selectedMarker.phone ? (
                        <a
                          href={`tel:${selectedMarker.phone.replace(/\s+/g, '')}`}
                          className="btn-primary flex-1 !rounded-2xl !py-2.5 text-center text-sm"
                        >
                          Call
                        </a>
                      ) : null}
                      {selectedMarker.href ? (
                        <Link
                          href={selectedMarker.href}
                          className="btn-secondary flex-1 !rounded-2xl !py-2.5 text-center text-sm"
                        >
                          Open
                        </Link>
                      ) : null}
                    </div>
                  </div>
                )}

                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-28 skeleton rounded-3xl" />
                  ))
                ) : visibleMarkers.length > 0 ? (
                  visibleMarkers.map((marker) => (
                    <button
                      key={marker.id}
                      onClick={() => setSelectedMarkerId(marker.id)}
                      className={`w-full rounded-3xl border p-4 text-left transition-all ${
                        selectedMarker?.id === marker.id
                          ? 'border-[#D19A58]/35 bg-[#D19A58]/10'
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
                    </button>
                  ))
                ) : (
                  <div className="card-light text-center">
                    <i className="ri-map-pin-2-line text-4xl text-[#eedfc8]/25" />
                    <p className="mt-3 text-sm text-[#eedfc8]/60">
                      No locations matched that search inside the current map view.
                    </p>
                    {!locationEnabled && activeTab !== 'group' && (
                      <p className="mt-1 text-xs text-[#eedfc8]/40">
                        Turn on location access to unlock nearby OpenStreetMap results.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="card">
              <h2 className="section-title">Coverage</h2>
              <div className="space-y-3">
                <div className="card-light !p-4">
                  <p className="text-xs text-[#eedfc8]/45">Published directory entries</p>
                  <p className="mt-1 text-sm font-semibold text-[#eedfc8]">
                    {formatCompactNumber(directoryMarkers[activeTab].length)}
                  </p>
                </div>
                <div className="card-light !p-4">
                  <p className="text-xs text-[#eedfc8]/45">Nearby fallback results</p>
                  <p className="mt-1 text-sm font-semibold text-[#eedfc8]">
                    {loadingFallback ? 'Loading…' : formatCompactNumber(fallbackMarkers[activeTab].length)}
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
