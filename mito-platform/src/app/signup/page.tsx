'use client'; // Required for useState and event handlers

import React, { useState } from 'react';

const SignupPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [conditions, setConditions] = useState('');
  const [status, setStatus] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const profileData = {
      username,
      conditions: conditions.split(',').map(condition => condition.trim()).filter(condition => condition),
      status: status || null, // Set to null if status is empty
    };
    console.log('Profile Data:', profileData);
    // Here you would typically send the data to a backend API
    alert(`Profile created (check console for data):\nUsername: ${username}\nConditions: ${conditions}\nStatus: ${status}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <form
          onSubmit={handleSubmit}
          className="translucent-bg shadow-xl rounded-lg p-8 space-y-6"
        >
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
            Create your Mito Profile
          </h1>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-mintGreen focus:border-mintGreen sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="conditions" className="block text-sm font-medium text-gray-700 mb-1">
              Conditions (comma-separated)
            </label>
            <input
              type="text"
              id="conditions"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-mintGreen focus:border-mintGreen sm:text-sm"
              placeholder="e.g., Lupus, Fibromyalgia"
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status (Optional)
            </label>
            <input
              type="text"
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-mintGreen focus:border-mintGreen sm:text-sm"
              placeholder="e.g., newly diagnosed, stable"
            />
          </div>

          <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-gray-800 bg-peachSorbet hover:bg-orange-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-peachSorbet"
          >
            Create Profile
          </button>
        </form>
      </div>
    </div>
  );
};

export default SignupPage;
