'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import { useToast } from '@/components/Toast'
import PageFrame from '@/components/PageFrame'
import BottomNav from '@/components/BottomNav'
import CareProgramPanel from '@/components/CareProgramPanel'
import { getNearbyFallbackPlaces, geocodeQueries } from '@/lib/map-client'
import { getDistanceKm } from '@/lib/platform'
import { Badge, Button, Card, EmptyState, Input, Skeleton } from '@/components/ui'

// SA-first default so the list loads even before/without geolocation (Johannesburg).
const DEFAULT_CENTER = { latitude: -26.2041, longitude: 28.0473 }

type Provider = {
  id: string
  title: string
  address: string
  phone: string | null
  website: string | null
  hours: string | null
  latitude: number
  longitude: number
  kind: string
  distanceKm: number
}

type Filter = 'all' | 'doctor' | 'hospital' | 'pharmacy'

const FILTERS: Array<{ id: Filter; label: string; icon: string }> = [
  { id: 'all', label: 'All', icon: 'ri-firstaid-kit-line' },
  { id: 'doctor', label: 'Doctors & clinics', icon: 'ri-stethoscope-line' },
  { id: 'hospital', label: 'Hospitals', icon: 'ri-hospital-line' },
  { id: 'pharmacy', label: 'Pharmacies', icon: 'ri-capsule-line' },
]

const KIND_LABEL: Record<string, string> = {
  doctor: 'Doctor / clinic',
  hospital: 'Hospital',
  pharmacy: 'Pharmacy',
}

function ensureUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

