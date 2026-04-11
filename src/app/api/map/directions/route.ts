import { NextRequest, NextResponse } from 'next/server'
import type { Coordinates, MapDirectionsResult } from '@/lib/map'

function toNumber(value: string | null) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export async function GET(request: NextRequest) {
  const originLat = toNumber(request.nextUrl.searchParams.get('originLat'))
  const originLng = toNumber(request.nextUrl.searchParams.get('originLng'))
  const destinationLat = toNumber(request.nextUrl.searchParams.get('destinationLat'))
  const destinationLng = toNumber(request.nextUrl.searchParams.get('destinationLng'))
  const profile = request.nextUrl.searchParams.get('profile') === 'walking' ? 'foot' : 'driving'

  if ([originLat, originLng, destinationLat, destinationLng].some((value) => value == null)) {
    return NextResponse.json({ route: null }, { status: 400 })
  }

  try {
    const url =
      `https://router.project-osrm.org/route/v1/${profile}/${originLng},${originLat};${destinationLng},${destinationLat}` +
      '?overview=full&alternatives=false&steps=true&geometries=geojson'

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'KinSpace/1.0 support-map-route',
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error('OSRM route lookup failed')
    }

    const payload = (await response.json()) as {
      routes?: Array<{
        distance?: number
        duration?: number
        geometry?: { coordinates?: number[][] }
      }>
    }

    const route = payload.routes?.[0]
    if (!route?.geometry?.coordinates?.length) {
      return NextResponse.json({ route: null })
    }

    const geometry: Coordinates[] = route.geometry.coordinates.map(([longitude, latitude]) => ({
      latitude,
      longitude,
    }))

    const result: MapDirectionsResult = {
      distanceKm: ((route.distance || 0) / 1000),
      durationMinutes: Math.max(1, Math.round((route.duration || 0) / 60)),
      geometry,
    }

    return NextResponse.json({ route: result })
  } catch (error) {
    console.error('Failed to load directions:', error)
    return NextResponse.json({ route: null }, { status: 500 })
  }
}
