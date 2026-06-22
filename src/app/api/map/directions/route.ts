import { NextRequest, NextResponse } from 'next/server'
import type { Coordinates, MapDirectionsResult, RouteStep } from '@/lib/map'
import { getSessionUserId } from '@/server/http/auth'
import { rateLimit } from '@/server/http/rate-limit'

export const runtime = 'nodejs'

function toNumber(value: string | null) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

type OsrmStep = {
  name?: string
  distance?: number
  maneuver?: { type?: string; modifier?: string; location?: number[] }
}

/** Compose a plain-language instruction from an OSRM maneuver (OSRM omits text). */
function describeStep(step: OsrmStep): string {
  const type = step.maneuver?.type
  const modifier = step.maneuver?.modifier
  const road = step.name?.trim()
  const onto = road ? ` onto ${road}` : ''
  const dir = modifier ? modifier : 'ahead'
  switch (type) {
    case 'depart':
      return road ? `Head out on ${road}` : 'Start your route'
    case 'arrive':
      return 'Arrive at your destination'
    case 'turn':
    case 'end of road':
      return `Turn ${dir}${onto}`
    case 'roundabout':
    case 'rotary':
      return `Take the roundabout${onto}`
    case 'merge':
      return `Merge${modifier ? ` ${modifier}` : ''}${onto}`
    case 'on ramp':
      return `Take the ramp${onto}`
    case 'off ramp':
      return `Take the exit${onto}`
    case 'fork':
      return `Keep ${dir}${onto}`
    case 'continue':
      return `Continue${modifier && modifier !== 'straight' ? ` ${modifier}` : ''}${onto}`
    case 'new name':
      return road ? `Continue onto ${road}` : 'Continue straight'
    default:
      return road ? `Continue onto ${road}` : `Keep ${dir}`
  }
}

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId(request)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const limited = await rateLimit(`map:${userId}`, 40, 60)
  if (!limited.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
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
        legs?: Array<{ steps?: OsrmStep[] }>
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

    const steps: RouteStep[] = (route.legs ?? [])
      .flatMap((leg) => leg.steps ?? [])
      .map((step) => {
        const location = step.maneuver?.location
        const longitude = Array.isArray(location) ? location[0] : undefined
        const latitude = Array.isArray(location) ? location[1] : undefined
        if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
        return {
          instruction: describeStep(step),
          distanceMeters: Math.round(step.distance || 0),
          latitude,
          longitude,
        } satisfies RouteStep
      })
      .filter((step): step is RouteStep => step !== null)

    const result: MapDirectionsResult = {
      distanceKm: ((route.distance || 0) / 1000),
      durationMinutes: Math.max(1, Math.round((route.duration || 0) / 60)),
      geometry,
      steps,
    }

    return NextResponse.json({ route: result })
  } catch (error) {
    console.error('Failed to load directions:', error)
    return NextResponse.json({ route: null }, { status: 500 })
  }
}
