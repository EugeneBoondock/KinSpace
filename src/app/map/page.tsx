'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface MapLocation {
  id: string;
  name: string;
  address: string;
  rating: number;
  distance: string;
  phone: string;
  isOpen: boolean;
  openHours: string;
  services?: string[];
}

function MapContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const type = searchParams.get('type') || 'doctors';
  const title = type === 'doctors' ? 'Doctors Near You' : 'Pharmacies Near You';
  const icon = type === 'doctors' ? 'ri-stethoscope-line' : 'ri-capsule-line';

  useEffect(() => {
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        // Inline loadNearbyLocations logic
        setTimeout(() => {
          const mockData: MapLocation[] = type === 'doctors' ? [
            {
              id: '1',
              name: 'City Medical Center',
              address: '123 Healthcare Ave, Downtown',
              rating: 4.8,
              distance: '0.3 miles',
              phone: '(555) 123-4567',
              isOpen: true,
              openHours: '8:00 AM - 6:00 PM',
              services: ['General Practice', 'Pediatrics', 'Cardiology']
            },
            {
              id: '2',
              name: 'Dr. Sarah Johnson, MD',
              address: '456 Wellness Blvd, Suite 200',
              rating: 4.9,
              distance: '0.7 miles',
              phone: '(555) 234-5678',
              isOpen: true,
              openHours: '9:00 AM - 5:00 PM',
              services: ['Family Medicine', 'Internal Medicine']
            },
            {
              id: '3',
              name: 'Community Health Clinic',
              address: '789 Care Street',
              rating: 4.6,
              distance: '1.2 miles',
              phone: '(555) 345-6789',
              isOpen: false,
              openHours: 'Closed - Opens 8:00 AM tomorrow',
              services: ['Walk-in Clinic', 'Urgent Care', 'Vaccinations']
            },
            {
              id: '4',
              name: 'Metro Family Practice',
              address: '321 Health Plaza, Floor 3',
              rating: 4.7,
              distance: '1.5 miles',
              phone: '(555) 456-7890',
              isOpen: true,
              openHours: '7:00 AM - 8:00 PM',
              services: ['Family Medicine', 'Mental Health', 'Lab Services']
            }
          ] : [
            {
              id: '1',
              name: 'CVS Pharmacy',
              address: '567 Main Street',
              rating: 4.5,
              distance: '0.2 miles',
              phone: '(555) 111-2222',
              isOpen: true,
              openHours: '24 Hours',
              services: ['Prescriptions', 'Vaccines', 'Health Screenings']
            },
            {
              id: '2',
              name: 'Walgreens',
              address: '890 Commerce Blvd',
              rating: 4.4,
              distance: '0.5 miles',
              phone: '(555) 222-3333',
              isOpen: true,
              openHours: '8:00 AM - 10:00 PM',
              services: ['Prescriptions', 'Photo Services', 'Health Products']
            },
            {
              id: '3',
              name: 'City Pharmacy',
              address: '234 Park Avenue',
              rating: 4.8,
              distance: '0.8 miles',
              phone: '(555) 333-4444',
              isOpen: true,
              openHours: '9:00 AM - 7:00 PM',
              services: ['Prescriptions', 'Compounding', 'Medical Supplies']
            },
            {
              id: '4',
              name: 'HealthMart Pharmacy',
              address: '456 Oak Street',
              rating: 4.6,
              distance: '1.1 miles',
              phone: '(555) 444-5555',
              isOpen: false,
              openHours: 'Closed - Opens 9:00 AM tomorrow',
              services: ['Prescriptions', 'Diabetes Care', 'Blood Pressure Monitoring']
            }
          ];
          
          setLocations(mockData);
          setIsLoading(false);
        }, 1500);
      }, () => {
        // Default to a sample location if geolocation fails
        setUserLocation({ lat: 40.7128, lng: -74.0060 });
        // Inline loadNearbyLocations logic
        setTimeout(() => {
          const mockData: MapLocation[] = type === 'doctors' ? [
            {
              id: '1',
              name: 'City Medical Center',
              address: '123 Healthcare Ave, Downtown',
              rating: 4.8,
              distance: '0.3 miles',
              phone: '(555) 123-4567',
              isOpen: true,
              openHours: '8:00 AM - 6:00 PM',
              services: ['General Practice', 'Pediatrics', 'Cardiology']
            },
            {
              id: '2',
              name: 'Dr. Sarah Johnson, MD',
              address: '456 Wellness Blvd, Suite 200',
              rating: 4.9,
              distance: '0.7 miles',
              phone: '(555) 234-5678',
              isOpen: true,
              openHours: '9:00 AM - 5:00 PM',
              services: ['Family Medicine', 'Internal Medicine']
            },
            {
              id: '3',
              name: 'Community Health Clinic',
              address: '789 Care Street',
              rating: 4.6,
              distance: '1.2 miles',
              phone: '(555) 345-6789',
              isOpen: false,
              openHours: 'Closed - Opens 8:00 AM tomorrow',
              services: ['Walk-in Clinic', 'Urgent Care', 'Vaccinations']
            },
            {
              id: '4',
              name: 'Metro Family Practice',
              address: '321 Health Plaza, Floor 3',
              rating: 4.7,
              distance: '1.5 miles',
              phone: '(555) 456-7890',
              isOpen: true,
              openHours: '7:00 AM - 8:00 PM',
              services: ['Family Medicine', 'Mental Health', 'Lab Services']
            }
          ] : [
            {
              id: '1',
              name: 'CVS Pharmacy',
              address: '567 Main Street',
              rating: 4.5,
              distance: '0.2 miles',
              phone: '(555) 111-2222',
              isOpen: true,
              openHours: '24 Hours',
              services: ['Prescriptions', 'Vaccines', 'Health Screenings']
            },
            {
              id: '2',
              name: 'Walgreens',
              address: '890 Commerce Blvd',
              rating: 4.4,
              distance: '0.5 miles',
              phone: '(555) 222-3333',
              isOpen: true,
              openHours: '8:00 AM - 10:00 PM',
              services: ['Prescriptions', 'Photo Services', 'Health Products']
            },
            {
              id: '3',
              name: 'City Pharmacy',
              address: '234 Park Avenue',
              rating: 4.8,
              distance: '0.8 miles',
              phone: '(555) 333-4444',
              isOpen: true,
              openHours: '9:00 AM - 7:00 PM',
              services: ['Prescriptions', 'Compounding', 'Medical Supplies']
            },
            {
              id: '4',
              name: 'HealthMart Pharmacy',
              address: '456 Oak Street',
              rating: 4.6,
              distance: '1.1 miles',
              phone: '(555) 444-5555',
              isOpen: false,
              openHours: 'Closed - Opens 9:00 AM tomorrow',
              services: ['Prescriptions', 'Diabetes Care', 'Blood Pressure Monitoring']
            }
          ];
          
          setLocations(mockData);
          setIsLoading(false);
        }, 1500);
      });
    } else {
      setUserLocation({ lat: 40.7128, lng: -74.0060 });
      // Inline loadNearbyLocations logic
      setTimeout(() => {
        const mockData: MapLocation[] = type === 'doctors' ? [
          {
            id: '1',
            name: 'City Medical Center',
            address: '123 Healthcare Ave, Downtown',
            rating: 4.8,
            distance: '0.3 miles',
            phone: '(555) 123-4567',
            isOpen: true,
            openHours: '8:00 AM - 6:00 PM',
            services: ['General Practice', 'Pediatrics', 'Cardiology']
          },
          {
            id: '2',
            name: 'Dr. Sarah Johnson, MD',
            address: '456 Wellness Blvd, Suite 200',
            rating: 4.9,
            distance: '0.7 miles',
            phone: '(555) 234-5678',
            isOpen: true,
            openHours: '9:00 AM - 5:00 PM',
            services: ['Family Medicine', 'Internal Medicine']
          },
          {
            id: '3',
            name: 'Community Health Clinic',
            address: '789 Care Street',
            rating: 4.6,
            distance: '1.2 miles',
            phone: '(555) 345-6789',
            isOpen: false,
            openHours: 'Closed - Opens 8:00 AM tomorrow',
            services: ['Walk-in Clinic', 'Urgent Care', 'Vaccinations']
          },
          {
            id: '4',
            name: 'Metro Family Practice',
            address: '321 Health Plaza, Floor 3',
            rating: 4.7,
            distance: '1.5 miles',
            phone: '(555) 456-7890',
            isOpen: true,
            openHours: '7:00 AM - 8:00 PM',
            services: ['Family Medicine', 'Mental Health', 'Lab Services']
          }
        ] : [
          {
            id: '1',
            name: 'CVS Pharmacy',
            address: '567 Main Street',
            rating: 4.5,
            distance: '0.2 miles',
            phone: '(555) 111-2222',
            isOpen: true,
            openHours: '24 Hours',
            services: ['Prescriptions', 'Vaccines', 'Health Screenings']
          },
          {
            id: '2',
            name: 'Walgreens',
            address: '890 Commerce Blvd',
            rating: 4.4,
            distance: '0.5 miles',
            phone: '(555) 222-3333',
            isOpen: true,
            openHours: '8:00 AM - 10:00 PM',
            services: ['Prescriptions', 'Photo Services', 'Health Products']
          },
          {
            id: '3',
            name: 'City Pharmacy',
            address: '234 Park Avenue',
            rating: 4.8,
            distance: '0.8 miles',
            phone: '(555) 333-4444',
            isOpen: true,
            openHours: '9:00 AM - 7:00 PM',
            services: ['Prescriptions', 'Compounding', 'Medical Supplies']
          },
          {
            id: '4',
            name: 'HealthMart Pharmacy',
            address: '456 Oak Street',
            rating: 4.6,
            distance: '1.1 miles',
            phone: '(555) 444-5555',
            isOpen: false,
            openHours: 'Closed - Opens 9:00 AM tomorrow',
            services: ['Prescriptions', 'Diabetes Care', 'Blood Pressure Monitoring']
          }
        ];
        
        setLocations(mockData);
        setIsLoading(false);
      }, 1500);
    }
  }, [type]);



  const handleCallLocation = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleDirections = (address: string) => {
    if (userLocation) {
      window.open(`https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${encodeURIComponent(address)}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-brand-primary pb-20 page-map">
      {/* Content */}
      <div className="pt-20 px-6">
        {/* Map Container */}
        <div className="bg-amber-50 rounded-2xl p-4 shadow-sm border border-emerald-200 mb-6 h-64 relative overflow-hidden">
          {userLocation && (
            <iframe
              src={`https://www.google.com/maps/embed/v1/search?key=AIzaSyD4RrFdQ5XzYnIe_R8h2xz8f7B6N7c9rRE&q=${type}+near+${userLocation.lat},${userLocation.lng}&zoom=14`}
              width="100%"
              height="100%"
              className="border-0 rounded-xl"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`${title} Map`}
            ></iframe>
          )}
          {!userLocation && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <i className="ri-map-pin-line text-4xl text-emerald-400 mb-2"></i>
                <p className="text-emerald-600">Loading your location...</p>
              </div>
            </div>
          )}
        </div>

        {/* Filter Options */}
        <div className="flex space-x-2 mb-6 overflow-x-auto">
          <button className="bg-emerald-600 text-cream px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap !rounded-button">
            <i className="ri-map-pin-line mr-1"></i>
            Nearest
          </button>
          <button className="bg-amber-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap !rounded-button">
            <i className="ri-star-line mr-1"></i>
            Highest Rated
          </button>
          <button className="bg-amber-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap !rounded-button">
            <i className="ri-time-line mr-1"></i>
            Open Now
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-amber-50 rounded-2xl p-4 shadow-sm border border-emerald-200">
                <div className="animate-pulse">
                  <div className="flex space-x-3">
                    <div className="w-16 h-16 bg-emerald-200 rounded-xl"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-emerald-200 rounded w-3/4"></div>
                      <div className="h-3 bg-emerald-200 rounded w-1/2"></div>
                      <div className="h-3 bg-emerald-200 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Locations List */}
        {!isLoading && (
          <div className="space-y-4">
            {locations.map((location) => (
              <div key={location.id} className="bg-amber-50 rounded-2xl p-4 shadow-sm border border-emerald-200 hover:shadow-md transition-shadow">
                <div className="flex space-x-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden">
                    <Image 
                      src={`https://readdy.ai/api/search-image?query=${type === 'doctors' ? 'Medical clinic building exterior, modern healthcare facility, professional medical office, clean white building with medical cross symbol, daylight photography, realistic architectural photo' : 'Modern pharmacy storefront, clean medical retail store exterior, professional pharmacy building, green cross symbol, contemporary commercial architecture, daylight photography'}&width=64&height=64&seq=loc${location.id}&orientation=squarish`}
                      alt={location.name}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-semibold text-emerald-800 text-sm">{location.name}</h3>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${location.isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {location.isOpen ? 'Open' : 'Closed'}
                      </div>
                    </div>
                    <p className="text-xs text-emerald-600 mb-1">{location.address}</p>
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="flex items-center space-x-1">
                        <i className="ri-star-fill text-yellow-500 text-xs"></i>
                        <span className="text-xs text-emerald-600">{location.rating}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <i className="ri-map-pin-line text-emerald-500 text-xs"></i>
                        <span className="text-xs text-emerald-600">{location.distance}</span>
                      </div>
                    </div>
                    <p className="text-xs text-emerald-500 mb-3">{location.openHours}</p>
                    
                    {location.services && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {location.services.slice(0, 2).map((service, index) => (
                          <span key={index} className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs">
                            {service}
                          </span>
                        ))}
                        {location.services.length > 2 && (
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs">
                            +{location.services.length - 2} more
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleCallLocation(location.phone)}
                        className="bg-emerald-600 text-cream px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 !rounded-button"
                      >
                        <i className="ri-phone-line"></i>
                        <span>Call</span>
                      </button>
                      <button
                        onClick={() => handleDirections(location.address)}
                        className="bg-teal-600 text-cream px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 !rounded-button"
                      >
                        <i className="ri-direction-line"></i>
                        <span>Directions</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-cream">
          <h3 className="font-bold mb-3">Need More Help?</h3>
          <div className="space-y-3">
            <button 
              onClick={() => window.location.href = 'tel:911'}
              className="w-full bg-red-600 text-cream p-3 rounded-2xl font-semibold flex items-center justify-center space-x-2 !rounded-button"
            >
              <i className="ri-phone-line"></i>
              <span>Emergency Call - 911</span>
            </button>
            <Link 
              href="/therapy"
              className="w-full bg-cream/20 text-cream p-3 rounded-2xl font-semibold flex items-center justify-center space-x-2 !rounded-button"
            >
              <i className="ri-heart-pulse-line"></i>
              <span>Talk to AI Therapist</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-amber-50 border-t border-emerald-200 px-0 py-0">
        <div className="grid grid-cols-5 h-16">
          <Link href="/" className="flex flex-col items-center justify-center space-y-1">
            <i className="ri-home-5-line text-emerald-400 text-lg"></i>
            <span className="text-xs text-emerald-400">Home</span>
          </Link>
          <Link href="/explore" className="flex flex-col items-center justify-center space-y-1">
            <i className="ri-compass-line text-emerald-400 text-lg"></i>
            <span className="text-xs text-emerald-400">Explore</span>
          </Link>
          <Link href="/community" className="flex flex-col items-center justify-center space-y-1">
            <i className="ri-chat-3-line text-emerald-400 text-lg"></i>
            <span className="text-xs text-emerald-400">Community</span>
          </Link>
          <Link href="/resources" className="flex flex-col items-center justify-center space-y-1">
            <i className="ri-book-line text-emerald-400 text-lg"></i>
            <span className="text-xs text-emerald-400">Resources</span>
          </Link>
          <Link href="/profile" className="flex flex-col items-center justify-center space-y-1">
            <i className="ri-user-line text-emerald-400 text-lg"></i>
            <span className="text-xs text-emerald-400">Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-brand-primary flex items-center justify-center page-map">
      <div className="text-center">
        <i className="ri-map-pin-line text-4xl text-emerald-400 mb-2"></i>
        <p className="text-emerald-600">Loading map...</p>
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MapContent />
    </Suspense>
  );
}