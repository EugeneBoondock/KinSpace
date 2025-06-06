'use client';
import Link from "next/link";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "../supabaseClient";
import type { User } from "@supabase/supabase-js";

export default function ResponsiveNavbar() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    // Optionally, subscribe to auth changes for real-time updates
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-brand-accent3 border-opacity-50 px-4 sm:px-10 py-3 relative z-30 bg-[#eedfc8] text-[#2A4A42]">
      {/* Logo and hamburger only if dropdown is not open on mobile */}
      <div className={`flex items-center gap-4 ${open ? 'hidden' : ''} md:flex`}>
        <Link href="/" className="flex items-center gap-2" aria-label="KinSpace Home">
          <Image src="/images/gather_logo.png" alt="KinSpace Logo" width={40} height={40} className="h-10 w-auto" priority />
          <span className="text-[#2A4A42] text-xl font-bold hidden sm:block">KinSpace</span>
        </Link>
      </div>
      {/* Desktop nav */}
      <nav className="hidden md:flex flex-1 justify-end gap-8 items-center">
        <Link className="text-[#2A4A42] text-sm font-medium leading-normal hover:text-brand-accent1 transition-colors duration-200 px-3 py-1 rounded-md hover:bg-[#2A4A42]/10" href="#">About</Link>
        <Link className="text-[#2A4A42] text-sm font-medium leading-normal hover:text-brand-accent1 transition-colors duration-200 px-3 py-1 rounded-md hover:bg-[#2A4A42]/10" href="/features">Features</Link>
        {!user && (
          <>
            <Link href="/signup" className="flex min-w-[100px] cursor-pointer items-center justify-center rounded-full h-10 px-6 bg-[#2A4A42] text-[#eedfc8] border-2 border-[#eedfc8] hover:bg-[#2A4A42]/90 hover:text-white hover:border-white text-sm font-bold transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-brand-accent1/30 hover:-translate-y-0.5">
              <span className="truncate">Sign Up</span>
            </Link>
            <Link href="/login" className="flex min-w-[100px] cursor-pointer items-center justify-center rounded-full h-10 px-6 bg-[#2A4A42] text-[#eedfc8] border-2 border-[#eedfc8] hover:bg-[#2A4A42]/90 hover:text-white hover:border-white text-sm font-bold transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-brand-accent3/30 hover:-translate-y-0.5">
              <span className="truncate">Log In</span>
            </Link>
          </>
        )}
        {user && (
          <button onClick={handleLogout} className="flex min-w-[100px] cursor-pointer items-center justify-center rounded-full h-10 px-6 bg-[#2A4A42] text-[#eedfc8] border-2 border-[#eedfc8] hover:bg-[#2A4A42]/90 hover:text-white hover:border-white text-sm font-bold transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-brand-accent1/30 hover:-translate-y-0.5">
            <span className="truncate">Logout</span>
          </button>
        )}
      </nav>
      {/* Mobile hamburger, only if dropdown is not open */}
      <div className={`md:hidden flex items-center ${open ? 'hidden' : ''}`}>
        <button
          className="text-[#2A4A42] focus:outline-none p-2"
          aria-label="Open menu"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
      {/* Mobile dropdown, only if open */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 bg-[#eedfc8] flex flex-col items-end p-4 animate-fade-in">
          <button
            className="text-[#2A4A42] focus:outline-none p-2 mb-2"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
          <nav className="w-full flex flex-col gap-2">
            <Link href="#" className="block px-4 py-3 text-[#2A4A42] hover:bg-brand-accent3 hover:text-white rounded text-lg font-medium" onClick={() => setOpen(false)}>About</Link>
            <Link href="#" className="block px-4 py-3 text-[#2A4A42] hover:bg-brand-accent3 hover:text-white rounded text-lg font-medium" onClick={() => setOpen(false)}>Features</Link>
            {!user && (
              <>
                <Link href="/signup" className="block w-full text-center px-6 py-3 bg-[#2A4A42] text-[#eedfc8] border-2 border-[#eedfc8] hover:bg-[#2A4A42]/90 hover:text-white hover:border-white rounded-full text-base font-bold mx-2 my-1 transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-brand-accent1/30 hover:-translate-y-0.5" onClick={() => setOpen(false)}>Sign Up</Link>
                <Link href="/login" className="block w-full text-center px-6 py-3 bg-[#2A4A42] text-[#eedfc8] border-2 border-[#eedfc8] hover:bg-[#2A4A42]/90 hover:text-white hover:border-white rounded-full text-base font-bold mx-2 my-1 transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-brand-accent3/30 hover:-translate-y-0.5" onClick={() => setOpen(false)}>Log In</Link>
              </>
            )}
            {user && (
              <button onClick={() => { setOpen(false); handleLogout(); }} className="block px-4 py-3 text-brand-primary hover:bg-brand-accent1 hover:bg-opacity-90 hover:text-brand-background rounded text-lg font-bold w-full text-left">Logout</button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
} 