export default function CarePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { push: toast } = useToast()

  const [providers, setProviders] = useState<Provider[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [locationLabel, setLocationLabel] = useState('your area')
  const conditionContext = searchParams.get('for')

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  const load = useCallback(async (coords: { latitude: number; longitude: number }) => {
    setLoading(true)
    try {
      const [docs, pharmacies] = await Promise.all([
        getNearbyFallbackPlaces(coords, 'doctor', 9000).catch(() => [] as Array<Record<string, unknown>>),
        getNearbyFallbackPlaces(coords, 'pharmacy', 9000).catch(() => [] as Array<Record<string, unknown>>),
      ])
      const seen = new Set<string>()
      const merged = [...docs, ...pharmacies]
        .map((raw) => {
          const place = raw as Record<string, unknown>
          const latitude = Number(place.latitude)
          const longitude = Number(place.longitude)
          return {
            id: String(place.id),
            title: String(place.title ?? 'Care provider'),
            address: String(place.address ?? ''),
            phone: (place.phone as string | null) ?? null,
            website: (place.website as string | null) ?? null,
            hours: (place.hours as string | null) ?? null,
            latitude,
            longitude,
            kind: String(place.kind ?? 'doctor'),
            distanceKm: getDistanceKm(coords.latitude, coords.longitude, latitude, longitude),
          } as Provider
        })
        .filter((place) => {
          if (!Number.isFinite(place.latitude) || seen.has(place.id)) return false
          seen.add(place.id)
          return true
        })
        .sort((a, b) => a.distanceKm - b.distanceKm)
      setProviders(merged)
    } catch {
      setProviders([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let settled = false
    const loadDefaultLocation = () => {
      if (settled) return
      settled = true
      void load(DEFAULT_CENTER)
    }
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (settled) return
          settled = true
          const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude }
          setLocationLabel('your location')
          void load(coords)
        },
        loadDefaultLocation,
        { timeout: 8000, maximumAge: 600000 },
      )
      const timer = setTimeout(loadDefaultLocation, 8500)
      return () => clearTimeout(timer)
    }
    loadDefaultLocation()
  }, [user, load])

  async function handleLocationSearch(event: React.FormEvent) {
    event.preventDefault()
    const query = locationInput.trim()
    if (!query) return
    try {
      const geocoded = await geocodeQueries([query])
      const match = geocoded.get(query)
      if (match) {
        setLocationLabel(match.label || query)
        void load({ latitude: match.latitude, longitude: match.longitude })
      } else {
        toast('Could not find that place. Try a city or suburb.', 'error')
      }
    } catch {
      toast('Location search failed. Try again.', 'error')
    }
  }

  const visible = useMemo(() => {
    const list = providers ?? []
    const q = search.trim().toLowerCase()
    return list.filter((place) => {
      const kindOk = filter === 'all' ? true : place.kind === filter
      const searchOk = !q || place.title.toLowerCase().includes(q) || place.address.toLowerCase().includes(q)
      return kindOk && searchOk
    })
  }, [providers, filter, search])

  if (authLoading || !user) return null

  return (
    <PageFrame>
      <div className="page-grid space-y-6">
        <header className="space-y-2">
          <p className="eyebrow">Care navigation</p>
          <h1 className="text-2xl font-bold text-brand-background sm:text-3xl">Your care program and nearby help</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-brand-background/60">
            Follow the weekly program, then find doctors, clinics, hospitals and pharmacies near {locationLabel}
            {conditionContext ? ` while you look into ${conditionContext}` : ''}. Confirm details before you go.
          </p>
        </header>

        <CareProgramPanel />

        <Card className="space-y-3">
          <form onSubmit={handleLocationSearch} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={locationInput}
              onChange={(event) => setLocationInput(event.target.value)}
              placeholder="Search a city or suburb, or use your location"
              aria-label="Search a location"
              className="flex-1"
            />
            <Button type="submit" leadingIcon={<i className="ri-map-pin-line" aria-hidden="true" />}>
              Search here
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                aria-pressed={filter === option.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  filter === option.id
                    ? 'bg-brand-accent2 text-white'
                    : 'bg-brand-background/[0.06] text-brand-background/65 hover:bg-brand-background/10'
                }`}
              >
                <i className={option.icon} aria-hidden="true" /> {option.label}
              </button>
            ))}
          </div>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter by name or address"
            aria-label="Filter providers by name or address"
          />
        </Card>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<i className="ri-map-pin-line text-3xl" aria-hidden="true" />}
            title="No providers found here"
            description="Try a wider search, a different area, or another category."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {visible.map((place) => (
              <Card key={place.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-base font-semibold text-brand-background">{place.title}</h2>
                    <p className="mt-0.5 text-xs text-brand-background/50">
                      {KIND_LABEL[place.kind] ?? place.kind}
                      {place.address ? ` at ${place.address}` : ''}
                    </p>
                  </div>
                  <Badge tone="neutral" className="shrink-0">
                    {place.distanceKm < 1 ? `${Math.round(place.distanceKm * 1000)} m` : `${place.distanceKm.toFixed(1)} km`}
                  </Badge>
                </div>
                {place.hours && (
                  <p className="mt-2 text-xs text-brand-background/55">
                    <i className="ri-time-line mr-1" aria-hidden="true" />
                    {place.hours}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-accent2/15 px-3 py-1.5 text-xs font-semibold text-brand-accent2 transition-colors hover:bg-brand-accent2/25"
                  >
                    <i className="ri-route-line" aria-hidden="true" /> Directions
                  </a>
                  {place.phone && (
                    <a
                      href={`tel:${place.phone}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-background/[0.06] px-3 py-1.5 text-xs font-semibold text-brand-background/70 transition-colors hover:bg-brand-background/10"
                    >
                      <i className="ri-phone-line" aria-hidden="true" /> Call
                    </a>
                  )}
                  {place.website && (
                    <a
                      href={ensureUrl(place.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-background/[0.06] px-3 py-1.5 text-xs font-semibold text-brand-background/70 transition-colors hover:bg-brand-background/10"
                    >
                      <i className="ri-global-line" aria-hidden="true" /> Website
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <p className="text-xs leading-relaxed text-brand-background/45">
          Place data from OpenStreetMap contributors. KinSpace does not endorse specific providers, and listings may be
          incomplete. This is not medical advice.
        </p>
      </div>
      <BottomNav />
    </PageFrame>
  )
}
