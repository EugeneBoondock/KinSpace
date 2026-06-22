import { NextRequest, NextResponse } from 'next/server'
import type { GeocodeResult } from '@/lib/map'
import { getSessionUserId } from '@/server/http/auth'
import { rateLimit } from '@/server/http/rate-limit'

export const runtime = 'nodejs'

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'

async function lookupQuery(query: string): Promise<GeocodeResult | null> {
  const url = `${NOMINATIM_BASE}?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(query)}`
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'KinSpace/1.0 support-map',
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  if (!response.ok) return null

  const payload = (await response.json()) as Array<Record<string, string>>
  const match = payload[0]
  if (!match?.lat || !match?.lon) return null

  return {
    query,
    label: match.display_name || query,
    latitude: Number(match.lat),
    longitude: Number(match.lon),
  }
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId(request)
  if (!userId) return NextResponse.json({ results: [] }, { status: 401 })
  const limited = await rateLimit(`map:${userId}`, 40, 60)
  if (!limited.allowed) return NextResponse.json({ results: [] }, { status: 429 })
  try {
    const body = (await request.json()) as { queries?: string[] }
    const queries = Array.from(new Set((body.queries || []).map((query) => query.trim()).filter(Boolean))).slice(0, 12)

    const results = (await Promise.all(queries.map((query) => lookupQuery(query)))).filter(Boolean) as GeocodeResult[]

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Failed to geocode locations:', error)
    return NextResponse.json({ results: [] }, { status: 500 })
  }
}
