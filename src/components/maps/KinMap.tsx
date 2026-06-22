'use client'

import dynamic from 'next/dynamic'
import type { Coordinates, MapDirectionsResult, SupportMapMarker } from '@/lib/map'

const KinMapClient = dynamic(() => import('./KinMapClient'), {
  ssr: false,
  loading: () => <div className="h-[26rem] w-full skeleton rounded-[1.75rem]" />,
})

type KinMapProps = {
  markers: SupportMapMarker[]
  selectedMarkerId?: string | null
  userLocation?: Coordinates | null
  directions?: MapDirectionsResult | null
  followUser?: boolean
  onSelectMarker?: (markerId: string) => void
}

export default function KinMap(props: KinMapProps) {
  return <KinMapClient {...props} />
}
