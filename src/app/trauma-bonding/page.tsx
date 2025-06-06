'use client';

import React from 'react';
import BottomNav from '@/components/BottomNav';
import Image from 'next/image';

// Placeholder icons - replace with actual icon components or imports if available
const FilterIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 6H20M7 12H17M10 18H14" stroke="#0D141C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const HeartIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 24 24">
        <path d="M12 4.248c-3.148-5.402-12-3.825-12 2.944 0 4.661 5.571 9.427 12 15.808 6.43-6.381 12-11.147 12-15.808 0-6.792-8.875-8.306-12-2.944z" />
    </svg>
);

const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 24 24">
        <path d="M12 11.293l10.293-10.293.707.707-10.293 10.293 10.293 10.293-.707.707-10.293-10.293-10.293 10.293-.707-.707 10.293-10.293-10.293-10.293.707-.707 10.293 10.293z" />
    </svg>
);

// Mock data for potential matches
const mockMatches = [
  {
    id: 'match1',
    name: 'Alex P.',
    age: 28,
    bio: 'Seeking a kind soul who understands the ups and downs. Loves hiking and art.',
    imageUrl: '/images/match1-placeholder.jpg', // Replace with actual image path
    commonConditions: ['Lupus', 'Anxiety'],
    matchPercentage: 85,
  },
  {
    id: 'match2',
    name: 'Jamie L.',
    age: 32,
    bio: 'Creative spirit, enjoys quiet nights in and meaningful conversations. Cat parent.',
    imageUrl: '/images/match2-placeholder.jpg', // Replace with actual image path
    commonConditions: ['Fibromyalgia', "Raynaud's"],
    matchPercentage: 78,
  },
  {
    id: 'match3',
    name: 'Sam K.',
    age: 25,
    bio: 'Tech enthusiast and gamer. Looking for someone to share laughs and support.',
    imageUrl: '/images/match3-placeholder.jpg', // Replace with actual image path
    commonConditions: ['Chronic Fatigue', 'Depression'],
    matchPercentage: 92,
  },
];

const TraumaBondingPage = () => {
  // In a real app, you'd fetch matches from an API
  const matches = mockMatches;

  return (
    <div className="@container/main flex min-h-screen flex-col bg-slate-50 pb-24 font-manrope">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-slate-50/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-screen-md items-center justify-between px-3">
          <h1 className="text-lg font-semibold text-slate-900">Find Your Match</h1>
          <button className="rounded-lg p-1.5 text-slate-700 hover:bg-slate-200">
            <FilterIcon />
          </button>
        </div>
      </header>

      {/* Main Content - Match Cards */}
      <main className="flex-1 p-3">
        {matches.length > 0 ? (
          <div className="grid gap-4 @[480px]/main:grid-cols-2 @[768px]/main:grid-cols-3">
            {matches.map((match) => (
              <div key={match.id} className="@container/card relative flex aspect-[3/4] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="relative h-3/5 w-full">
                  <Image src={match.imageUrl} alt={match.name} layout="fill" objectFit="cover" className="bg-slate-200" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                  <div className="absolute bottom-2 left-2 right-2">
                    <h2 className="text-lg font-semibold text-white">{match.name}, {match.age}</h2>
                    {match.matchPercentage && (
                        <div className="mt-0.5">
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                {match.matchPercentage}% Match
                            </span>
                        </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <p className="text-xs text-slate-600 line-clamp-3 @[280px]/card:line-clamp-4">{match.bio}</p>
                  {match.commonConditions && match.commonConditions.length > 0 && (
                    <div className="mt-2">
                      <h3 className="text-[11px] font-semibold text-slate-500">Shares:</h3>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {match.commonConditions.map((condition, idx) => (
                          <span key={idx} className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                            {condition}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-auto grid grid-cols-2 border-t border-slate-200">
                  <button className="flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600">
                    <XIcon className="h-5 w-5 fill-current" /> Pass
                  </button>
                  <button className="flex items-center justify-center gap-1.5 border-l border-slate-200 py-2.5 text-sm font-medium text-sky-600 hover:bg-sky-50">
                    <HeartIcon className="h-5 w-5 fill-current" /> Like
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="text-3xl text-slate-400">💔</div>
            <h3 className="mt-2 text-sm font-medium text-slate-900">No Matches Yet</h3>
            <p className="mt-1 text-sm text-slate-500">Adjust your filters or check back later.</p>
          </div>
        )}
      </main>

      <BottomNav activePage="Trauma-Bonding" />
    </div>
  );
};

export default TraumaBondingPage;
