'use client'

import { useEffect, useMemo, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { DatabaseService } from '@/lib/database'
import { formatCompactNumber, getDistanceKm } from '@/lib/platform'

type SupportLocation = {
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
  [key: string]: unknown
}

type LocationState = {
  latitude: number
  longitude: number
} | null

const tabs = [
  { id: 'doctor', label: 'Doctors', icon: 'ri-stethoscope-line' },
  { id: 'pharmacy', label: 'Pharmacies', icon: 'ri-capsule-line' },
]

export default function MapPage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'doctor' | 'pharmacy'>('doctor')
  const [supportLocations, setSupportLocations] = useState<SupportLocation[]>([])
  const [userLocation, setUserLocation] = useState<LocationState>(null)
  const [locationEnabled, setLocationEnabled] = useState(false)

  useEffect(() => {
    async function loadLocations() {
      try {
        const locations = await DatabaseService.getSupportLocations()
        setSupportLocations(locations as SupportLocation[])
      } catch (error) {
        console.error('Failed to load support locations:', error)
      } finally {
        setLoading(false)
      }
    }

    loadLocations()
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationEnabled(true)
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      () => {
        setLocationEnabled(false)
      },
    )
  }, [])

  const filteredLocations = useMemo<Array<SupportLocation & { distanceKm: number | null }>>(() => {
    return supportLocations
      .filter((location) => location.type === activeTab)
      .map((location) => {
        const latitude = location.latitude as number | undefined
        const longitude = location.longitude as number | undefined

        const distanceKm =
          userLocation && typeof latitude === 'number' && typeof longitude === 'number'
            ? getDistanceKm(userLocation.latitude, userLocation.longitude, latitude, longitude)
            : null

        return { ...location, distanceKm }
      })
      .sort((first, second) => {
        if (first.distanceKm == null && second.distanceKm == null) {
          return ((second.rating as number | undefined) ?? 0) - ((first.rating as number | undefined) ?? 0)
        }
        if (first.distanceKm == null) return 1
        if (second.distanceKm == null) return -1
        return first.distanceKm - second.distanceKm
      })
  }, [activeTab, supportLocations, userLocation])

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
                Nearby care
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Find support that is actually published</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#eedfc8]/60">
                This screen now reads from the live support directory. If nothing is listed yet, we show that honestly.
              </p>
            </div>
            <div className="card-light !p-4">
              <p className="text-xs text-[#eedfc8]/45">Location access</p>
              <p className="mt-1 text-sm font-semibold text-[#eedfc8]">
                {locationEnabled ? 'Enabled for nearby sorting' : 'Off'}
              </p>
            </div>
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto rounded-2xl bg-[#eedfc8]/5 p-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'doctor' | 'pharmacy')}
                className={`flex min-w-fit items-center gap-2 rounded-2xl px-4 py-2.5 text-sm transition-all ${
                  activeTab === tab.id ? 'tab-active' : 'tab-inactive'
                }`}
              >
                <i className={tab.icon} />
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        <section className="page-grid">
          <div className="flex items-center justify-between text-sm text-[#eedfc8]/45">
            <p>{formatCompactNumber(filteredLocations.length)} result{filteredLocations.length === 1 ? '' : 's'}</p>
            {!locationEnabled && (
              <p>Enable location in your browser for better sorting.</p>
            )}
          </div>

          {loading ? (
            <div className="page-card-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-56 skeleton rounded-3xl" />
              ))}
            </div>
          ) : filteredLocations.length > 0 ? (
            <div className="page-card-grid">
              {filteredLocations.map((location) => (
                <article key={location.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-[#eedfc8]">{location.name as string}</h2>
                        <span
                          className={`badge ${
                            location.is_open ? 'bg-[#6B8A83]/16 text-[#6B8A83]' : 'bg-[#B85C3A]/16 text-[#B85C3A]'
                          }`}
                        >
                          {location.is_open ? 'Open' : 'Closed'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#eedfc8]/45">
                        {(location.specialty as string | undefined) || (location.type as string)}
                      </p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eedfc8]/8 text-[#D19A58]">
                      <i className={`${activeTab === 'doctor' ? 'ri-stethoscope-line' : 'ri-capsule-line'} text-xl`} />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-[#eedfc8]/65">
                    {(location.address as string | undefined) && (
                      <p>
                        <i className="ri-map-pin-2-line mr-1.5 text-[#eedfc8]/35" />
                        {location.address as string}
                      </p>
                    )}
                    {(location.hours as string | undefined) && (
                      <p>
                        <i className="ri-time-line mr-1.5 text-[#eedfc8]/35" />
                        {location.hours as string}
                      </p>
                    )}
                    {(location.phone as string | undefined) && (
                      <p>
                        <i className="ri-phone-line mr-1.5 text-[#eedfc8]/35" />
                        {location.phone as string}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-[#eedfc8]/45">
                    <span>Rating {(location.rating as number | undefined) ?? 'N/A'}</span>
                    <span>
                      {typeof location.distanceKm === 'number'
                        ? `${location.distanceKm.toFixed(1)} km away`
                        : 'Distance unavailable'}
                    </span>
                  </div>

                  <div className="mt-5 flex gap-2">
                    {(location.phone as string | undefined) ? (
                      <a
                        href={`tel:${String(location.phone).replace(/\s+/g, '')}`}
                        className="btn-primary flex-1 !py-2.5 text-center text-sm"
                      >
                        Call
                      </a>
                    ) : (
                      <span className="btn-secondary flex-1 !py-2.5 text-center text-sm">No phone listed</span>
                    )}
                    {(location.address as string | undefined) && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.address as string)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary flex-1 !py-2.5 text-center text-sm"
                      >
                        Directions
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="card-light text-center">
              <i className="ri-map-pin-2-line text-4xl text-[#eedfc8]/25" />
              <p className="mt-3 text-sm text-[#eedfc8]/60">
                No {activeTab === 'doctor' ? 'doctors' : 'pharmacies'} have been published to the directory yet.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <a
                  href={`https://www.google.com/maps/search/${activeTab}+near+me`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary !py-2.5 !px-4 text-sm"
                >
                  Search externally
                </a>
              </div>
            </div>
          )}
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
