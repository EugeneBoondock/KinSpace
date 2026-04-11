'use client'

import Link from 'next/link'
import React, { useState } from 'react'
import Image from 'next/image'
import { useAuth } from '@/lib/AuthContext'

export default function ResponsiveNavbar() {
  const [open, setOpen] = useState(false)
  const { user, loading, signOut } = useAuth()

  const handleLogout = async () => {
    await signOut()
    window.location.href = '/login'
  }

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3 bg-[#eedfc8] text-brand-primary border-b border-brand-accent3/20 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2" aria-label="KinSpace Home">
          <Image src="/images/gather_logo.png" alt="KinSpace" width={36} height={36} className="h-9 w-auto" priority />
          <span className="text-brand-primary text-lg font-bold tracking-tight">KinSpace</span>
        </Link>
      </div>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-4">
        {loading ? (
          <div className="flex gap-3">
            <div className="w-20 h-9 bg-brand-primary/10 rounded-full animate-pulse" />
            <div className="w-20 h-9 bg-brand-primary/10 rounded-full animate-pulse" />
          </div>
        ) : !user ? (
          <>
            <Link href="/signup" className="px-5 py-2 bg-brand-primary text-[#eedfc8] rounded-full text-sm font-semibold hover:bg-brand-primary/90 transition shadow-sm">
              Sign Up
            </Link>
            <Link href="/login" className="px-5 py-2 border border-brand-primary/30 text-brand-primary rounded-full text-sm font-semibold hover:bg-brand-primary/5 transition">
              Log In
            </Link>
          </>
        ) : (
          <>
            <Link href="/dashboard" className="text-brand-primary/70 text-sm font-medium hover:text-brand-primary transition px-2 py-1">
              Dashboard
            </Link>
            <Link href="/therapy" className="text-brand-primary/70 text-sm font-medium hover:text-brand-primary transition px-2 py-1">
              Therapy
            </Link>
            <Link href="/games" className="text-brand-primary/70 text-sm font-medium hover:text-brand-primary transition px-2 py-1">
              Games
            </Link>
            <Link href={`/profile/${user.userId}`} className="text-brand-primary/70 text-sm font-medium hover:text-brand-primary transition px-2 py-1">
              Profile
            </Link>
            <button onClick={handleLogout} className="px-5 py-2 bg-brand-primary text-[#eedfc8] rounded-full text-sm font-semibold hover:bg-brand-primary/90 transition shadow-sm">
              Logout
            </button>
          </>
        )}
      </nav>

      {/* Mobile hamburger */}
      <div className="md:hidden relative">
        <button className="p-2 text-brand-primary" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>
          {open ? (
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M6 18L18 6" /></svg>
          ) : (
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>

        {/* Dropdown menu */}
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-2xl border border-brand-primary/10 bg-[#eedfc8] shadow-xl overflow-hidden">
              <nav className="flex flex-col py-2">
                {!user ? (
                  <>
                    <Link href="/" className="flex items-center gap-3 px-4 py-3 text-brand-primary text-sm font-medium hover:bg-brand-primary/5" onClick={() => setOpen(false)}>
                      <i className="ri-home-4-line text-lg" /> Home
                    </Link>
                    <div className="mx-3 my-2 border-t border-brand-primary/10" />
                    <div className="px-3 pb-2 space-y-2">
                      <Link href="/signup" className="block px-4 py-2.5 text-center bg-brand-primary text-[#eedfc8] rounded-full text-sm font-bold" onClick={() => setOpen(false)}>Sign Up</Link>
                      <Link href="/login" className="block px-4 py-2.5 text-center border border-brand-primary/30 text-brand-primary rounded-full text-sm font-semibold" onClick={() => setOpen(false)}>Log In</Link>
                    </div>
                  </>
                ) : (
                  <>
                    <Link href="/dashboard" className="flex items-center gap-3 px-4 py-2.5 text-brand-primary text-sm hover:bg-brand-primary/5" onClick={() => setOpen(false)}>
                      <i className="ri-home-4-line text-lg" /> Dashboard
                    </Link>
                    <Link href="/explore" className="flex items-center gap-3 px-4 py-2.5 text-brand-primary text-sm hover:bg-brand-primary/5" onClick={() => setOpen(false)}>
                      <i className="ri-compass-3-line text-lg" /> Explore
                    </Link>
                    <Link href="/community" className="flex items-center gap-3 px-4 py-2.5 text-brand-primary text-sm hover:bg-brand-primary/5" onClick={() => setOpen(false)}>
                      <i className="ri-chat-3-line text-lg" /> Community
                    </Link>
                    <Link href="/therapy" className="flex items-center gap-3 px-4 py-2.5 text-brand-primary text-sm hover:bg-brand-primary/5" onClick={() => setOpen(false)}>
                      <i className="ri-heart-pulse-line text-lg" /> Therapy
                    </Link>
                    <Link href="/games" className="flex items-center gap-3 px-4 py-2.5 text-brand-primary text-sm hover:bg-brand-primary/5" onClick={() => setOpen(false)}>
                      <i className="ri-gamepad-line text-lg" /> Games
                    </Link>
                    <Link href="/resources" className="flex items-center gap-3 px-4 py-2.5 text-brand-primary text-sm hover:bg-brand-primary/5" onClick={() => setOpen(false)}>
                      <i className="ri-book-open-line text-lg" /> Resources
                    </Link>
                    <Link href={`/profile/${user.userId}`} className="flex items-center gap-3 px-4 py-2.5 text-brand-primary text-sm hover:bg-brand-primary/5" onClick={() => setOpen(false)}>
                      <i className="ri-user-line text-lg" /> Profile
                    </Link>
                    <Link href="/settings" className="flex items-center gap-3 px-4 py-2.5 text-brand-primary text-sm hover:bg-brand-primary/5" onClick={() => setOpen(false)}>
                      <i className="ri-settings-3-line text-lg" /> Settings
                    </Link>
                    <div className="mx-3 my-1 border-t border-brand-primary/10" />
                    <div className="px-3 py-2">
                      <button onClick={() => { setOpen(false); handleLogout(); }} className="w-full px-4 py-2.5 text-center bg-brand-accent1 text-white rounded-full text-sm font-semibold">
                        Log Out
                      </button>
                    </div>
                  </>
                )}
              </nav>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
