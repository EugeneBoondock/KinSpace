'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import KinMap from '@/components/maps/KinMap'
import PageFrame from '@/components/PageFrame'
import { Badge, Button, Card, EmptyState, Input, LinkButton, Skeleton } from '@/components/ui'
import { DatabaseService } from '@/lib/database'
import { geocodeQueries, getMapDirections, getNearbyFallbackPlaces, searchMapPlaces } from '@/lib/map-client'
import { parseCareMapDestination } from '@/lib/map-links'
import { parseCoordinateString, formatStepDistance, type Coordinates, type MapDirectionsResult, type MapSearchResult, type SupportMapMarker } from '@/lib/map'
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

// SA-first fallback so the map still shows nearby places before (or without)
// the user granting geolocation. Johannesburg city centre.
const DEFAULT_CENTER: Coordinates = { latitude: -26.2041, longitude: 28.0473 }

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

// Best-effort spoken turn-by-turn guidance (Web Speech API). No-ops when unsupported.
function speakDirection(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  } catch {
    // voice guidance is best-effort; the on-screen steps still work
  }
}

// How near (metres) the user must be to a maneuver before advancing to the next step.
const STEP_ADVANCE_METERS = 30

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
  const [navigating, setNavigating] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [autoRoutedDestinationId, setAutoRoutedDestinationId] = useState<string | null>(null)

  useEffect(() => {
    const requestedType = searchParams.get('type')
    if (requestedType === 'doctor' || requestedType === 'pharmacy' || requestedType === 'group') {
      setActiveTab(requestedType)
    }
  }, [searchParams])

  const linkedDestination = useMemo(() => parseCareMapDestination(searchParams), [searchParams])

  useEffect(() => {
    if (!linkedDestination) return
    setSearchMarker(linkedDestination)
    setSelectedMarkerId(linkedDestination.id)
    setQuery(linkedDestination.title)
    setPlaceSuggestions([])
  }, [linkedDestination])

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

  // Live location: watchPosition keeps the "you" marker and routing origin moving
  // as the user travels (powers live navigation), not just a one-shot fix.
  useEffect(() => {
    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocationEnabled(true)
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      () => setLocationEnabled(false),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // Center nearby-place search on the user's location when granted, otherwise on
  // a place they searched, otherwise on the SA-first default. This guarantees the
  // map shows doctors/pharmacies/groups even when geolocation is off or denied.
  const centerLat = userLocation?.latitude ?? searchMarker?.latitude ?? DEFAULT_CENTER.latitude
  const centerLng = userLocation?.longitude ?? searchMarker?.longitude ?? DEFAULT_CENTER.longitude

  useEffect(() => {
    let active = true
    const currentLocation: Coordinates = { latitude: centerLat, longitude: centerLng }

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
  }, [activeTab, centerLat, centerLng])

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
    setNavigating(false)
  }, [activeTab, selectedMarkerId])

  // A fresh route starts guidance at step one.
  useEffect(() => {
    setCurrentStepIndex(0)
  }, [directions])

  // Live turn-by-turn: as the user nears the current maneuver, advance the step.
  useEffect(() => {
    if (!navigating || !userLocation || !directions?.steps?.length) return
    const steps = directions.steps
    const index = Math.min(currentStepIndex, steps.length - 1)
    const step = steps[index]
    const metersToStep =
      getDistanceKm(userLocation.latitude, userLocation.longitude, step.latitude, step.longitude) * 1000
    if (metersToStep < STEP_ADVANCE_METERS && index < steps.length - 1) {
      setCurrentStepIndex(index + 1)
    }
  }, [userLocation, navigating, directions, currentStepIndex])

  // Speak the active step whenever it changes (and when navigation starts).
  useEffect(() => {
    if (!navigating || !directions?.steps?.length) return
    const step = directions.steps[Math.min(currentStepIndex, directions.steps.length - 1)]
    if (step) speakDirection(step.instruction)
  }, [navigating, currentStepIndex, directions])

  // Cancel any speech the moment navigation stops.
  useEffect(() => {
    if (!navigating && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }, [navigating])

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

  const requestRoute = useCallback(async (destination: SupportMapMarker) => {
    if (!userLocation) return
    setRouting(true)
    try {
      const result = await getMapDirections(
        userLocation,
        { latitude: destination.latitude, longitude: destination.longitude },
        destination.kind === 'group' ? 'walking' : 'driving',
      )
      setDirections(result)
    } catch (error) {
      console.error('Failed to build route:', error)
    } finally {
      setRouting(false)
    }
  }, [userLocation])

  useEffect(() => {
    if (!linkedDestination || !userLocation || autoRoutedDestinationId === linkedDestination.id) return
    setAutoRoutedDestinationId(linkedDestination.id)
    void requestRoute(linkedDestination)
  }, [autoRoutedDestinationId, linkedDestination, requestRoute, userLocation])

  async function handleRouteRequest() {
    if (!selectedMarker) return
    await requestRoute(selectedMarker)
  }

  return (
    <PageFrame>
      <div className="page-grid">
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-background/45">
                Care map
              </p>
              <h1 className="mt-2 text-2xl font-bold text-brand-background sm:text-3xl">
                Find doctors, pharmacies, and support near you
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-background/65">
                Search verified listings, see nearby places from OpenStreetMap, and get directions -
                all without leaving KinSpace.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-brand-background/10 bg-brand-background/[0.06] px-4 py-3">
              <i
                className={locationEnabled ? 'ri-map-pin-user-line text-brand-accent3' : 'ri-map-pin-off-line text-brand-background/40'}
                aria-hidden="true"
              />
              <div>
                <p className="text-xs text-brand-background/45">Location</p>
                <p className="text-sm font-semibold text-brand-background">
                  {locationEnabled ? 'On - showing nearby' : 'Off'}
                </p>
              </div>
            </div>
          </div>

          <div
            className="mt-6 flex gap-2 overflow-x-auto rounded-2xl bg-brand-background/5 p-1.5"
            role="tablist"
            aria-label="Browse care directory"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 ${
                  activeTab === tab.id ? 'tab-active' : 'tab-inactive'
                }`}
              >
                <i className={tab.icon} aria-hidden="true" />
                {tab.label}
              </button>
            ))}
          </div>
        </Card>

        <div className="page-grid lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,26rem)] lg:items-start">
          <section className="space-y-4">
            <Card>
              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative flex-1">
                  <i
                    className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-brand-background/40"
                    aria-hidden="true"
                  />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="pl-11"
                    aria-label="Search places, addresses, specialties, or group names"
                    placeholder="Search places, addresses, or specialties"
                  />

                  {placeSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-2xl border border-brand-background/10 bg-brand-dark p-2 shadow-2xl">
                      {placeSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => void handleSelectSuggestion(suggestion)}
                          className="flex w-full flex-col rounded-xl px-4 py-3 text-left transition-colors hover:bg-brand-background/[0.06] focus-visible:outline-none focus-visible:bg-brand-background/[0.06]"
                        >
                          <span className="text-sm font-semibold text-brand-background">{suggestion.label}</span>
                          {suggestion.subtitle && (
                            <span className="mt-1 text-xs text-brand-background/45">{suggestion.subtitle}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery('')
                      setSearchMarker(null)
                      setPlaceSuggestions([])
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    onClick={() => void handleRouteRequest()}
                    disabled={!locationEnabled || !selectedMarker || routing}
                    isLoading={routing}
                    leadingIcon={!routing ? <i className="ri-route-line" aria-hidden="true" /> : undefined}
                  >
                    {routing ? 'Routing…' : 'Route from me'}
                  </Button>
                </div>
              </div>

              {directions && (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge>{directions.distanceKm.toFixed(1)} km</Badge>
                    <Badge>{directions.durationMinutes} min</Badge>
                    {directions.steps && directions.steps.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setNavigating((value) => !value)}
                        aria-pressed={navigating}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 ${
                          navigating
                            ? 'bg-brand-accent3/20 text-brand-accent3'
                            : 'bg-brand-background/10 text-brand-background/70 hover:bg-brand-background/15'
                        }`}
                      >
                        <i className={navigating ? 'ri-volume-up-line' : 'ri-navigation-line'} aria-hidden="true" />
                        {navigating ? 'Navigating · voice on' : 'Start live navigation'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setNavigating(false)
                        setDirections(null)
                      }}
                      className="font-medium text-brand-accent2 hover:text-brand-accent2/80"
                    >
                      Clear route
                    </button>
                  </div>

                  {directions.steps && directions.steps.length > 0 && (
                    <ol className="max-h-64 space-y-1.5 overflow-y-auto rounded-2xl border border-brand-background/10 bg-brand-background/[0.04] p-2">
                      {directions.steps.map((step, index) => {
                        const active = navigating && index === Math.min(currentStepIndex, directions.steps!.length - 1)
                        return (
                          <li
                            key={index}
                            className={`flex items-start gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                              active ? 'bg-brand-accent3/15 text-brand-background' : 'text-brand-background/70'
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                active ? 'bg-brand-accent3 text-brand-dark' : 'bg-brand-background/10 text-brand-background/60'
                              }`}
                            >
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block">{step.instruction}</span>
                              {step.distanceMeters > 0 && (
                                <span className="text-xs text-brand-background/45">
                                  {formatStepDistance(step.distanceMeters)}
                                </span>
                              )}
                            </span>
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </div>
              )}
            </Card>

            <KinMap
              markers={visibleMarkers}
              selectedMarkerId={selectedMarker?.id}
              userLocation={userLocation}
              directions={directions}
              followUser={navigating}
              onSelectMarker={setSelectedMarkerId}
            />
          </section>

          <aside className="space-y-4">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-brand-background">Results</h2>
                <Badge>{formatCompactNumber(visibleMarkers.length)}</Badge>
              </div>

              <div className="mt-4 space-y-3">
                {selectedMarker && (
                  <div className="rounded-2xl border border-brand-accent2/25 bg-brand-accent2/[0.08] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-brand-accent2/20 text-brand-accent2">Selected</Badge>
                      {selectedMarker.source && <Badge>{selectedMarker.source}</Badge>}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-brand-background">{selectedMarker.title}</h3>
                    {selectedMarker.subtitle && (
                      <p className="mt-1 text-sm text-brand-background/55">{selectedMarker.subtitle}</p>
                    )}
                    {selectedMarker.description && (
                      <p className="mt-3 text-sm leading-relaxed text-brand-background/70">{selectedMarker.description}</p>
                    )}
                    <div className="mt-4 space-y-2 text-sm text-brand-background/65">
                      {selectedMarker.address && (
                        <p className="flex items-start gap-2">
                          <i className="ri-map-pin-line mt-0.5 text-brand-background/40" aria-hidden="true" />
                          <span>{selectedMarker.address}</span>
                        </p>
                      )}
                      {selectedMarker.phone && (
                        <p className="flex items-center gap-2">
                          <i className="ri-phone-line text-brand-background/40" aria-hidden="true" />
                          <span>{selectedMarker.phone}</span>
                        </p>
                      )}
                      {selectedMarker.hours && (
                        <p className="flex items-center gap-2">
                          <i className="ri-time-line text-brand-background/40" aria-hidden="true" />
                          <span>{selectedMarker.hours}</span>
                        </p>
                      )}
                      {selectedMarker.distanceKm != null && (
                        <p className="flex items-center gap-2">
                          <i className="ri-route-line text-brand-background/40" aria-hidden="true" />
                          <span>{selectedMarker.distanceKm.toFixed(1)} km away</span>
                        </p>
                      )}
                    </div>
                    <div className="mt-4 flex gap-2">
                      {selectedMarker.phone ? (
                        <LinkButton
                          href={`tel:${selectedMarker.phone.replace(/\s+/g, '')}`}
                          external
                          fullWidth
                          leadingIcon={<i className="ri-phone-line" aria-hidden="true" />}
                        >
                          Call
                        </LinkButton>
                      ) : null}
                      {selectedMarker.href ? (
                        <LinkButton href={selectedMarker.href} variant="secondary" fullWidth>
                          Open
                        </LinkButton>
                      ) : null}
                    </div>
                  </div>
                )}

                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-28 rounded-2xl" />
                  ))
                ) : visibleMarkers.length > 0 ? (
                  visibleMarkers.map((marker) => (
                    <button
                      key={marker.id}
                      type="button"
                      onClick={() => setSelectedMarkerId(marker.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 ${
                        selectedMarker?.id === marker.id
                          ? 'border-brand-accent2/35 bg-brand-accent2/10'
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
                    </button>
                  ))
                ) : (
                  <EmptyState
                    icon={<i className="ri-map-pin-2-line text-4xl" aria-hidden="true" />}
                    title="Nothing here yet"
                    description={
                      !locationEnabled && activeTab !== 'group'
                        ? 'No matches in this area. Turn on location access to find nearby places automatically.'
                        : 'No places matched that search in the current map view. Try a different term.'
                    }
                  />
                )}
              </div>
            </Card>

            <Card>
              <h2 className="mb-3 text-lg font-bold text-brand-background">Coverage</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-brand-background/10 bg-brand-background/[0.06] p-4">
                  <p className="text-xs text-brand-background/45">Verified listings</p>
                  <p className="mt-1 text-lg font-semibold text-brand-background">
                    {formatCompactNumber(directoryMarkers[activeTab].length)}
                  </p>
                </div>
                <div className="rounded-xl border border-brand-background/10 bg-brand-background/[0.06] p-4">
                  <p className="text-xs text-brand-background/45">Nearby places</p>
                  <p className="mt-1 text-lg font-semibold text-brand-background">
                    {loadingFallback ? 'Loading…' : formatCompactNumber(fallbackMarkers[activeTab].length)}
                  </p>
                </div>
              </div>
            </Card>
          </aside>
        </div>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
