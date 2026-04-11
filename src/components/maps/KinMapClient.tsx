'use client'

import { useEffect, useMemo } from 'react'
import { Circle, MapContainer, Marker, Popup, Polyline, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import type { Coordinates, MapDirectionsResult, SupportMapMarker } from '@/lib/map'
import { getMarkerAccent } from '@/lib/map'

delete (L.Icon.Default.prototype as { _getIconUrl?: string })._getIconUrl

L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetinaUrl.src,
  iconUrl: iconUrl.src,
  shadowUrl: shadowUrl.src,
})

function createMarkerIcon(marker: SupportMapMarker, selected: boolean) {
  const accent = getMarkerAccent(marker.kind)

  return L.divIcon({
    className: 'kin-map-marker-wrapper',
    iconSize: selected ? [54, 54] : [46, 46],
    iconAnchor: selected ? [27, 45] : [23, 40],
    popupAnchor: [0, -32],
    html: `
      <div
        class="kin-map-marker${selected ? ' kin-map-marker--selected' : ''}"
        style="--marker-accent:${accent.color}"
      >
        <span>${accent.label}</span>
      </div>
    `,
  })
}

function userLocationIcon() {
  return L.divIcon({
    className: 'kin-map-user-wrapper',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: '<div class="kin-map-user-marker"></div>',
  })
}

function MapViewportController({
  markers,
  selectedMarkerId,
  userLocation,
  directions,
}: {
  markers: SupportMapMarker[]
  selectedMarkerId?: string | null
  userLocation?: Coordinates | null
  directions?: MapDirectionsResult | null
}) {
  const map = useMap()

  const selectedMarker = useMemo(
    () => markers.find((marker) => marker.id === selectedMarkerId) || null,
    [markers, selectedMarkerId],
  )

  useEffect(() => {
    if (directions?.geometry?.length) {
      const bounds = L.latLngBounds(
        directions.geometry.map((point) => [point.latitude, point.longitude] as [number, number]),
      )
      map.fitBounds(bounds.pad(0.12), { animate: true })
      return
    }

    if (selectedMarker) {
      map.flyTo([selectedMarker.latitude, selectedMarker.longitude], 14, { duration: 0.8 })
      return
    }

    const points = [
      ...markers.map((marker) => [marker.latitude, marker.longitude] as [number, number]),
      ...(userLocation ? ([[userLocation.latitude, userLocation.longitude] as [number, number]]) : []),
    ]

    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points).pad(0.12), { animate: false })
    } else if (userLocation) {
      map.setView([userLocation.latitude, userLocation.longitude], 13)
    } else if (points[0]) {
      map.setView(points[0], 12)
    }
  }, [directions, map, markers, selectedMarker, userLocation])

  return null
}

type KinMapClientProps = {
  markers: SupportMapMarker[]
  selectedMarkerId?: string | null
  userLocation?: Coordinates | null
  directions?: MapDirectionsResult | null
  onSelectMarker?: (markerId: string) => void
}

export default function KinMapClient({
  markers,
  selectedMarkerId,
  userLocation,
  directions,
  onSelectMarker,
}: KinMapClientProps) {
  const selectedMarker = markers.find((marker) => marker.id === selectedMarkerId) || null

  return (
    <div className="support-map-shell">
      <MapContainer
        center={[0, 0]}
        zoom={3}
        zoomControl={false}
        className="support-map-canvas"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <MapViewportController
          markers={markers}
          selectedMarkerId={selectedMarkerId}
          userLocation={userLocation}
          directions={directions}
        />

        {userLocation && (
          <>
            <Circle
              center={[userLocation.latitude, userLocation.longitude]}
              radius={450}
              pathOptions={{ color: '#6B8A83', fillColor: '#6B8A83', fillOpacity: 0.08, weight: 1 }}
            />
            <Marker position={[userLocation.latitude, userLocation.longitude]} icon={userLocationIcon()}>
              <Popup className="kin-map-popup">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#eedfc8]">Your location</p>
                  <p className="text-xs text-[#eedfc8]/55">Used for nearby sorting and routing.</p>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {markers.map((marker) => {
          const selected = marker.id === selectedMarkerId
          return (
            <Marker
              key={marker.id}
              position={[marker.latitude, marker.longitude]}
              icon={createMarkerIcon(marker, selected)}
              eventHandlers={{
                click: () => onSelectMarker?.(marker.id),
              }}
            >
              <Popup className="kin-map-popup">
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-[#eedfc8]">{marker.title}</p>
                    {marker.subtitle && <p className="text-xs text-[#eedfc8]/60">{marker.subtitle}</p>}
                  </div>
                  {marker.address && <p className="text-xs text-[#eedfc8]/50">{marker.address}</p>}
                  {marker.distanceKm != null && (
                    <p className="text-xs text-[#D19A58]">{marker.distanceKm.toFixed(1)} km away</p>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}

        {directions?.geometry?.length ? (
          <Polyline
            positions={directions.geometry.map((point) => [point.latitude, point.longitude] as [number, number])}
            pathOptions={{ color: '#B85C3A', weight: 5, opacity: 0.85 }}
          />
        ) : null}

        {selectedMarker && !directions?.geometry?.length && userLocation && (
          <Polyline
            positions={[
              [userLocation.latitude, userLocation.longitude],
              [selectedMarker.latitude, selectedMarker.longitude],
            ]}
            pathOptions={{ color: '#D19A58', weight: 3, opacity: 0.45, dashArray: '6 8' }}
          />
        )}
      </MapContainer>
    </div>
  )
}
