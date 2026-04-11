'use client';

import Link from 'next/link';
import Image from 'next/image';
import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

function AnimatedDnaStrand({ side = 'left', mobile = false }: { side?: 'left' | 'right'; mobile?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rungs = 32;
  const height = 420;
  const amplitude = 32;
  const dotRadius = 7;
  const duration = 4000;

  useEffect(() => {
    let frame: number;
    let start: number;
    function animate(ts: number) {
      if (!start) start = ts;
      const phase = ((ts - start) % duration) / duration * 2 * Math.PI;
      const children = containerRef.current?.children;
      if (children) {
        for (let i = 0; i < rungs; i++) {
          const t = i / (rungs - 1);
          const angle = phase + t * 2 * Math.PI;
          const x1 = Math.sin(angle) * amplitude;
          const x2 = Math.sin(angle + Math.PI) * amplitude;
          const y = t * height;
          const z1 = Math.cos(angle) * amplitude;
          const z2 = Math.cos(angle + Math.PI) * amplitude;
          const opacity1 = 0.5 + 0.5 * (z1 / amplitude);
          const opacity2 = 0.5 + 0.5 * (z2 / amplitude);
          const scale1 = 0.7 + 0.3 * (z1 / amplitude);
          const scale2 = 0.7 + 0.3 * (z2 / amplitude);
          const rung = children[i] as HTMLElement;
          const line = rung.querySelector('.dna-helix-line') as HTMLElement;
          if (line) {
            const dx = x2 - x1;
            const lineLength = Math.sqrt(dx * dx);
            line.style.width = `${lineLength}px`;
            line.style.left = `${x1 + amplitude}px`;
            line.style.top = `${y}px`;
            line.style.transform = `rotate(${Math.atan2(0, dx)}rad)`;
            line.style.opacity = `${(opacity1 + opacity2) / 2}`;
          }
          const dot1 = rung.querySelector('.dna-helix-dot1') as HTMLElement;
          const dot2 = rung.querySelector('.dna-helix-dot2') as HTMLElement;
          if (dot1) {
            dot1.style.left = `${x1 + amplitude - dotRadius}px`;
            dot1.style.top = `${y - dotRadius}px`;
            dot1.style.opacity = `${opacity1}`;
            dot1.style.transform = `scale(${scale1})`;
          }
          if (dot2) {
            dot2.style.left = `${x2 + amplitude - dotRadius}px`;
            dot2.style.top = `${y - dotRadius}px`;
            dot2.style.opacity = `${opacity2}`;
            dot2.style.transform = `scale(${scale2})`;
          }
        }
      }
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  if (mobile) {
    return (
      <div className="block sm:hidden fixed top-1/2 left-1/2 z-0 -translate-x-1/2 -translate-y-1/2 opacity-20 pointer-events-none select-none" style={{ perspective: 1000, width: amplitude * 2 + 40, height }}>
        <div ref={containerRef} className="absolute left-1/2 -translate-x-1/2" style={{ height, width: amplitude * 2 + 20 }}>
          {Array.from({ length: rungs }).map((_, i) => (
            <div key={i} className="absolute">
              <div className="dna-helix-line absolute h-0.5 bg-[#eedfc8] bg-opacity-50" style={{ zIndex: 1 }} />
              <div className="dna-helix-dot1 absolute w-3 h-3 bg-[#eedfc8] rounded-full" style={{ zIndex: 2 }} />
              <div className="dna-helix-dot2 absolute w-3 h-3 bg-[#eedfc8] rounded-full" style={{ zIndex: 2 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`hidden sm:fixed sm:top-1/2 z-20 h-[420px] w-20 sm:-translate-y-1/2 pointer-events-none select-none ${
        side === 'left' ? 'sm:left-16 -rotate-12' : 'sm:right-16 rotate-12'
      } sm:flex items-center justify-center`}
      style={{ perspective: 1000 }}
    >
      <div ref={containerRef} className="absolute left-1/2 -translate-x-1/2" style={{ height, width: amplitude * 2 + 20 }}>
        {Array.from({ length: rungs }).map((_, i) => (
          <div key={i} className="absolute">
            <div className="dna-helix-line absolute h-0.5 bg-[#eedfc8] bg-opacity-50" style={{ zIndex: 1 }} />
            <div className="dna-helix-dot1 absolute w-3 h-3 bg-[#eedfc8] rounded-full" style={{ zIndex: 2 }} />
            <div className="dna-helix-dot2 absolute w-3 h-3 bg-[#eedfc8] rounded-full" style={{ zIndex: 2 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

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

  if (user) return null;

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <AnimatedDnaStrand mobile />
      <AnimatedDnaStrand side="left" />
      <AnimatedDnaStrand side="right" />

      {/* Hero Section */}
      <section className="relative px-4 sm:px-10 pt-10 pb-12 sm:pt-16 sm:pb-20">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#D19A58] opacity-[0.04] rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-[960px] mx-auto text-center">
          {/* Hero Image */}
          <div className="w-full flex justify-center mb-8">
            <div className="hero-glow rounded-2xl">
              <Image
                src="/images/kinspace_hero.png"
                alt="Welcome to KinSpace"
                width={500}
                height={500}
                priority
                className="rounded-2xl w-[280px] h-[280px] sm:w-[450px] sm:h-[450px] object-contain"
              />
            </div>
          </div>

          {/* Hero Text */}
          <h1 className="text-4xl sm:text-5xl font-black text-[#eedfc8] mb-4 leading-tight tracking-tight">
            Your Cozy Corner <span className="text-[#D19A58]">for Healing</span>
          </h1>

          <p className="text-[#eedfc8]/80 text-base sm:text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
            A warm community where we grow together through life&apos;s challenges &mdash; chronic illness,
            mental health, addiction, grief, and beyond. Connect with others who understand your journey.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-8">
            <Link href="/signup" className="btn-primary text-base px-10 py-3.5 w-full sm:w-auto text-center font-bold">
              Join Our Community
            </Link>
            <Link href="/login" className="btn-secondary text-base px-10 py-3.5 w-full sm:w-auto text-center font-bold">
              Sign In
            </Link>
          </div>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-6 sm:gap-8 text-sm text-[#eedfc8]/50">
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

      {/* Community Stats */}
      <section className="px-4 sm:px-10 mb-12">
        <div className="max-w-4xl mx-auto">
          <div className="card bg-[#2A4A42]/50 backdrop-blur-lg border border-[#eedfc8]/20">
            <h3 className="text-[#eedfc8] text-lg font-bold mb-5 text-center">Our Growing Family</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-[#D19A58]">12.5k+</div>
                <div className="text-sm text-[#eedfc8]/70">Members</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-[#6B8A83]">850+</div>
                <div className="text-sm text-[#eedfc8]/70">Support Groups</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-[#B85C3A]">24/7</div>
                <div className="text-sm text-[#eedfc8]/70">Support</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Emergency & Quick Actions */}
      <section className="px-4 sm:px-10 mb-12">
        <div className="max-w-4xl mx-auto">
          <div className="card border-[#B85C3A]/30 bg-[#B85C3A]/10">
            <div className="flex items-center gap-2 mb-4">
              <i className="ri-first-aid-kit-line text-[#B85C3A] text-xl" />
              <h3 className="font-bold text-[#eedfc8] text-lg">Need Help Nearby?</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <a
                href="tel:988"
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#B85C3A]/20 hover:bg-[#B85C3A]/30 transition-colors"
              >
                <i className="ri-phone-line text-[#B85C3A] text-2xl" />
                <span className="text-sm text-[#eedfc8] font-semibold text-center">Call 988 Hotline</span>
              </a>
              <a
                href="https://www.google.com/maps/search/doctor+near+me"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#6B8A83]/20 hover:bg-[#6B8A83]/30 transition-colors"
              >
                <i className="ri-stethoscope-line text-[#6B8A83] text-2xl" />
                <span className="text-sm text-[#eedfc8] font-semibold text-center">Find Doctors</span>
              </a>
              <a
                href="https://www.google.com/maps/search/pharmacy+near+me"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[#D19A58]/20 hover:bg-[#D19A58]/30 transition-colors"
              >
                <i className="ri-capsule-line text-[#D19A58] text-2xl" />
                <span className="text-sm text-[#eedfc8] font-semibold text-center">Pharmacies</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Support Categories */}
      <section className="px-4 sm:px-10 mb-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-[#eedfc8] text-2xl font-bold text-center mb-8">Find Your People</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {supportCategories.map((cat) => (
              <Link
                key={cat.name}
                href="/explore"
                className="card-light flex flex-col items-center text-center p-5 hover:border-[#eedfc8]/25 transition-all duration-200 cursor-pointer"
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                  style={{ backgroundColor: `${cat.color}20` }}
                >
                  <i className={`${cat.icon} text-2xl`} style={{ color: cat.color }} />
                </div>
                <span className="text-sm font-semibold text-[#eedfc8] mb-1">{cat.name}</span>
                <span className="text-xs text-[#eedfc8]/50">
                  <i className="ri-group-line mr-1" />
                  {cat.members}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Games & Activities */}
      <section className="px-4 sm:px-10 mb-12">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card bg-gradient-to-br from-purple-600/15 to-pink-600/15 border-purple-500/20">
              <div className="flex items-center gap-2 mb-3">
                <span className="badge bg-[#eedfc8]/15 text-[#eedfc8] text-xs">Fun!</span>
                <span className="badge bg-[#eedfc8]/15 text-[#eedfc8] text-xs">Play Together</span>
              </div>
              <h3 className="text-lg font-bold text-[#eedfc8] mb-2">
                <i className="ri-gamepad-line mr-2 text-[#D19A58]" />
                Game Zone Open!
              </h3>
              <p className="text-[#eedfc8]/70 text-sm mb-4">
                Connect with community members through fun games &mdash; chess, tic-tac-toe, wordle, and more!
              </p>
              <Link href="/games" className="btn-primary inline-block text-sm px-6 py-2.5">
                Start Playing
              </Link>
            </div>

            <div className="card bg-gradient-to-br from-emerald-600/15 to-teal-600/15 border-emerald-500/20">
              <div className="flex items-center gap-2 mb-3">
                <span className="badge bg-[#eedfc8]/15 text-[#eedfc8] text-xs">New!</span>
                <span className="badge bg-[#eedfc8]/15 text-[#eedfc8] text-xs">Group Adventures</span>
              </div>
              <h3 className="text-lg font-bold text-[#eedfc8] mb-2">
                <i className="ri-hand-heart-line mr-2 text-[#6B8A83]" />
                Spread Joy Together!
              </h3>
              <p className="text-[#eedfc8]/70 text-sm mb-4">
                Join fellow members for meaningful volunteer activities &mdash; visit orphanages, spend time at hospices, or brighten someone&apos;s day.
              </p>
              <Link href="/community" className="btn-primary inline-block text-sm px-6 py-2.5">
                Join Adventures
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="px-4 sm:px-10 mb-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-[#eedfc8] text-2xl font-bold text-center mb-8">Key Features</h2>
          <div className="flex flex-col gap-6">
            {/* Feature 1 */}
            <div className="card overflow-hidden p-0">
              <div className="flex flex-col md:flex-row">
                <div className="flex-1 p-6">
                  <h3 className="text-xl font-bold text-[#eedfc8] mb-3">Personalized Matching</h3>
                  <p className="text-[#eedfc8]/70 mb-5">Find compatible connections based on shared conditions, interests, and goals.</p>
                  <Link href="/explore" className="btn-primary inline-block text-sm px-6 py-2.5">
                    Find Matches
                  </Link>
                </div>
                <div className="h-56 w-full md:h-auto md:w-1/2 relative">
                  <Image
                    src="/images/personalized_matching.png"
                    alt="Personalized matching"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="card overflow-hidden p-0">
              <div className="flex flex-col md:flex-row-reverse">
                <div className="flex-1 p-6">
                  <h3 className="text-xl font-bold text-[#eedfc8] mb-3">Support Groups</h3>
                  <p className="text-[#eedfc8]/70 mb-5">Join condition-specific groups for discussions, advice, and shared experiences.</p>
                  <Link href="/groups" className="btn-primary inline-block text-sm px-6 py-2.5">
                    Explore Groups
                  </Link>
                </div>
                <div className="h-56 w-full md:h-auto md:w-1/2 relative">
                  <Image
                    src="/images/support_groups.png"
                    alt="Support groups"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="card overflow-hidden p-0">
              <div className="flex flex-col md:flex-row">
                <div className="flex-1 p-6">
                  <h3 className="text-xl font-bold text-[#eedfc8] mb-3">Trauma-Bonding</h3>
                  <p className="text-[#eedfc8]/70 mb-5">Build meaningful relationships with others who understand the challenges of chronic conditions.</p>
                  <Link href="/trauma-bonding" className="btn-primary inline-block text-sm px-6 py-2.5">
                    Discover Connections
                  </Link>
                </div>
                <div className="h-56 w-full md:h-auto md:w-1/2 relative">
                  <Image
                    src="/images/bonding.png"
                    alt="Trauma bonding connections"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Today's Good Vibes */}
      <section className="px-4 sm:px-10 mb-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-[#eedfc8] text-2xl font-bold text-center mb-8">Today&apos;s Good Vibes</h2>
          <div className="space-y-4">
            <div className="card bg-gradient-to-r from-teal-600/15 to-emerald-600/15 border-emerald-500/20">
              <div className="flex items-center gap-2 mb-3">
                <span className="badge bg-[#6B8A83]/30 text-[#6B8A83] text-xs animate-pulse-dot">Live Now</span>
              </div>
              <h4 className="font-bold text-[#eedfc8] text-lg mb-2">Weekly Wellness Circle</h4>
              <p className="text-[#eedfc8]/70 text-sm mb-4">
                Join 47 friends sharing self-care wins and cozy chat about feeling good
              </p>
              <button className="btn-primary text-sm px-6 py-2.5">Join the Circle</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card-light">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#D19A58]/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className="ri-book-open-line text-[#D19A58]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-[#eedfc8] text-sm">Fresh Resource Added</h4>
                    <p className="text-xs text-[#eedfc8]/60">Understanding Anxiety: Your Friendly Guide</p>
                  </div>
                  <Link href="/resources" className="text-[#D19A58] text-sm font-medium hover:opacity-80 flex-shrink-0">
                    Read
                  </Link>
                </div>
              </div>

              <div className="card-light">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#6B8A83]/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <i className="ri-user-smile-line text-[#6B8A83]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-[#eedfc8] text-sm">New Buddy Available</h4>
                    <p className="text-xs text-[#eedfc8]/60">Chronic pain warrior offering friendly 1-on-1 chats</p>
                  </div>
                  <Link href="/community" className="text-[#D19A58] text-sm font-medium hover:opacity-80 flex-shrink-0">
                    Say Hi
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-4 sm:px-10 mb-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-[#eedfc8] text-2xl font-bold text-center mb-8">
            Stories from Our Community
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {testimonials.map((t, i) => (
              <div key={i} className="card-light">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-[#D19A58]/20 flex items-center justify-center mb-3">
                    <i className={`${t.avatar} text-xl text-[#D19A58]`} />
                  </div>
                  <p className="text-sm text-[#eedfc8]/80 italic leading-relaxed mb-3">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <span className="text-sm font-semibold text-[#eedfc8]">{t.author}</span>
                  <span className="badge text-xs mt-1">{t.condition}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 sm:px-10 mb-12">
        <div className="max-w-4xl mx-auto">
          <div className="card text-center py-10">
            <i className="ri-hand-heart-line text-5xl text-[#D19A58] mb-4 block" />
            <h2 className="text-2xl font-bold text-[#eedfc8] mb-3">
              You Don&apos;t Have to Do This Alone
            </h2>
            <p className="text-[#eedfc8]/60 mb-6 max-w-lg mx-auto">
              Join thousands who have found comfort, understanding, and hope in our community.
            </p>
            <Link href="/signup" className="btn-accent text-base px-10 py-3.5 inline-block font-bold">
              Get Started Free
            </Link>
            <p className="text-xs text-[#eedfc8]/40 mt-3">
              No credit card required. Always free.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#eedfc8]/10 bg-[#27433d] text-[#eedfc8] py-6 px-4 sm:px-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-6 md:gap-0">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-sm">
            <a href="#" className="hover:text-[#D19A58] transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-[#D19A58] transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-[#D19A58] transition-colors">Contact Us</a>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
            <div className="flex gap-3">
              <a href="#" className="hover:text-[#D19A58] transition-colors p-2" aria-label="Twitter">
                <i className="ri-twitter-x-line text-lg" />
              </a>
              <a href="#" className="hover:text-[#D19A58] transition-colors p-2" aria-label="Instagram">
                <i className="ri-instagram-line text-lg" />
              </a>
              <a href="#" className="hover:text-[#D19A58] transition-colors p-2" aria-label="Facebook">
                <i className="ri-facebook-circle-line text-lg" />
              </a>
            </div>
            <p className="text-xs text-[#eedfc8]/50">2026 KinSpace. All rights reserved.</p>
            <a
              href="https://boondocklabs.co.za"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-xs px-4 py-2"
            >
              By Boondock Labs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
