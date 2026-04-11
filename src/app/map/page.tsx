'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'

interface MapLocation {
  id: string
  name: string
  specialty: string
  address: string
  rating: number
  distance: string
  phone: string
  hours: string
  isOpen: boolean
  services: string[]
}

const mockDoctors: MapLocation[] = [
  {
    id: 'd1',
    name: 'Dr. Sarah Johnson, MD',
    specialty: 'Family Medicine',
    address: '456 Wellness Blvd, Suite 200',
    rating: 4.9,
    distance: '0.3 mi',
    phone: '(555) 234-5678',
    hours: '9:00 AM - 5:00 PM',
    isOpen: true,
    services: ['Primary Care', 'Preventive Health', 'Chronic Disease Management'],
  },
  {
    id: 'd2',
    name: 'City Medical Center',
    specialty: 'General Practice',
    address: '123 Healthcare Ave, Downtown',
    rating: 4.8,
    distance: '0.7 mi',
    phone: '(555) 123-4567',
    hours: '8:00 AM - 6:00 PM',
    isOpen: true,
    services: ['General Practice', 'Pediatrics', 'Cardiology', 'Lab Services'],
  },
  {
    id: 'd3',
    name: 'Community Health Clinic',
    specialty: 'Walk-in Clinic',
    address: '789 Care Street',
    rating: 4.6,
    distance: '1.2 mi',
    phone: '(555) 345-6789',
    hours: 'Opens 8:00 AM tomorrow',
    isOpen: false,
    services: ['Walk-in Clinic', 'Urgent Care', 'Vaccinations'],
  },
  {
    id: 'd4',
    name: 'Metro Family Practice',
    specialty: 'Family Medicine',
    address: '321 Health Plaza, Floor 3',
    rating: 4.7,
    distance: '1.5 mi',
    phone: '(555) 456-7890',
    hours: '7:00 AM - 8:00 PM',
    isOpen: true,
    services: ['Family Medicine', 'Mental Health', 'Lab Services'],
  },
  {
    id: 'd5',
    name: 'Dr. Emily Park, DO',
    specialty: 'Internal Medicine',
    address: '555 Maple Drive, Suite 110',
    rating: 4.9,
    distance: '1.8 mi',
    phone: '(555) 567-8901',
    hours: '8:30 AM - 4:30 PM',
    isOpen: true,
    services: ['Internal Medicine', 'Diabetes Care', 'Heart Health'],
  },
]

const mockPharmacies: MapLocation[] = [
  {
    id: 'p1',
    name: 'CVS Pharmacy',
    specialty: 'Retail Pharmacy',
    address: '567 Main Street',
    rating: 4.5,
    distance: '0.2 mi',
    phone: '(555) 111-2222',
    hours: '24 Hours',
    isOpen: true,
    services: ['Prescriptions', 'Vaccines', 'Health Screenings'],
  },
  {
    id: 'p2',
    name: 'Walgreens',
    specialty: 'Retail Pharmacy',
    address: '890 Commerce Blvd',
    rating: 4.4,
    distance: '0.5 mi',
    phone: '(555) 222-3333',
    hours: '8:00 AM - 10:00 PM',
    isOpen: true,
    services: ['Prescriptions', 'Photo Services', 'Health Products'],
  },
  {
    id: 'p3',
    name: 'City Pharmacy',
    specialty: 'Independent Pharmacy',
    address: '234 Park Avenue',
    rating: 4.8,
    distance: '0.8 mi',
    phone: '(555) 333-4444',
    hours: '9:00 AM - 7:00 PM',
    isOpen: true,
    services: ['Prescriptions', 'Compounding', 'Medical Supplies'],
  },
  {
    id: 'p4',
    name: 'HealthMart Pharmacy',
    specialty: 'Specialty Pharmacy',
    address: '456 Oak Street',
    rating: 4.6,
    distance: '1.1 mi',
    phone: '(555) 444-5555',
    hours: 'Opens 9:00 AM tomorrow',
    isOpen: false,
    services: ['Prescriptions', 'Diabetes Care', 'Blood Pressure Monitoring'],
  },
]

