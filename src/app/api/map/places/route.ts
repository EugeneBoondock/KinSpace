import { NextRequest, NextResponse } from 'next/server'
import { postOverpass } from '@/lib/server/overpass'

function toNumber(value: string | null) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function getKindQuery(kind: string) {
  switch (kind) {
    case 'doctor':
      return `
        node["amenity"~"doctors|clinic|hospital"](around:RADIUS,LAT,LNG);
        way["amenity"~"doctors|clinic|hospital"](around:RADIUS,LAT,LNG);
        relation["amenity"~"doctors|clinic|hospital"](around:RADIUS,LAT,LNG);
      `
    case 'pharmacy':
      return `
        node["amenity"="pharmacy"](around:RADIUS,LAT,LNG);
        way["amenity"="pharmacy"](around:RADIUS,LAT,LNG);
        relation["amenity"="pharmacy"](around:RADIUS,LAT,LNG);
      `
    case 'group':
      return `
        node["amenity"~"community_centre|social_facility|arts_centre|place_of_worship"](around:RADIUS,LAT,LNG);
        way["amenity"~"community_centre|social_facility|arts_centre|place_of_worship"](around:RADIUS,LAT,LNG);
        relation["amenity"~"community_centre|social_facility|arts_centre|place_of_worship"](around:RADIUS,LAT,LNG);
      `
    default:
      return ''
  }
}

export async function GET(request: NextRequest) {
  const latitude = toNumber(request.nextUrl.searchParams.get('lat'))
  const longitude = toNumber(request.nextUrl.searchParams.get('lng'))
  const radius = Math.min(12000, Math.max(1500, toNumber(request.nextUrl.searchParams.get('radius')) || 6000))
  const kind = request.nextUrl.searchParams.get('kind') || 'doctor'

  if (latitude == null || longitude == null) {
    return NextResponse.json({ results: [] }, { status: 400 })
  }

  try {
    const queryTemplate = getKindQuery(kind)
    if (!queryTemplate) return NextResponse.json({ results: [] })

    const overpassQuery = `
      [out:json][timeout:25];
      (
        ${queryTemplate
          .replaceAll('LAT', String(latitude))
          .replaceAll('LNG', String(longitude))
          .replaceAll('RADIUS', String(radius))}
      );
      out center tags 25;
    `

    const payload = (await postOverpass(overpassQuery)) as {
      elements?: Array<Record<string, unknown>>
    }

    const results = (payload.elements || [])
      .map((element, index) => {
        const center = (element.center as Record<string, unknown> | undefined) || element
        const lat = Number(center.lat)
        const lng = Number(center.lon)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

        const tags = (element.tags as Record<string, string> | undefined) || {}
        const amenity = tags.amenity || kind

        return {
          id: `osm-${kind}-${element.id || index}`,
          title: tags.name || tags.brand || 'Nearby support place',
          subtitle: [amenity, tags.healthcare].filter(Boolean).join(' · '),
          address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean).join(' '),
          phone: tags.phone || tags['contact:phone'] || null,
          hours: tags.opening_hours || null,
          latitude: lat,
          longitude: lng,
          kind:
            kind === 'group'
              ? 'group'
              : amenity === 'pharmacy'
                ? 'pharmacy'
                : amenity === 'hospital'
                  ? 'hospital'
                  : 'doctor',
          source: 'osm',
          tags: [tags.healthcare, tags.amenity].filter(Boolean),
        }
      })
      .filter(Boolean)
      .slice(0, 18)

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Failed to load nearby places:', error)
    return NextResponse.json({ results: [] }, { status: 500 })
  }
}
