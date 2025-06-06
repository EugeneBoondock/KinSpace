'use client';

import React from 'react';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

// Placeholder icons - replace with actual icon components or imports if available
const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-sky-600">
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-3.741-5.602m0 6.082a9.094 9.094 0 013.741-.479m0 0a4.5 4.5 0 01-1.548-8.414M18 18.72L18.75 10.95M21.75 12a9.094 9.094 0 00-3.741-.479m0 0A4.5 4.5 0 0013.5 12M3.75 12a9.094 9.094 0 013.741-.479m0 0A4.5 4.5 0 0112 13.5m0-1.5a4.5 4.5 0 00-4.5-4.5m0 0h-.096c-1.036.83-1.036 2.414 0 3.244M12 13.5V13.5m0 0V15m0 0a3 3 0 11-6 0m0 0V9.75M12 15H9.75M12 9.75A4.5 4.5 0 0116.5 15m0 0V9.75m0 0a4.5 4.5 0 014.5 4.5M16.5 15h-1.875" />
  </svg>
);

const MapPinIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-teal-600">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);

const PlusCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-purple-600">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const GroupFeatureCard = ({ title, description, icon, link }: { title: string; description: string; icon: React.ReactNode; link: string }) => (
  <Link href={link} className="block rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-lg transition-shadow duration-200">
    <div className="flex items-center gap-4">
      <div>{icon}</div>
      <div>
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
    </div>
  </Link>
);

const GroupsPage = () => {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 pb-24 font-manrope">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-slate-50/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-screen-lg items-center justify-between px-4">
          <h1 className="text-xl font-semibold text-slate-900">Groups</h1>
          {/* Optional: Add action button like 'Create Group' if needed later */}
        </div>
      </header>

      {/* Main Content - Group Features */}
      <main className="flex-1 p-4">
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
          <GroupFeatureCard 
            title="Nearby Support Groups"
            description="Find local groups for in-person support and connection."
            icon={<MapPinIcon />}
            link="/nearby-support"
          />
          <GroupFeatureCard 
            title="My Groups"
            description="View and manage groups you've joined or created."
            icon={<UsersIcon />}
            link="/groups/my-groups" // Placeholder link, create this page later
          />
          <GroupFeatureCard 
            title="Create a New Group"
            description="Start your own community around a specific condition or interest."
            icon={<PlusCircleIcon />}
            link="/groups/create" // Placeholder link, create this page later
          />
          {/* Add more group feature cards as needed */}
        </div>

        {/* Placeholder for other group content, e.g., featured groups, announcements */}
        <div className="mt-8 rounded-lg border-2 border-dashed border-slate-300 bg-white p-12 text-center">
            <h3 className="text-sm font-medium text-slate-900">More Coming Soon</h3>
            <p className="mt-1 text-sm text-slate-500">We're always working on new ways to connect.</p>
        </div>
      </main>

      <BottomNav activePage="Groups" />
    </div>
  );
};

export default GroupsPage;
