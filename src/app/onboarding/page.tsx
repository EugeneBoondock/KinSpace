'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { DatabaseService } from '@/lib/database';
import { EncryptionService } from '@/lib/encryption';
import { StorageService } from '@/lib/storage';

const conditionSuggestions = [
  'Anxiety', 'Depression', 'PTSD', 'Bipolar', 'OCD',
  'Fibromyalgia', 'Lupus', 'Crohn\'s', 'MS', 'Arthritis',
  'Diabetes', 'Cancer', 'ADHD', 'Autism', 'Chronic Pain',
  'Eating Disorder', 'Substance Use', 'Grief', 'COPD', 'Epilepsy',
];

const statusOptions = [
  { value: '', label: 'Select your status' },
  { value: 'newly_diagnosed', label: 'Newly Diagnosed' },
  { value: 'in_treatment', label: 'In Treatment' },
  { value: 'managing', label: 'Managing / Stable' },
  { value: 'in_recovery', label: 'In Recovery' },
  { value: 'remission', label: 'In Remission' },
  { value: 'caregiver', label: 'Caregiver / Supporter' },
  { value: 'prefer_not_to_say', label: 'Prefer Not to Say' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);

  // Step 1 fields (About You)
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Step 2 fields (Health Profile)
  const [conditions, setConditions] = useState<string[]>([]);
  const [conditionInput, setConditionInput] = useState('');
  const [comorbidities, setComorbidities] = useState('');
  const [medications, setMedications] = useState('');
  const [status, setStatus] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const totalSteps = 3; // Welcome + About You + Health Profile

  // Redirect if not logged in or already onboarded
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    const checkOnboarding = async () => {
      try {
        const profile = await DatabaseService.getProfile(user.userId);
        if (profile && (profile as Record<string, unknown>).onboarding_complete) {
          router.push('/dashboard');
          return;
        }
      } catch (err) {
        console.error('Error checking onboarding status:', err);
      } finally {
        setCheckingProfile(false);
      }
    };

    checkOnboarding();
  }, [user, authLoading, router]);

  const addCondition = (condition: string) => {
    const trimmed = condition.trim();
    if (trimmed && !conditions.includes(trimmed)) {
      setConditions([...conditions, trimmed]);
    }
    setConditionInput('');
  };

  const removeCondition = (condition: string) => {
    setConditions(conditions.filter((c) => c !== condition));
  };

  const handleConditionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCondition(conditionInput);
    }
  };

  const nextStep = () => {
    setError('');
    setStep(step + 1);
  };

  const handleSkip = () => {
    if (step < totalSteps) {
      nextStep();
    } else {
      handleComplete();
    }
  };

  const handleSkipAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await DatabaseService.updateProfile(user.userId, { onboarding_complete: true });
      router.push('/dashboard');
    } catch (err) {
      console.error('Skip error:', err);
      router.push('/dashboard');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const validation = StorageService.validateFile(file, 5);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setUploadingAvatar(true);
    setError('');
    try {
      const url = await StorageService.uploadProfileAvatar(user.userId, file);
      setAvatarUrl(url);
      await DatabaseService.updateProfile(user.userId, { avatar_url: url });
    } catch (err) {
      console.error('Avatar upload failed:', err);
      setError('Failed to upload avatar. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleComplete = async () => {
    if (!user) return;

    setError('');
    setLoading(true);

    try {
      const comorbidityArray = comorbidities
        ? comorbidities.split(',').map((c) => c.trim()).filter(Boolean)
        : [];
      const medicationArray = medications
        ? medications.split(',').map((c) => c.trim()).filter(Boolean)
        : [];

      const profileData: Record<string, unknown> = {
        full_name: fullName.trim() || null,
        age: age ? parseInt(age) : null,
        location: location.trim() || null,
        bio: bio.trim() || null,
        status: status || null,
        is_anonymous: isAnonymous,
        updated_at: new Date().toISOString(),
      };

      // Encrypt sensitive health data
      const key = await EncryptionService.getOrCreateUserKey(user.userId);
      const encrypted = await EncryptionService.encryptFields(
        { conditions, comorbidities: comorbidityArray, medications: medicationArray, status },
        key
      );

      await DatabaseService.updateProfile(user.userId, {
        ...profileData,
        ...encrypted,
        onboarding_complete: true,
      });

      router.push('/dashboard');
    } catch (err) {
      console.error('Onboarding error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Loading states
  if (authLoading || checkingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line animate-spin text-3xl text-[#D19A58]" />
          <p className="text-sm text-[#eedfc8]/50 mt-3">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-4 py-8">
      <div className="w-full max-w-md">
        {/* Progress dots (hidden on welcome) */}
        {step > 1 && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {[2, 3].map((s) => {
              const isActive = s === step;
              const isComplete = s < step;
              return (
                <React.Fragment key={s}>
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                      isComplete
                        ? 'bg-[#6B8A83] text-white'
                        : isActive
                        ? 'bg-[#D19A58] text-white'
                        : 'bg-[#eedfc8]/10 text-[#eedfc8]/40'
                    }`}
                  >
                    {isComplete ? <i className="ri-check-line" /> : s - 1}
                  </div>
                  {s < 3 && (
                    <div className={`w-12 h-0.5 rounded transition-all duration-300 ${isComplete ? 'bg-[#6B8A83]' : 'bg-[#eedfc8]/10'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="card text-center space-y-6 animate-fade-in py-8">
            <div className="w-20 h-20 rounded-full bg-[#D19A58]/20 flex items-center justify-center mx-auto">
              <i className="ri-hand-heart-line text-4xl text-[#D19A58]" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-[#eedfc8] mb-2">
                Welcome to KinSpace, {user.displayName?.split(' ')[0] || 'friend'}!
              </h1>
              <p className="text-sm text-[#eedfc8]/60 leading-relaxed max-w-sm mx-auto">
                Let&apos;s set up your profile so we can connect you with the right community.
                This only takes a minute.
              </p>
            </div>

            {/* Privacy promise */}
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-[#6B8A83]/10">
                <i className="ri-shield-keyhole-line text-[#6B8A83] text-lg mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[#eedfc8]">End-to-End Encrypted</p>
                  <p className="text-xs text-[#eedfc8]/50">Your health data is encrypted before it leaves your device. Only you can read it.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-[#D19A58]/10">
                <i className="ri-eye-off-line text-[#D19A58] text-lg mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[#eedfc8]">You Control Your Visibility</p>
                  <p className="text-xs text-[#eedfc8]/50">Choose to stay anonymous. Share only what you&apos;re comfortable with.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-[#B85C3A]/10">
                <i className="ri-delete-bin-line text-[#B85C3A] text-lg mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[#eedfc8]">Delete Anytime</p>
                  <p className="text-xs text-[#eedfc8]/50">You can remove all your data at any point from settings.</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={nextStep}
              className="btn-primary w-full py-3.5 text-base font-bold flex items-center justify-center gap-2"
            >
              Let&apos;s Get Started
              <i className="ri-arrow-right-line" />
            </button>

            <button
              type="button"
              onClick={() => { handleSkipAll(); }}
              className="text-sm text-[#eedfc8]/40 hover:text-[#eedfc8]/60 transition-colors"
            >
              Skip and go to dashboard
            </button>
          </div>
        )}

        {/* Step 2: About You */}
        {step === 2 && (
          <div className="card space-y-5 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <i className="ri-user-heart-line text-[#D19A58]" />
              <h2 className="font-semibold text-[#eedfc8]">About You</h2>
            </div>
            <p className="text-xs text-[#eedfc8]/50 -mt-2">
              These fields are optional. Share what you&apos;re comfortable with.
            </p>

            {/* Avatar Upload */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-[#eedfc8]/10 flex items-center justify-center overflow-hidden border-2 border-[#eedfc8]/20">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="Avatar" width={80} height={80} className="object-cover w-full h-full" />
                  ) : (
                    <i className="ri-user-line text-3xl text-[#eedfc8]/30" />
                  )}
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <i className="ri-loader-4-line animate-spin text-white text-xl" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#D19A58] flex items-center justify-center text-white text-sm hover:bg-[#D19A58]/80 transition-colors"
                >
                  <i className="ri-camera-line" />
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-[#eedfc8]/40">Add a profile photo</p>
            </div>

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-[#eedfc8]/80 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <i className="ri-user-line absolute left-3 top-1/2 -translate-y-1/2 text-[#eedfc8]/40" />
                <input
                  type="text"
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your real name (optional)"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="age" className="block text-sm font-medium text-[#eedfc8]/80 mb-1.5">
                  Age
                </label>
                <input
                  type="number"
                  id="age"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  min="13"
                  max="120"
                  placeholder="Your age"
                  className="input-field"
                />
              </div>
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-[#eedfc8]/80 mb-1.5">
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, Country"
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-[#eedfc8]/80 mb-1.5">
                Bio
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Tell us a bit about yourself..."
                className="input-field resize-none"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <i className="ri-error-warning-line text-red-400 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSkip}
                className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2 text-[#eedfc8]/50"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={nextStep}
                className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
              >
                Continue
                <i className="ri-arrow-right-line" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Health Profile */}
        {step === 3 && (
          <div className="card space-y-5 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <i className="ri-heart-pulse-line text-[#D19A58]" />
              <h2 className="font-semibold text-[#eedfc8]">Health Profile</h2>
            </div>
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#6B8A83]/10 -mt-2">
              <i className="ri-shield-keyhole-line text-[#6B8A83] text-sm mt-0.5" />
              <p className="text-xs text-[#eedfc8]/60">
                This data is <strong className="text-[#6B8A83]">end-to-end encrypted</strong>. Only you can see it.
              </p>
            </div>

            {/* Conditions */}
            <div>
              <label className="block text-sm font-medium text-[#eedfc8]/80 mb-1.5">
                Conditions
              </label>
              {conditions.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {conditions.map((c) => (
                    <span key={c} className="badge flex items-center gap-1 bg-[#D19A58]/20 text-[#D19A58]">
                      {c}
                      <button
                        type="button"
                        onClick={() => removeCondition(c)}
                        className="hover:text-[#B85C3A] transition-colors"
                      >
                        <i className="ri-close-line text-xs" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                type="text"
                value={conditionInput}
                onChange={(e) => setConditionInput(e.target.value)}
                onKeyDown={handleConditionKeyDown}
                placeholder="Type and press Enter, or pick below"
                className="input-field"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {conditionSuggestions
                  .filter((s) => !conditions.includes(s))
                  .slice(0, 10)
                  .map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addCondition(s)}
                      className="text-xs px-2.5 py-1 rounded-full bg-[#eedfc8]/5 text-[#eedfc8]/50 hover:bg-[#eedfc8]/10 hover:text-[#eedfc8]/70 transition-colors"
                    >
                      + {s}
                    </button>
                  ))}
              </div>
            </div>

            {/* Comorbidities */}
            <div>
              <label htmlFor="comorbidities" className="block text-sm font-medium text-[#eedfc8]/80 mb-1.5">
                Comorbidities
              </label>
              <input
                type="text"
                id="comorbidities"
                value={comorbidities}
                onChange={(e) => setComorbidities(e.target.value)}
                placeholder="e.g., Diabetes, Hypertension (comma-separated)"
                className="input-field"
              />
            </div>

            {/* Medications */}
            <div>
              <label htmlFor="medications" className="block text-sm font-medium text-[#eedfc8]/80 mb-1.5">
                Medications
              </label>
              <input
                type="text"
                id="medications"
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                placeholder="e.g., Prednisone, Methotrexate (comma-separated)"
                className="input-field"
              />
            </div>

            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-[#eedfc8]/80 mb-1.5">
                Current Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="input-field"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Anonymous toggle */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-[#eedfc8]/5">
              <button
                type="button"
                onClick={() => setIsAnonymous(!isAnonymous)}
                className={`w-10 h-6 rounded-full flex items-center flex-shrink-0 transition-colors duration-200 ${
                  isAnonymous ? 'bg-[#D19A58]' : 'bg-[#eedfc8]/20'
                }`}
              >
                <span
                  className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    isAnonymous ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
              <div>
                <p className="text-sm font-medium text-[#eedfc8]">Stay Anonymous</p>
                <p className="text-xs text-[#eedfc8]/50">
                  Your real name will be hidden. You&apos;ll appear with your username only.
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <i className="ri-error-warning-line text-red-400 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setStep(step - 1);
                }}
                className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2"
              >
                <i className="ri-arrow-left-line" />
                Back
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={loading}
                className="btn-accent flex-1 py-3 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="ri-check-line" />
                    Complete
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleSkip}
              disabled={loading}
              className="w-full text-center text-sm text-[#eedfc8]/40 hover:text-[#eedfc8]/60 transition-colors py-1"
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
