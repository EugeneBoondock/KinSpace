'use client';

import React from 'react';
import BottomNav from '@/components/BottomNav';

// Placeholder icons - replace with actual icon components or imports if available
const MapPinIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

const mockSupportGroups = [
  {
    id: 'sg1',
    name: 'Chronic Warriors Unite',
    distance: '1.2 miles away',
    nextMeeting: 'Tomorrow, 7 PM',
    members: 15,
    type: 'General Chronic Illness',
    imageUrl: '/images/support-group1-placeholder.jpg' // Placeholder
  },
  {
    id: 'sg2',
    name: 'Lupus & Fibro Friends',
    distance: '3.5 miles away',
    nextMeeting: 'Next Tuesday, 6:30 PM',
    members: 22,
    type: 'Specific Conditions',
    imageUrl: '/images/support-group2-placeholder.jpg' // Placeholder
  },
  {
    id: 'sg3',
    name: 'Mental Wellness Circle',
    distance: '0.8 miles away',
    nextMeeting: 'This Saturday, 10 AM',
    members: 12,
    type: 'Mental Health Focus',
    imageUrl: '/images/support-group3-placeholder.jpg' // Placeholder
  },
];

const NearbySupportPage = () => {
  // In a real app, fetch groups based on location/filters
  const supportGroups = mockSupportGroups;

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 pb-24 font-manrope">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-slate-100/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-screen-lg items-center justify-between px-4">
          <h1 className="text-xl font-semibold text-slate-900">Nearby Support</h1>
          <button className="rounded-lg p-2 text-slate-700 hover:bg-slate-200">
            <SearchIcon />
          </button>
        </div>
      </header>

      {/* Main Content - Support Group List */}
      <main className="flex-1 p-4">
        {supportGroups.length > 0 ? (
          <div className="space-y-4">
            {supportGroups.map((group) => (
              <div key={group.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-4">
                  {/* Placeholder for group image - replace with Next/Image if using actual images */}
                  <div className="h-16 w-16 flex-shrink-0 rounded-md bg-slate-200 flex items-center justify-center text-slate-500">
                    <MapPinIcon />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-slate-800">{group.name}</h2>
                    <p className="text-sm text-slate-500">{group.distance}</p>
                    <p className="mt-1 text-xs text-slate-600">Next meeting: {group.nextMeeting}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                      <span>{group.members} members</span>
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">{group.type}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 border-t border-slate-200 pt-3 text-right">
                    <button className="rounded-md bg-sky-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-600">
                        View Details
                    </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="text-3xl text-slate-400">
              <MapPinIcon />
            </div>
            <h3 className="mt-2 text-sm font-medium text-slate-900">No Support Groups Found</h3>
            <p className="mt-1 text-sm text-slate-500">Try adjusting your location or search filters.</p>
          </div>
        )}
      </main>

      <BottomNav activePage="Groups" />
    </div>
  );
};

export default NearbySupportPage;
