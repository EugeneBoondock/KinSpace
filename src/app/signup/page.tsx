'use client'; // Required for useState and event handlers

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

const SignupPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
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

    // Basic validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if (!username.trim()) {
      setError('Username is required');
      setLoading(false);
      return;
    }

    if (!conditions.trim()) {
      setError('Please enter at least one condition');
      setLoading(false);
      return;
    }

    try {
      // First, sign up the user with basic info
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.trim(),
            full_name: fullName.trim() || username.trim(),
          },
        },
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (data.user) {
        // Wait a moment for the trigger to create the basic profile
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Now update the profile with additional health information
        const profileData = {
          username: username.trim(),
          full_name: fullName.trim() || username.trim(),
          age: age ? parseInt(age) : null,
          location: location.trim() || null,
          bio: bio.trim() || null,
          status: status.trim() || null,
          is_anonymous: isanonymous,
          conditions: conditions ? conditions.split(',').map(c => c.trim()).filter(Boolean) : [],
          comorbidities: comorbidities ? comorbidities.split(',').map(c => c.trim()).filter(Boolean) : [],
          medications: medications ? medications.split(',').map(c => c.trim()).filter(Boolean) : [],
          updated_at: new Date().toISOString(),
        };

        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', data.user.id);

        if (profileError) {
          console.error('Profile update error:', profileError);
          // Try to insert if update failed (in case trigger didn't work)
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              email: data.user.email,
              ...profileData,
              created_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error('Profile insert error:', insertError);
            setError('Account created but profile setup failed. Please complete your profile in settings.');
          }
        }

        // Redirect to email verification
        router.push('/verify-email');
      }
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
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
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-300 mb-1">
              Full Name (Optional)
            </label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-[#eedfc9]/20 rounded-md shadow-sm focus:ring-[#eedfc9] focus:border-[#eedfc9] bg-[#2A4A42] text-[#eedfc9] sm:text-sm"
              placeholder="Your real name (if you want to share)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="age" className="block text-sm font-medium text-gray-300 mb-1">
                Age (Optional)
              </label>
              <input
                type="number"
                id="age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                min="13"
                max="120"
                className="mt-1 block w-full px-4 py-2 border border-[#eedfc9]/20 rounded-md shadow-sm focus:ring-[#eedfc9] focus:border-[#eedfc9] bg-[#2A4A42] text-[#eedfc9] sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-300 mb-1">
                Location (Optional)
              </label>
              <input
                type="text"
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1 block w-full px-4 py-2 border border-[#eedfc9]/20 rounded-md shadow-sm focus:ring-[#eedfc9] focus:border-[#eedfc9] bg-[#2A4A42] text-[#eedfc9] sm:text-sm"
                placeholder="City, Country"
              />
            </div>
          </div>

          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-300 mb-1">
              Bio (Optional)
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-4 py-2 border border-[#eedfc9]/20 rounded-md shadow-sm focus:ring-[#eedfc9] focus:border-[#eedfc9] bg-[#2A4A42] text-[#eedfc9] sm:text-sm"
              placeholder="Tell us a bit about yourself..."
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
