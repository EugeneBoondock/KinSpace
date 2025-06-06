'use client'; // Required for useState and event handlers

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

const SignupPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [conditions, setConditions] = useState('');
  const [status, setStatus] = useState('');
  const [comorbidities, setComorbidities] = useState('');
  const [medications, setMedications] = useState('');
  const [isanonymous, setIsAnonymous] = useState(false);

  const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [error, setError] = useState('');
const [loading, setLoading] = useState(false);
const router = useRouter();

const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault();
  setError('');
  setLoading(true);

  // 1. Sign up the user with Supabase Auth
  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        isanonymous,
      },
      emailRedirectTo: "https://thegathering.vercel.app/login?verified=1"
    },
  });
  setLoading(false);
  if (signUpError) {
    setError(signUpError.message);
    return;
  }
  // Success: redirect to verify email page
  router.push('/verify-email');
};

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#2A4A42]" style={{ fontFamily: 'Manrope, Noto Sans, sans-serif' }}>
      <div className="w-full max-w-md">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl bg-[#2A4A42] shadow-xl border border-[#eedfc9]/20 p-8 space-y-6"
        >
          <h1 className="text-3xl font-bold text-center text-[#eedfc9] mb-8">
            Join the Kin Space
          </h1>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#eedfc9] mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-4 py-2 border border-[#eedfc9]/20 rounded-md shadow-sm focus:ring-[#eedfc9] focus:border-[#eedfc9] bg-[#2A4A42] text-[#eedfc9] sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full px-4 py-2 border border-[#eedfc9]/20 rounded-md shadow-sm focus:ring-[#eedfc9] focus:border-[#eedfc9] bg-[#2A4A42] text-[#eedfc9] sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="mt-1 block w-full px-4 py-2 border border-[#eedfc9]/20 rounded-md shadow-sm focus:ring-[#eedfc9] focus:border-[#eedfc9] bg-[#2A4A42] text-[#eedfc9] sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="conditions" className="block text-sm font-medium text-gray-300 mb-1">
              Conditions (comma-separated)
            </label>
            <input
              type="text"
              id="conditions"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              required
              className="mt-1 block w-full px-4 py-2 border border-[#eedfc9]/20 rounded-md shadow-sm focus:ring-[#eedfc9] focus:border-[#eedfc9] bg-[#2A4A42] text-[#eedfc9] sm:text-sm"
              placeholder="e.g., Lupus, Fibromyalgia"
            />
          </div>

          <div>
            <label htmlFor="comorbidities" className="block text-sm font-medium text-gray-300 mb-1">
              Comorbidities (comma-separated, optional)
            </label>
            <input
              type="text"
              id="comorbidities"
              value={comorbidities}
              onChange={(e) => setComorbidities(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-[#eedfc9]/20 rounded-md shadow-sm focus:ring-[#eedfc9] focus:border-[#eedfc9] bg-[#2A4A42] text-[#eedfc9] sm:text-sm"
              placeholder="e.g., Diabetes, Hypertension"
            />
          </div>

          <div>
            <label htmlFor="medications" className="block text-sm font-medium text-gray-300 mb-1">
              Medications (comma-separated, optional)
            </label>
            <input
              type="text"
              id="medications"
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-[#eedfc9]/20 rounded-md shadow-sm focus:ring-[#eedfc9] focus:border-[#eedfc9] bg-[#2A4A42] text-[#eedfc9] sm:text-sm"
              placeholder="e.g., Prednisone, Methotrexate"
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-300 mb-1">
              Status (Optional)
            </label>
            <input
              type="text"
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-[#eedfc9]/20 rounded-md shadow-sm focus:ring-[#eedfc9] focus:border-[#eedfc9] bg-[#2A4A42] text-[#eedfc9] sm:text-sm"
              placeholder="e.g., newly diagnosed, stable"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isanonymous"
              checked={isanonymous}
              onChange={() => setIsAnonymous(!isanonymous)}
              className="h-4 w-4 text-blue-400 border-gray-700 rounded focus:ring-blue-400"
            />
            <label htmlFor="isanonymous" className="text-sm text-gray-300">Stay anonymous (use a pseudonym)</label>
          </div>

          <div className="bg-[#192734] rounded p-3 mt-2 text-gray-500 text-xs">
            (Coming soon: Symptom tracker integration)
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Profile'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SignupPage;
