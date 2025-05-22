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
  conditions: ['Lupus', 'Raynaud\'s Phenomenon'],
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

const UserProfilePage: React.FC<UserProfilePageProps> = ({ params }) => {
  const { userId } = params;

  // For this example, we'll pick one of the mock users to display.
  // In a real app, you would fetch the user based on `userId`.
  const userToDisplay = userId === 'anonymous-example' ? mockAnonymousUser : mockUser;

  const displayName = userToDisplay.isAnonymous
    ? userToDisplay.pseudonym || 'Anonymous User'
    : userToDisplay.username;

  return (
    <div className="min-h-screen flex flex-col items-center p-4 pt-10">
      <div className="w-full max-w-2xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-800">User Profile</h1>
          <p className="text-lg text-gray-600 mt-2">
            Viewing profile for User ID: <span className="font-semibold">{userId}</span>
          </p>
        </header>

        <div className="translucent-bg shadow-xl rounded-lg p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6">
            {/* Placeholder for a profile picture or avatar */}
            <div className="w-24 h-24 bg-gray-300 rounded-full mb-4 sm:mb-0 flex-shrink-0"></div>
            <div>
              <h2 className="text-3xl font-semibold text-gray-800">{displayName}</h2>
              {!userToDisplay.isAnonymous && userToDisplay.pseudonym && (
                <p className="text-md text-gray-600">Also known as: {userToDisplay.pseudonym}</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Conditions</h3>
            {userToDisplay.conditions.length > 0 ? (
              <ul className="list-disc list-inside space-y-1">
                {userToDisplay.conditions.map((condition, index) => (
                  <li key={index} className="text-gray-700">{condition}</li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-600">No conditions listed.</p>
            )}
          </div>

          {userToDisplay.status && (
            <div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Current Status</h3>
              <p className="text-gray-700 bg-pastelPink p-3 rounded-md">{userToDisplay.status}</p>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Member since: {new Date(userToDisplay.createdAt).toLocaleDateString()}
            </p>
            <p className="text-sm text-gray-500">
              Last updated: {new Date(userToDisplay.updatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
