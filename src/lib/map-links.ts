import type { MapMarkerKind, SupportMapMarker } from '@/lib/map'

type MapDirectoryTab = Extract<MapMarkerKind, 'doctor' | 'pharmacy' | 'group'>

export type CareDirectionsPlace = {
  title: string
  address?: string | null
  latitude: number
  longitude: number
  kind: string
}

const DESTINATION_KINDS = new Set<MapMarkerKind>(['doctor', 'pharmacy', 'group', 'clinic', 'hospital', 'support', 'search'])

function toFiniteNumber(value: string | null) {
  if (value === null || value.trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function toDirectoryTab(value: string | null): MapDirectoryTab {
  return value === 'pharmacy' || value === 'group' ? value : 'doctor'
}

function toDestinationKind(value: string | null, fallback: MapDirectoryTab): MapMarkerKind {
  return value && DESTINATION_KINDS.has(value as MapMarkerKind) ? (value as MapMarkerKind) : fallback
}

export function mapProviderKind(kind: string): Exclude<MapDirectoryTab, 'group'> {
  return kind === 'pharmacy' ? 'pharmacy' : 'doctor'
}

export function buildCareDirectionsHref(place: CareDirectionsPlace): string {
  const params = new URLSearchParams({
    type: mapProviderKind(place.kind),
    destLat: String(place.latitude),
    destLng: String(place.longitude),
    destName: place.title,
    destKind: place.kind,
  })

  if (place.address) params.set('destAddress', place.address)
  return `/map?${params.toString()}`
}

export function parseCareMapDestination(searchParams: Pick<URLSearchParams, 'get'>): SupportMapMarker | null {
  const latitude = toFiniteNumber(searchParams.get('destLat'))
  const longitude = toFiniteNumber(searchParams.get('destLng'))
  if (latitude === null || longitude === null) return null

  const fallbackKind = toDirectoryTab(searchParams.get('type'))
  const title = searchParams.get('destName')?.trim() || 'Selected destination'
  const address = searchParams.get('destAddress')?.trim() || undefined
  const kind = toDestinationKind(searchParams.get('destKind'), fallbackKind)

  return {
    id: `care-destination-${latitude.toFixed(5)}-${longitude.toFixed(5)}`,
    kind,
    title,
    subtitle: 'Care plan destination',
    description: address || 'Selected from your care plan',
    address,
    latitude,
    longitude,
    source: 'search',
    tags: [kind],
  }
}
