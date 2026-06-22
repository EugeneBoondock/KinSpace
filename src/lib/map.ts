export type Coordinates = {
  latitude: number
  longitude: number
}

export type MapMarkerKind =
  | 'doctor'
  | 'pharmacy'
  | 'group'
  | 'clinic'
  | 'hospital'
  | 'support'
  | 'search'
  | 'user'

export type SupportMapMarker = {
  id: string
  kind: MapMarkerKind
  title: string
  subtitle?: string
  description?: string
  address?: string
  phone?: string
  hours?: string
  source?: 'directory' | 'community' | 'osm' | 'search'
  href?: string
  isOpen?: boolean
  rating?: number
  distanceKm?: number | null
  latitude: number
  longitude: number
  tags?: string[]
}

export type GeocodeResult = {
  query: string
  label: string
  latitude: number
  longitude: number
}

export type MapSearchResult = {
  id: string
  label: string
  subtitle?: string
  latitude: number
  longitude: number
}

export type RouteStep = {
  instruction: string
  distanceMeters: number
  latitude: number
  longitude: number
}

export type MapDirectionsResult = {
  distanceKm: number
  durationMinutes: number
  geometry: Coordinates[]
  steps?: RouteStep[]
}

/** Human-friendly distance for a single navigation step. */
export function formatStepDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return ''
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

export function getMarkerAccent(kind: MapMarkerKind) {
  switch (kind) {
    case 'doctor':
    case 'clinic':
      return { color: '#D19A58', label: 'DR' }
    case 'pharmacy':
      return { color: '#B85C3A', label: 'RX' }
    case 'group':
      return { color: '#6B8A83', label: 'GP' }
    case 'hospital':
      return { color: '#D19A58', label: 'ER' }
    case 'support':
      return { color: '#6B8A83', label: 'SP' }
    case 'search':
      return { color: '#eedfc8', label: 'GO' }
    default:
      return { color: '#eedfc8', label: 'ME' }
  }
}

export function buildCoordinateKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`
}

export function parseCoordinateString(value: string | null | undefined) {
  if (!value) return null
  const match = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
  if (!match) return null

  const latitude = Number(match[1])
  const longitude = Number(match[2])

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  return { latitude, longitude }
}

export function supportsRouteProfile(kind: MapMarkerKind) {
  return kind !== 'search'
}
