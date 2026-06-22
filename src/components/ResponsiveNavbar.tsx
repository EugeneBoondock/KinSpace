'use client'

import Link from 'next/link'
import React, { useState } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'

export default function ResponsiveNavbar() {
  const [open, setOpen] = useState(false)
  const { user, loading, signOut } = useAuth()
  const pathname = usePathname()

  const handleLogout = async () => {
    await signOut()
    window.location.href = '/login'
  }

  // The landing page and the auth/onboarding flow ship their own purpose-built
  // chrome (split-screen brand panel, conversational stepper), so the global
  // navbar would be duplicate clutter there.
  const CHROMELESS = ['/', '/login', '/signup', '/onboarding', '/forgot-password', '/reset-password']
  if (CHROMELESS.includes(pathname)) return null

  return (
    <header className={`sticky top-0 z-50 flex items-center justify-between border-b border-brand-line bg-brand-surface/95 px-4 py-3 text-brand-ink backdrop-blur-sm sm:px-6 ${user ? 'md:hidden' : ''}`}>
      <div className="flex items-center gap-3">
        <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/40" aria-label="KinSpace Home">
          <Image src="/images/gather_logo.png" alt="KinSpace" width={36} height={36} className="h-9 w-auto" priority />
          <span className="text-lg font-bold tracking-tight text-brand-ink">KinSpace</span>
        </Link>
      </div>

      <nav className="hidden items-center gap-1 md:flex">
        {loading ? (
          <div className="flex gap-3">
            <div className="h-9 w-20 animate-pulse rounded-full bg-brand-ink/10" />
            <div className="h-9 w-20 animate-pulse rounded-full bg-brand-ink/10" />
          </div>
        ) : !user ? (
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-full px-4 py-2 text-sm font-semibold text-brand-ink/75 transition hover:bg-brand-ink/5 hover:text-brand-ink">
              Log in
            </Link>
            <Link href="/signup" className="rounded-full bg-brand-ink px-5 py-2 text-sm font-semibold text-brand-surface shadow-sm transition hover:bg-brand-ink/90">
              Sign up
            </Link>
          </div>
        ) : (
          <>
            <Link href="/dashboard" className="rounded-full px-3 py-2 text-sm font-medium text-brand-ink/70 transition hover:bg-brand-ink/5 hover:text-brand-ink">
              Dashboard
            </Link>
            <Link href="/therapy" className="rounded-full px-3 py-2 text-sm font-medium text-brand-ink/70 transition hover:bg-brand-ink/5 hover:text-brand-ink">
              Therapy
            </Link>
            <Link href="/games" className="rounded-full px-3 py-2 text-sm font-medium text-brand-ink/70 transition hover:bg-brand-ink/5 hover:text-brand-ink">
              Games
            </Link>
            <Link href={`/profile/${user.userId}`} className="rounded-full px-3 py-2 text-sm font-medium text-brand-ink/70 transition hover:bg-brand-ink/5 hover:text-brand-ink">
              Profile
            </Link>
            <button onClick={handleLogout} className="ml-1 rounded-full bg-brand-ink px-5 py-2 text-sm font-semibold text-brand-surface shadow-sm transition hover:bg-brand-ink/90">
              Log out
            </button>
          </>
        )}
      </nav>

      {/* Authenticated users navigate via BottomNav (bottom tabs + "More" sheet),
          so the mobile hamburger here is only for anonymous visitors. */}
      {!user && (
      <div className="relative md:hidden">
        <button className="flex h-11 w-11 items-center justify-center rounded-full text-brand-ink transition hover:bg-brand-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/40" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? (
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" aria-hidden="true"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M6 18L18 6" /></svg>
          ) : (
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" aria-hidden="true"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-2 w-64 animate-fade-in overflow-hidden rounded-2xl border border-brand-line bg-brand-surface shadow-xl">
              <nav className="flex flex-col py-2">
                <Link href="/" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-brand-ink hover:bg-brand-ink/5" onClick={() => setOpen(false)}>
                  <i className="ri-home-4-line text-lg" aria-hidden="true" /> Home
                </Link>
                <div className="mx-3 my-2 border-t border-brand-line" />
                <div className="space-y-2 px-3 pb-2">
                  <Link href="/signup" className="block rounded-full bg-brand-ink px-4 py-2.5 text-center text-sm font-bold text-brand-surface" onClick={() => setOpen(false)}>Sign up</Link>
                  <Link href="/login" className="block rounded-full border border-brand-line-strong px-4 py-2.5 text-center text-sm font-semibold text-brand-ink" onClick={() => setOpen(false)}>Log in</Link>
                </div>
              </nav>
            </div>
          </>
        )}
      </div>
      )}
    </header>
  )
}
