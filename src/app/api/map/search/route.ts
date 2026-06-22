import { NextRequest, NextResponse } from 'next/server'
import type { MapSearchResult } from '@/lib/map'
import { getSessionUserId } from '@/server/http/auth'
import { rateLimit } from '@/server/http/rate-limit'

export const runtime = 'nodejs'

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId(request)
  if (!userId) return NextResponse.json({ results: [] }, { status: 401 })
  const limited = await rateLimit(`map:${userId}`, 40, 60)
  if (!limited.allowed) return NextResponse.json({ results: [] }, { status: 429 })
  const query = request.nextUrl.searchParams.get('q')?.trim()
  if (!query) return NextResponse.json({ results: [] })

  try {
    const response = await fetch(
      `${NOMINATIM_BASE}?format=jsonv2&limit=6&addressdetails=1&q=${encodeURIComponent(query)}`,
      {
        headers: {
          'User-Agent': 'KinSpace/1.0 support-map-search',
          Accept: 'application/json',
        },
        cache: 'no-store',
      },
    )

    if (!response.ok) {
      throw new Error('Nominatim search failed')
    }

    const payload = (await response.json()) as Array<Record<string, string>>
    const results: MapSearchResult[] = payload
      .filter((item) => item.lat && item.lon)
      .map((item, index) => ({
        id: `${item.place_id || index}`,
        label: item.display_name || query,
        subtitle: [item.type, item.class].filter(Boolean).join(' · '),
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      }))

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Failed to search map places:', error)
    return NextResponse.json({ results: [] }, { status: 500 })
  }
}
