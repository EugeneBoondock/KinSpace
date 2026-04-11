'use client';

import Link from 'next/link';
import Image from 'next/image';
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

const supportCategories = [
  { name: 'Mental Health', icon: 'ri-mental-health-line', members: '12.4k', color: '#6B8A83' },
  { name: 'Chronic Illness', icon: 'ri-heart-pulse-line', members: '9.8k', color: '#B85C3A' },
  { name: 'Addiction Recovery', icon: 'ri-shield-star-line', members: '7.2k', color: '#D19A58' },
  { name: 'Grief & Loss', icon: 'ri-emotion-sad-line', members: '5.6k', color: '#6B8A83' },
  { name: 'Disability', icon: 'ri-wheelchair-line', members: '4.3k', color: '#B85C3A' },
  { name: 'Rare Conditions', icon: 'ri-microscope-line', members: '3.1k', color: '#D19A58' },
];

const testimonials = [
  {
    quote: 'KinSpace gave me a community that truly understands what living with lupus feels like. I no longer feel alone.',
    author: 'Sarah M.',
    condition: 'Lupus Warrior',
    avatar: 'ri-user-heart-line',
  },
  {
    quote: 'After years of silent grief, I found people here who helped me heal. This app changed my life.',
    author: 'James T.',
    condition: 'Grief Support',
    avatar: 'ri-user-smile-line',
  },
  {
    quote: 'The anonymous mode let me open up about my recovery journey without fear. Truly a safe space.',
    author: 'Anonymous',
    condition: 'Recovery Journey',
    avatar: 'ri-user-line',
  },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="skeleton w-20 h-20 rounded-full" />
          <div className="skeleton w-48 h-6" />
          <div className="skeleton w-64 h-4" />
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Hero Section */}
      <section className="relative px-4 pt-12 pb-16 sm:pt-20 sm:pb-24 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#D19A58] opacity-[0.04] rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-lg mx-auto text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="hero-glow rounded-full p-1">
              <Image
                src="/images/gather_logo.png"
                alt="KinSpace Logo"
                width={96}
                height={96}
                className="rounded-full"
                priority
              />
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-[#eedfc8] mb-3 leading-tight">
            Your Cozy Corner
            <br />
            <span className="text-[#D19A58]">for Healing</span>
          </h1>

          <p className="text-[#eedfc8]/70 text-base sm:text-lg mb-8 max-w-md mx-auto leading-relaxed">
            A warm, supportive community connecting people navigating chronic illness,
            mental health, addiction recovery, grief, and more.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link href="/signup" className="btn-primary text-base px-8 py-3 w-full sm:w-auto text-center">
              Join Our Community
            </Link>
            <Link href="/login" className="btn-secondary text-base px-8 py-3 w-full sm:w-auto text-center">
              Sign In
            </Link>
          </div>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-[#eedfc8]/50">
            <div className="flex items-center gap-1.5">
              <i className="ri-group-line text-[#D19A58]" />
              <span>42k+ Members</span>
            </div>
            <div className="flex items-center gap-1.5">
              <i className="ri-shield-check-line text-[#6B8A83]" />
              <span>Safe Space</span>
            </div>
            <div className="flex items-center gap-1.5">
              <i className="ri-lock-line text-[#B85C3A]" />
              <span>Private</span>
            </div>
          </div>
        </div>
      </section>

      {/* Support Categories */}
      <section className="px-4 mb-12 max-w-lg mx-auto">
        <h2 className="section-title text-center text-xl mb-6">
          Find Your People
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {supportCategories.map((cat) => (
            <div
              key={cat.name}
              className="card-light flex flex-col items-center text-center p-4 hover:border-[#eedfc8]/25 transition-all duration-200 cursor-pointer"
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ backgroundColor: `${cat.color}20` }}
              >
                <i className={`${cat.icon} text-xl`} style={{ color: cat.color }} />
              </div>
              <span className="text-sm font-semibold text-[#eedfc8] mb-1">{cat.name}</span>
              <span className="text-xs text-[#eedfc8]/50">
                <i className="ri-group-line mr-1" />
                {cat.members}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Emergency Action Bar */}
      <section className="px-4 mb-12 max-w-lg mx-auto">
        <div className="card border-[#B85C3A]/30 bg-[#B85C3A]/10">
          <div className="flex items-center gap-2 mb-3">
            <i className="ri-first-aid-kit-line text-[#B85C3A] text-lg" />
            <h3 className="font-semibold text-[#eedfc8] text-sm">Need Immediate Help?</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <a
              href="tel:988"
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#B85C3A]/20 hover:bg-[#B85C3A]/30 transition-colors"
            >
              <i className="ri-phone-line text-[#B85C3A] text-xl" />
              <span className="text-xs text-[#eedfc8] font-medium text-center">Call 988 Hotline</span>
            </a>
            <a
              href="https://www.google.com/maps/search/doctor+near+me"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#6B8A83]/20 hover:bg-[#6B8A83]/30 transition-colors"
            >
              <i className="ri-stethoscope-line text-[#6B8A83] text-xl" />
              <span className="text-xs text-[#eedfc8] font-medium text-center">Find Doctors</span>
            </a>
            <a
              href="https://www.google.com/maps/search/pharmacy+near+me"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#D19A58]/20 hover:bg-[#D19A58]/30 transition-colors"
            >
              <i className="ri-capsule-line text-[#D19A58] text-xl" />
              <span className="text-xs text-[#eedfc8] font-medium text-center">Find Pharmacies</span>
            </a>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-4 mb-12 max-w-lg mx-auto">
        <h2 className="section-title text-center text-xl mb-6">
          Stories from Our Community
        </h2>
        <div className="flex flex-col gap-4">
          {testimonials.map((t, i) => (
            <div key={i} className="card-light">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#D19A58]/20 flex items-center justify-center flex-shrink-0">
                  <i className={`${t.avatar} text-[#D19A58]`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#eedfc8]/80 italic leading-relaxed mb-2">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#eedfc8]">{t.author}</span>
                    <span className="badge text-xs">{t.condition}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 mb-8 max-w-lg mx-auto">
        <div className="card text-center py-8">
          <i className="ri-hand-heart-line text-4xl text-[#D19A58] mb-4 block" />
          <h2 className="text-xl font-bold text-[#eedfc8] mb-2">
            You Don&apos;t Have to Do This Alone
          </h2>
          <p className="text-sm text-[#eedfc8]/60 mb-6 max-w-sm mx-auto">
            Join thousands who have found comfort, understanding, and hope in our community.
          </p>
          <Link
            href="/signup"
            className="btn-accent text-base px-10 py-3 inline-block"
          >
            Get Started Free
          </Link>
          <p className="text-xs text-[#eedfc8]/40 mt-3">
            No credit card required. Always free.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 max-w-lg mx-auto text-center">
        <div className="border-t border-[#eedfc8]/10 pt-6">
          <div className="flex justify-center gap-6 mb-4">
            <a href="#" className="text-[#eedfc8]/40 hover:text-[#eedfc8]/60 text-sm transition-colors">About</a>
            <a href="#" className="text-[#eedfc8]/40 hover:text-[#eedfc8]/60 text-sm transition-colors">Privacy</a>
            <a href="#" className="text-[#eedfc8]/40 hover:text-[#eedfc8]/60 text-sm transition-colors">Terms</a>
            <a href="#" className="text-[#eedfc8]/40 hover:text-[#eedfc8]/60 text-sm transition-colors">Contact</a>
          </div>
          <p className="text-xs text-[#eedfc8]/30">
            KinSpace &mdash; A safe place for healing, together.
          </p>
        </div>
      </footer>
    </div>
  );
}
