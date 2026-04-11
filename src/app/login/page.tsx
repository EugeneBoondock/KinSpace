'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthService } from '@/lib/auth';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerified, setShowVerified] = useState(false);

  useEffect(() => {
    if (searchParams.get('verified') === '1') {
      setShowVerified(true);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await AuthService.signIn(email, password);
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('user-not-found') || err.message.includes('wrong-password') || err.message.includes('invalid-credential')) {
          setError('Invalid email or password. Please try again.');
        } else if (err.message.includes('too-many-requests')) {
          setError('Too many attempts. Please try again later.');
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      {/* Verified Modal */}
      {showVerified && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60">
          <div className="card max-w-sm w-full text-center mx-4 animate-slide-up">
            <div className="w-16 h-16 rounded-full bg-[#6B8A83]/20 flex items-center justify-center mx-auto mb-4">
              <i className="ri-checkbox-circle-line text-3xl text-[#6B8A83]" />
            </div>
            <h2 className="text-xl font-bold text-[#eedfc8] mb-2">
              Email Verified!
            </h2>
            <p className="text-sm text-[#eedfc8]/70 mb-6">
              Your email has been confirmed. You can now sign in to your account.
            </p>
            <button
              className="btn-primary w-full"
              onClick={() => setShowVerified(false)}
            >
              Continue to Login
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-[#D19A58]/20 flex items-center justify-center mx-auto mb-4">
            <i className="ri-heart-pulse-line text-2xl text-[#D19A58]" />
          </div>
          <h1 className="text-2xl font-bold text-[#eedfc8] mb-1">Welcome Back</h1>
          <p className="text-sm text-[#eedfc8]/50">Sign in to your KinSpace community</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="card space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#eedfc8]/80 mb-1.5">
              Email
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
            <label htmlFor="password" className="block text-sm font-medium text-[#eedfc8]/80 mb-1.5">
              Password
            </label>
            <div className="relative">
              <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-[#eedfc8]/40" />
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                className="input-field pl-10"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <i className="ri-error-warning-line text-red-400 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <i className="ri-loader-4-line animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <i className="ri-login-box-line" />
                Sign In
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#eedfc8]/10" />
            <span className="text-xs text-[#eedfc8]/30">or</span>
            <div className="flex-1 h-px bg-[#eedfc8]/10" />
          </div>

          {/* Google Sign In */}
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              setError('');
              try {
                await AuthService.signInWithGoogle();
                router.push('/dashboard');
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
                    setError(`Google sign-in failed: ${err.message}`);
                  }
                } else {
                  setError('Google sign-in failed. Please try again.');
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
            Continue with Google
          </button>
        </form>

        {/* Sign up link */}
        <p className="text-center text-sm text-[#eedfc8]/50 mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-[#D19A58] hover:text-[#D19A58]/80 font-medium transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="skeleton w-14 h-14 rounded-full" />
            <div className="skeleton w-40 h-6" />
            <div className="skeleton w-56 h-4" />
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
