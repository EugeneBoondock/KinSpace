'use client'; // Can be a client component for now, or server if data fetching is added

import React from 'react';
import { UserProfile } from '@/lib/types'; // Adjusted import path

interface UserProfilePageProps {
  params: {
    userId: string;
  };
}

// Mock user data
const mockUser: UserProfile = {
  id: '123-abc',
  username: 'MitoUser123',
  pseudonym: 'ChronicWarrior',
  isAnonymous: false,
  conditions: ['Lupus', "Raynaud's Phenomenon"],
  status: 'Managing daily symptoms',
  createdAt: new Date('2023-01-15T09:30:00Z'),
  updatedAt: new Date('2023-10-26T14:45:00Z'),
};

const mockAnonymousUser: UserProfile = {
  id: '456-def',
  username: 'AnonymousUser', // This username would typically not be shown directly
  pseudonym: null,
  isAnonymous: true,
  conditions: ['Fibromyalgia'],
  status: 'Newly Diagnosed',
  createdAt: new Date('2023-03-20T11:00:00Z'),
  updatedAt: new Date('2023-09-01T10:00:00Z'),
};

const UserProfilePage = ({ params }: { params: { userId: string } }) => {
  const { userId } = params;

  // For this example, we'll pick one of the mock users to display.
  // In a real app, you would fetch the user based on `userId`.
  const userToDisplay = userId === 'anonymous-example' ? mockAnonymousUser : mockUser;

  const displayName = userToDisplay.isAnonymous
    ? userToDisplay.pseudonym || 'Anonymous User'
    : userToDisplay.username;

  return (
    <div className="min-h-screen flex flex-col items-center p-4 pt-10 bg-[#111b22]" style={{ fontFamily: 'Manrope, Noto Sans, sans-serif' }}>
      <div className="w-full max-w-2xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white">User Profile</h1>
          <p className="text-lg text-gray-300 mt-2">
            Viewing profile for User ID: <span className="font-semibold">{userId}</span>
          </p>
        </header>

        <div className="rounded-xl bg-[#192734] shadow-xl p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6">
            {/* Placeholder for a profile picture or avatar */}
            <div className="w-24 h-24 bg-gray-700 rounded-full mb-4 sm:mb-0 flex-shrink-0"></div>
            <div>
              <h2 className="text-3xl font-semibold text-white">{displayName}</h2>
              {!userToDisplay.isAnonymous && userToDisplay.pseudonym && (
                <p className="text-md text-gray-400">Also known as: {userToDisplay.pseudonym}</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Conditions</h3>
            {userToDisplay.conditions.length > 0 ? (
              <ul className="list-disc list-inside space-y-1 text-gray-200">
                {userToDisplay.conditions.map((condition, index) => (
                  <li key={index}>{condition}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400">No conditions listed.</p>
            )}
          </div>

          {userToDisplay.status && (
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">Current Status</h3>
              <p className="text-gray-200 bg-[#243947] p-3 rounded-md">{userToDisplay.status}</p>
            </div>
          )}

          <div className="pt-4 border-t border-gray-700">
            <p className="text-sm text-gray-500">
              Member since: {new Date(userToDisplay.createdAt).toLocaleDateString()}
            </p>
            <p className="text-sm text-gray-500">
              Last updated: {new Date(userToDisplay.updatedAt).toLocaleDateString()}
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-mintGreen mb-2">Comorbidities</h3>
            <p className="text-gray-600 italic">(Coming soon: Add and display comorbidities)</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-pastelPink mb-2">Medication Log</h3>
            <p className="text-gray-600 italic">(Coming soon: Log and find others on similar treatments)</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-peachSorbet mb-2">Symptom Tracker</h3>
            <p className="text-gray-600 italic">(Coming soon: Integrate with Bearable, Healthily, or custom tracker)</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            <div className="bg-white/80 rounded-xl p-4 shadow">
              <h4 className="font-bold text-mintGreen">Mood & Pain Charts</h4>
              <p className="text-gray-600 text-sm">(Coming soon: Visualize and share with your care team)</p>
            </div>
            <div className="bg-white/80 rounded-xl p-4 shadow">
              <h4 className="font-bold text-pastelPink">Self-Care Scheduler</h4>
              <p className="text-gray-600 text-sm">(Coming soon: Water, meds, rest, and mental health routines)</p>
            </div>
            <div className="bg-white/80 rounded-xl p-4 shadow">
              <h4 className="font-bold text-peachSorbet">Gamification</h4>
              <p className="text-gray-600 text-sm">(Coming soon: Streaks, stars, kudos wall, progress tree)</p>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/80 rounded-xl p-4 shadow">
              <h4 className="font-bold text-pastelPink">Voice Notes</h4>
              <p className="text-gray-600 text-sm">(Coming soon: Upload and listen to voice notes)</p>
            </div>
            <div className="bg-white/80 rounded-xl p-4 shadow flex items-center gap-2">
              <input type="checkbox" id="flareMode" className="h-4 w-4 text-powderBlue border-gray-300 rounded focus:ring-powderBlue" disabled />
              <label htmlFor="flareMode" className="text-sm text-gray-700">Flare Mode (low-stimulus UI)</label>
            </div>
            <div className="bg-white/80 rounded-xl p-4 shadow">
              <h4 className="font-bold text-peachSorbet">Mito Radio</h4>
              <p className="text-gray-600 text-sm">(Coming soon: Listen to community podcasts)</p>
            </div>
            <div className="bg-white/80 rounded-xl p-4 shadow">
              <h4 className="font-bold text-mintGreen">Art Wall</h4>
              <p className="text-gray-600 text-sm">(Coming soon: Poetry, digital art, and music by users)</p>
            </div>
            <div className="bg-white/80 rounded-xl p-4 shadow">
              <h4 className="font-bold text-powderBlue">Legacy Mode</h4>
              <p className="text-gray-600 text-sm">(Coming soon: Leave messages, memoirs, or stories for others)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
