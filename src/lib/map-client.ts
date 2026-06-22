'use client'

import type { Coordinates, GeocodeResult, MapDirectionsResult, MapSearchResult, MapMarkerKind } from '@/lib/map'

const GEOCODE_CACHE_KEY = 'kinspace-map-geocode-cache-v1'

type GeocodeCache = Record<
  string,
  {
    label: string
    latitude: number
    longitude: number
    cachedAt: number
  }
>

function readGeocodeCache(): GeocodeCache {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(GEOCODE_CACHE_KEY)
    return raw ? (JSON.parse(raw) as GeocodeCache) : {}
  } catch {
    return {}
  }
}

function writeGeocodeCache(cache: GeocodeCache) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // best-effort cache only
  }
}

export async function geocodeQueries(queries: string[]) {
  const uniqueQueries = Array.from(new Set(queries.map((query) => query.trim()).filter(Boolean)))
  if (uniqueQueries.length === 0) return new Map<string, GeocodeResult>()

  const cache = readGeocodeCache()
  const now = Date.now()
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000
  const results = new Map<string, GeocodeResult>()
  const missing: string[] = []

  uniqueQueries.forEach((query) => {
    const cached = cache[query.toLowerCase()]
    if (cached && now - cached.cachedAt < oneWeekMs) {
      results.set(query, {
        query,
        label: cached.label,
        latitude: cached.latitude,
        longitude: cached.longitude,
      })
      return
    }
    missing.push(query)
  })

  if (missing.length > 0) {
    const response = await fetch('/api/map/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: missing }),
    })

    if (!response.ok) {
      throw new Error('Unable to geocode map locations')
    }

    const payload = (await response.json()) as { results: GeocodeResult[] }
    payload.results.forEach((result) => {
      results.set(result.query, result)
      cache[result.query.toLowerCase()] = {
        label: result.label,
        latitude: result.latitude,
        longitude: result.longitude,
        cachedAt: now,
      }
    })
    writeGeocodeCache(cache)
  }

  return results
}

export async function searchMapPlaces(query: string) {
  const response = await fetch(`/api/map/search?q=${encodeURIComponent(query)}`)
  if (!response.ok) {
    throw new Error('Unable to search places')
  }

  const payload = (await response.json()) as { results: MapSearchResult[] }
  return payload.results
}

export async function getMapDirections(
  origin: Coordinates,
  destination: Coordinates,
  profile: 'walking' | 'driving' = 'driving',
) {
  const search = new URLSearchParams({
    originLat: String(origin.latitude),
    originLng: String(origin.longitude),
    destinationLat: String(destination.latitude),
    destinationLng: String(destination.longitude),
    profile,
  })

  const response = await fetch(`/api/map/directions?${search.toString()}`)
  if (!response.ok) {
    throw new Error('Unable to load route')
  }

  const payload = (await response.json()) as { route: MapDirectionsResult | null }
  return payload.route
}

export async function getNearbyFallbackPlaces(
  location: Coordinates,
  kind: Extract<MapMarkerKind, 'doctor' | 'pharmacy' | 'group'>,
  radiusMeters = 6000,
) {
  const search = new URLSearchParams({
    lat: String(location.latitude),
    lng: String(location.longitude),
    kind,
    radius: String(radiusMeters),
  })

  const response = await fetch(`/api/map/places?${search.toString()}`)
  if (!response.ok) {
    return []
  }

  const payload = await response.json()
  return payload.results as Array<Record<string, unknown>>
}