function MapContent() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'doctors' | 'pharmacies'>(
    (searchParams.get('type') as 'doctors' | 'pharmacies') || 'doctors'
  )
  const [locationGranted, setLocationGranted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const locations = activeTab === 'doctors' ? mockDoctors : mockPharmacies

  useEffect(() => {
    setIsLoading(true)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setLocationGranted(true)
          setTimeout(() => setIsLoading(false), 800)
        },
        () => {
          setLocationGranted(false)
          setTimeout(() => setIsLoading(false), 800)
        }
      )
    } else {
      setTimeout(() => setIsLoading(false), 800)
    }
  }, [])

  useEffect(() => {
    setIsLoading(true)
    const t = setTimeout(() => setIsLoading(false), 500)
    return () => clearTimeout(t)
  }, [activeTab])

  const renderStars = (rating: number) => {
    const full = Math.floor(rating)
    const hasHalf = rating - full >= 0.5
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: full }).map((_, i) => (
          <i key={i} className="ri-star-fill text-[#D19A58] text-[10px]"></i>
        ))}
        {hasHalf && <i className="ri-star-half-fill text-[#D19A58] text-[10px]"></i>}
        <span className="text-xs text-[#eedfc8]/70 ml-1">{rating}</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-primary pb-20">
      <div className="px-5 pt-14 pb-6">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-[#eedfc8] mb-1">Find Nearby</h1>
          <p className="text-[#eedfc8]/60 text-sm">Doctors, pharmacies & healthcare near you</p>
        </div>

        {/* Map Placeholder */}
        <div className="card mb-5 h-44 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#6B8A83]/20 to-[#2A4A42] rounded-xl"></div>
          <div className="relative text-center">
            <i className="ri-map-pin-2-fill text-3xl text-[#D19A58] mb-2 block"></i>
            {locationGranted ? (
              <p className="text-xs text-[#eedfc8]/60">Location enabled &middot; Showing nearby results</p>
            ) : (
              <div>
                <p className="text-xs text-[#eedfc8]/60 mb-2">Enable location for accurate results</p>
                <button className="btn-primary text-xs py-1.5 px-4">
                  <i className="ri-map-pin-line mr-1"></i>
                  Enable Location
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-[#eedfc8]/8 rounded-full p-1 mb-5">
          <button
            onClick={() => setActiveTab('doctors')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-medium transition-all ${
              activeTab === 'doctors'
                ? 'bg-[#eedfc8]/20 text-[#eedfc8] shadow-sm'
                : 'text-[#eedfc8]/50'
            }`}
          >
            <i className="ri-stethoscope-line"></i>
            Doctors
          </button>
          <button
            onClick={() => setActiveTab('pharmacies')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-medium transition-all ${
              activeTab === 'pharmacies'
                ? 'bg-[#eedfc8]/20 text-[#eedfc8] shadow-sm'
                : 'text-[#eedfc8]/50'
            }`}
          >
            <i className="ri-capsule-line"></i>
            Pharmacies
          </button>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title mb-0">
            {activeTab === 'doctors' ? 'Doctors' : 'Pharmacies'} Near You
          </h2>
          <span className="text-xs text-[#eedfc8]/50">{locations.length} found</span>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="card">
                <div className="flex gap-3">
                  <div className="w-12 h-12 skeleton rounded-xl shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="w-3/4 h-4 skeleton"></div>
                    <div className="w-1/2 h-3 skeleton"></div>
                    <div className="w-2/3 h-3 skeleton"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Location Cards */}
        {!isLoading && (
          <div className="space-y-4">
            {locations.map(loc => (
              <div key={loc.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-[#eedfc8] text-sm truncate">{loc.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                        loc.isOpen
                          ? 'bg-[#6B8A83]/30 text-[#6B8A83]'
                          : 'bg-[#B85C3A]/30 text-[#B85C3A]'
                      }`}>
                        {loc.isOpen ? 'Open' : 'Closed'}
                      </span>
                    </div>
                    <p className="text-xs text-[#D19A58] mb-1">{loc.specialty}</p>
                  </div>
                </div>

                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2 text-xs text-[#eedfc8]/60">
                    <i className="ri-map-pin-2-line text-[#eedfc8]/40 shrink-0"></i>
                    <span>{loc.address}</span>
                    <span className="text-[#eedfc8]/30">|</span>
                    <span className="text-[#D19A58] font-medium">{loc.distance}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#eedfc8]/60">
                    <i className="ri-time-line text-[#eedfc8]/40 shrink-0"></i>
                    <span>{loc.hours}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#eedfc8]/60">
                    <i className="ri-phone-line text-[#eedfc8]/40 shrink-0"></i>
                    <span>{loc.phone}</span>
                  </div>
                </div>

                {/* Rating */}
                <div className="mb-3">
                  {renderStars(loc.rating)}
                </div>

                {/* Services Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {loc.services.map(service => (
                    <span key={service} className="bg-[#eedfc8]/8 text-[#eedfc8]/60 px-2.5 py-1 rounded-full text-[11px]">
                      {service}
                    </span>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <a
                    href={`tel:${loc.phone}`}
                    className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5"
                  >
                    <i className="ri-phone-line"></i>
                    Call
                  </a>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(loc.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-xs py-2.5"
                  >
                    <i className="ri-direction-line"></i>
                    Directions
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Emergency Section */}
        <div className="mt-8 card bg-gradient-to-br from-[#B85C3A]/30 to-[#2A4A42] border-[#B85C3A]/20">
          <h3 className="font-bold text-[#eedfc8] mb-3">Need Immediate Help?</h3>
          <div className="space-y-2">
            <a
              href="tel:911"
              className="w-full flex items-center justify-center gap-2 bg-[#B85C3A] text-white py-3 rounded-full font-semibold text-sm"
            >
              <i className="ri-phone-line"></i>
              Emergency Call - 911
            </a>
            <Link
              href="/therapy"
              className="w-full flex items-center justify-center gap-2 btn-primary py-3 text-sm"
            >
              <i className="ri-heart-pulse-line"></i>
              Talk to AI Therapist
            </Link>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-brand-primary flex items-center justify-center">
      <div className="text-center">
        <i className="ri-map-pin-2-fill text-4xl text-[#D19A58] mb-3 block"></i>
        <p className="text-[#eedfc8]/60 text-sm">Loading map...</p>
      </div>
    </div>
  )
}

export default function MapPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MapContent />
    </Suspense>
  )
}
