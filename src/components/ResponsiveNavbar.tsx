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
      <div className={`flex items-center gap-3 ${open ? 'hidden md:flex' : ''}`}>
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
      {!open && (
        <button className="md:hidden p-2 text-brand-primary" aria-label="Open menu" onClick={() => setOpen(true)}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}

      {/* Mobile fullscreen menu */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 bg-[#eedfc8] flex flex-col animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-brand-primary/10">
            <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2" onClick={() => setOpen(false)}>
              <Image src="/images/gather_logo.png" alt="KinSpace" width={36} height={36} className="h-9 w-auto" />
              <span className="text-brand-primary text-lg font-bold">KinSpace</span>
            </Link>
            <button className="p-2 text-brand-primary" aria-label="Close menu" onClick={() => setOpen(false)}>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M6 18L18 6" /></svg>
            </button>
          </div>
          <nav className="flex-1 flex flex-col gap-1 p-4 overflow-y-auto">
            {!user ? (
              <>
                <Link href="/" className="block px-4 py-3 text-brand-primary rounded-xl text-base font-medium hover:bg-brand-primary/5" onClick={() => setOpen(false)}>Home</Link>
                <Link href="/signup" className="block px-4 py-3 mt-4 text-center bg-brand-primary text-[#eedfc8] rounded-full text-base font-bold" onClick={() => setOpen(false)}>Sign Up</Link>
                <Link href="/login" className="block px-4 py-3 mt-2 text-center border border-brand-primary/30 text-brand-primary rounded-full text-base font-semibold" onClick={() => setOpen(false)}>Log In</Link>
              </>
            ) : (
              <>
                <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 text-brand-primary rounded-xl hover:bg-brand-primary/5" onClick={() => setOpen(false)}>
                  <i className="ri-home-4-line text-xl" /> Dashboard
                </Link>
                <Link href="/explore" className="flex items-center gap-3 px-4 py-3 text-brand-primary rounded-xl hover:bg-brand-primary/5" onClick={() => setOpen(false)}>
                  <i className="ri-compass-3-line text-xl" /> Explore
                </Link>
                <Link href="/community" className="flex items-center gap-3 px-4 py-3 text-brand-primary rounded-xl hover:bg-brand-primary/5" onClick={() => setOpen(false)}>
                  <i className="ri-chat-3-line text-xl" /> Community
                </Link>
                <Link href="/therapy" className="flex items-center gap-3 px-4 py-3 text-brand-primary rounded-xl hover:bg-brand-primary/5" onClick={() => setOpen(false)}>
                  <i className="ri-heart-pulse-line text-xl" /> Therapy
                </Link>
                <Link href="/games" className="flex items-center gap-3 px-4 py-3 text-brand-primary rounded-xl hover:bg-brand-primary/5" onClick={() => setOpen(false)}>
                  <i className="ri-gamepad-line text-xl" /> Games
                </Link>
                <Link href="/resources" className="flex items-center gap-3 px-4 py-3 text-brand-primary rounded-xl hover:bg-brand-primary/5" onClick={() => setOpen(false)}>
                  <i className="ri-book-open-line text-xl" /> Resources
                </Link>
                <Link href={`/profile/${user.userId}`} className="flex items-center gap-3 px-4 py-3 text-brand-primary rounded-xl hover:bg-brand-primary/5" onClick={() => setOpen(false)}>
                  <i className="ri-user-line text-xl" /> Profile
                </Link>
                <Link href="/settings" className="flex items-center gap-3 px-4 py-3 text-brand-primary rounded-xl hover:bg-brand-primary/5" onClick={() => setOpen(false)}>
                  <i className="ri-settings-3-line text-xl" /> Settings
                </Link>
                <div className="mt-auto pt-4 border-t border-brand-primary/10">
                  <button onClick={() => { setOpen(false); handleLogout(); }} className="w-full px-4 py-3 text-center bg-brand-accent1 text-white rounded-full font-semibold">
                    Log Out
                  </button>
                </div>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
