'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthService } from '@/lib/auth';
import { DatabaseService } from '@/lib/database';
import { EncryptionService } from '@/lib/encryption';

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

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1 fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');

  // Step 2 fields
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');

  // Step 3 fields
  const [conditions, setConditions] = useState<string[]>([]);
  const [conditionInput, setConditionInput] = useState('');
  const [comorbidities, setComorbidities] = useState('');
  const [medications, setMedications] = useState('');
  const [status, setStatus] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const totalSteps = 3;

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

  const validateStep = (currentStep: number): boolean => {
    setError('');

    if (currentStep === 1) {
      if (!email.trim()) {
        setError('Email is required.');
        return false;
      }
      if (!username.trim()) {
        setError('Username is required.');
        return false;
      }
      if (username.trim().length < 3) {
        setError('Username must be at least 3 characters.');
        return false;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return false;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return false;
      }
    }

    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await AuthService.signUp(email, password, {
        username: username.trim(),
        full_name: fullName.trim() || username.trim(),
      });

      if (result) {
        // Allow background processes to settle
        await new Promise((resolve) => setTimeout(resolve, 1500));

        try {
          const currentUser = await AuthService.getCurrentUser();
          if (currentUser) {
            const conditionsArr = conditions;
            const comorbiditiesArr = comorbidities
              ? comorbidities.split(',').map((c) => c.trim()).filter(Boolean)
              : [];
            const medicationsArr = medications
              ? medications.split(',').map((c) => c.trim()).filter(Boolean)
              : [];

            // Encrypt sensitive health data
            const key = await EncryptionService.getOrCreateUserKey(currentUser.userId);
            const encryptedFields = await EncryptionService.encryptFields(
              {
                conditions: conditionsArr,
                comorbidities: comorbiditiesArr,
                medications: medicationsArr,
                status: status || null,
              },
              key,
            );

            const profileData = {
              username: username.trim(),
              full_name: fullName.trim() || username.trim(),
              email,
              age: age ? parseInt(age) : null,
              location: location.trim() || null,
              bio: bio.trim() || null,
              is_anonymous: isAnonymous,
              onboarding_complete: true,
              ...encryptedFields,
            };

            await DatabaseService.updateProfile(currentUser.userId, profileData);
          }
        } catch (profileErr) {
          console.error('Profile setup error:', profileErr);
        }

        router.push('/verify-email');
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('email-already-in-use')) {
          setError('This email is already registered. Try signing in instead.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#eedfc8] mb-1">Join KinSpace</h1>
          <p className="text-sm text-[#eedfc8]/50">Create your safe space in 3 simple steps</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => {
            const stepNum = i + 1;
            const isActive = stepNum === step;
            const isComplete = stepNum < step;

            return (
              <React.Fragment key={stepNum}>
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                    isComplete
                      ? 'bg-[#6B8A83] text-white'
                      : isActive
                      ? 'bg-[#D19A58] text-white'
                      : 'bg-[#eedfc8]/10 text-[#eedfc8]/40'
                  }`}
                >
                  {isComplete ? (
                    <i className="ri-check-line" />
                  ) : (
                    stepNum
                  )}
                </div>
                {stepNum < totalSteps && (
                  <div
                    className={`w-12 h-0.5 rounded transition-all duration-300 ${
                      isComplete ? 'bg-[#6B8A83]' : 'bg-[#eedfc8]/10'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Google Sign Up (shown on step 1) */}
        {step === 1 && (
          <div className="mb-4">
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                setError('');
                try {
                  const result = await AuthService.signInWithGoogle();
                  router.push(result.isNewUser ? '/onboarding' : '/dashboard');
                } catch (err) {
                  console.error('Google sign-in error:', err);
                  if (err instanceof Error) {
                    if (err.message.includes('popup-closed') || err.message.includes('cancelled-popup-request')) {
                      // User closed the popup, no error needed
                    } else if (err.message.includes('unauthorized-domain') || err.message.includes('auth-domain')) {
                      setError('This domain is not authorized for Google sign-in. The site admin needs to add this domain in Firebase Console > Authentication > Settings > Authorized domains.');
                    } else if (err.message.includes('popup-blocked')) {
                      setError('Popup was blocked by your browser. Please allow popups for this site and try again.');
                    } else if (err.message.includes('network-request-failed')) {
                      setError('Network error. Please check your connection and try again.');
                    } else {
                      setError(`Google sign-up failed: ${err.message}`);
                    }
                  } else {
                    setError('Google sign-up failed. Please try again.');
                  }
                } finally {
                  setLoading(false);
                }
              }}
              className="btn-secondary w-full py-3 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign up with Google
            </button>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-[#eedfc8]/10" />
              <span className="text-xs text-[#eedfc8]/30">or use email</span>
              <div className="flex-1 h-px bg-[#eedfc8]/10" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Step 1: Account Details */}
          {step === 1 && (
            <div className="card space-y-5 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-user-add-line text-[#D19A58]" />
                <h2 className="font-semibold text-[#eedfc8]">Account Details</h2>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[#eedfc8]/80 mb-1.5">
                  Email <span className="text-[#B85C3A]">*</span>
                </label>
                <div className="relative">
                  <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-[#eedfc8]/40" />
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="input-field pl-10"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-[#eedfc8]/80 mb-1.5">
                  Username <span className="text-[#B85C3A]">*</span>
                </label>
                <div className="relative">
                  <i className="ri-at-line absolute left-3 top-1/2 -translate-y-1/2 text-[#eedfc8]/40" />
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="Choose a username"
                    className="input-field pl-10"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-[#eedfc8]/80 mb-1.5">
                  Password <span className="text-[#B85C3A]">*</span>
                </label>
                <div className="relative">
                  <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-[#eedfc8]/40" />
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Min 6 characters"
                    className="input-field pl-10"
                  />
                </div>
                {password.length > 0 && password.length < 6 && (
                  <p className="text-xs text-[#B85C3A] mt-1">
                    <i className="ri-information-line mr-1" />
                    Password must be at least 6 characters
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#eedfc8]/80 mb-1.5">
                  Confirm Password <span className="text-[#B85C3A]">*</span>
                </label>
                <div className="relative">
                  <i className="ri-lock-check-line absolute left-3 top-1/2 -translate-y-1/2 text-[#eedfc8]/40" />
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-enter your password"
                    className="input-field pl-10"
                  />
                </div>
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <p className="text-xs text-[#B85C3A] mt-1">
                    <i className="ri-information-line mr-1" />
                    Passwords do not match
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <i className="ri-error-warning-line text-red-400 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                type="button"
                onClick={nextStep}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2"
              >
                Continue
                <i className="ri-arrow-right-line" />
              </button>

              <p className="text-center text-sm text-[#eedfc8]/50">
                Already have an account?{' '}
                <Link href="/login" className="text-[#D19A58] hover:text-[#D19A58]/80 font-medium transition-colors">
                  Sign in
                </Link>
              </p>
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
                  onClick={prevStep}
                  className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2"
                >
                  <i className="ri-arrow-left-line" />
                  Back
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
              <p className="text-xs text-[#eedfc8]/50 -mt-2">
                Help us connect you with the right community. All data is private.
              </p>

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
                  onClick={prevStep}
                  className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2"
                >
                  <i className="ri-arrow-left-line" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-accent flex-1 py-3 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <i className="ri-loader-4-line animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <i className="ri-check-line" />
                      Create Account
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
