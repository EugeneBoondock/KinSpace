'use client';
import Link from "next/link";
import Image from "next/image";
import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

function AnimatedDnaStrand({ side = "left", mobile = false }: { side?: "left" | "right"; mobile?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rungs = 32;
  const height = 420;
  const amplitude = 32;
  const dotRadius = 7;
  const duration = 4000; // ms

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
            const dy = 0;
            const length = Math.sqrt(dx * dx + dy * dy);
            line.style.width = `${length}px`;
            line.style.left = `${x1 + amplitude}px`;
            line.style.top = `${y}px`;
            line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
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

  // Desktop: left/right, Mobile: centered background
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
      className={`hidden sm:fixed sm:top-1/2 z-20 h-[${height}px] w-20 sm:-translate-y-1/2 pointer-events-none select-none ${
        side === "left" ? "sm:left-16 -rotate-12" : "sm:right-16 rotate-12"
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

export default function Home() {
  const router = useRouter();

  const supportCategories = [
    { name: 'Mental Health', count: 284, icon: '🧠' },
    { name: 'Chronic Illness', count: 195, icon: '🏥' },
    { name: 'Addiction Recovery', count: 127, icon: '💪' },
    { name: 'Grief & Loss', count: 89, icon: '💙' },
    { name: 'Disability Support', count: 156, icon: '♿' },
    { name: 'Rare Conditions', count: 73, icon: '🔬' },
  ];

  const handleEmergencyCall = () => {
    window.location.href = 'tel:911';
  };

  const handleFindDoctors = () => {
    router.push('/map?type=doctors');
  };

  const handleFindPharmacies = () => {
    router.push('/map?type=pharmacies');
  };

  return (
    <div className="relative flex min-h-screen flex-col group/design-root overflow-x-hidden bg-brand-primary" style={{ fontFamily: 'Manrope, Noto Sans, sans-serif' }}>
      <AnimatedDnaStrand mobile />
      <AnimatedDnaStrand side="left" />
      <AnimatedDnaStrand side="right" />
      
      {/* Main Content */}
      <div className="flex-1">
        <div className="px-4 sm:px-40 py-5">
          <div className="max-w-[960px] mx-auto">
            <div className="flex flex-col items-center justify-center min-h-[480px] text-center p-4">
              {/* Hero Image */}
              <div className="w-full flex justify-center mb-6 relative h-72 sm:h-[450px]">
                  <div className="p-12">
                    <div className="relative aspect-square h-full rounded-2xl hero-glow bg-brand-primary">
                      <Image
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuBVIW-iPKfFRZjytJziRzlI8q5VPSpsbp6Q1zVLaM5SoZTGzh8LDiqlK9Y13Fhh07D2jSpzEL1F_1Yjtmu4R-Tm0csYocI_gd-3i_gf2zDBNcMxHC4WmYtKH7iHn7WRwBzVR4yz-h4AmfhOy7FB9I-uFr2-WSTZvyl-RfVBAy8msmK5PCvJTL90uioh1j3tT1w53rhWtgIYxZIYvBQZFT1MXPLfaEKKnIk46PhJm_vqT5WHsSg5jPXVgYAnKvoTmBmWxeveIJRkW7qk"
                        alt="Welcome to KinSpace banner"
                        fill={true}
                        priority
                        className="object-contain rounded-2xl"
                        sizes="100vw"
                      />
                    </div>
                  </div>
              </div>

              {/* Hero Text */}
              <div className="rounded-xl p-8 w-full">
                <div className="flex flex-col items-center gap-6">
                  <h1 className="text-brand-background text-4xl font-black leading-tight tracking-[-0.033em] sm:text-5xl">
                    Your Cozy Corner for Healing
                  </h1>
                  <h2 className="text-brand-background opacity-90 text-sm sm:text-base font-normal max-w-2xl">
                    A warm community where we grow together through life's challenges - chronic illness, mental health, addiction, grief, and beyond. Connect with others who understand your journey.
                  </h2>
                  <Link 
                    href="/signup" 
                    className="flex min-w-[180px] cursor-pointer items-center justify-center rounded-full h-12 px-8 bg-[#2A4A42] text-[#eedfc8] border-2 border-[#eedfc8] hover:bg-[#2A4A42]/90 hover:text-white hover:border-white text-base font-bold transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-brand-accent1/40 transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-md"
                  >
                    <span className="truncate">Join Our Community</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Emergency & Quick Actions Section */}
        <div className="w-full py-8 px-4 sm:px-40">
          <div className="max-w-4xl mx-auto">
            <div className="bg-[#2A4A42]/10 backdrop-blur-lg rounded-2xl p-6 border border-[#eedfc8]/20 mb-8">
              <h3 className="text-brand-background text-lg font-bold mb-4 text-center">Need Help Nearby?</h3>
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={handleFindDoctors}
                  className="bg-[#2A4A42] text-[#eedfc8] p-4 rounded-2xl text-center shadow-lg hover:shadow-xl transition-all duration-200 hover:bg-[#2A4A42]/90 transform hover:-translate-y-0.5"
                >
                  <div className="w-8 h-8 bg-[#eedfc8]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-lg">🩺</span>
                  </div>
                  <div className="font-semibold text-sm">Find Doctors</div>
                </button>
                <button
                  onClick={handleFindPharmacies}
                  className="bg-[#2A4A42] text-[#eedfc8] p-4 rounded-2xl text-center shadow-lg hover:shadow-xl transition-all duration-200 hover:bg-[#2A4A42]/90 transform hover:-translate-y-0.5"
                >
                  <div className="w-8 h-8 bg-[#eedfc8]/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-lg">💊</span>
                  </div>
                  <div className="font-semibold text-sm">Pharmacies</div>
                </button>
                <button
                  onClick={handleEmergencyCall}
                  className="bg-red-600 text-white p-4 rounded-2xl text-center shadow-lg hover:shadow-xl transition-all duration-200 hover:bg-red-700 transform hover:-translate-y-0.5"
                >
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-lg">📞</span>
                  </div>
                  <div className="font-semibold text-sm">Emergency</div>
                </button>
              </div>
            </div>

            {/* Community Stats */}
            <div className="bg-[#2A4A42]/10 backdrop-blur-lg rounded-2xl p-6 border border-[#eedfc8]/20 mb-8">
              <h3 className="text-brand-background text-lg font-bold mb-4 text-center">Our Growing Family</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-brand-background">12.5k+</div>
                  <div className="text-sm text-brand-background opacity-70">Members</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-brand-background">850+</div>
                  <div className="text-sm text-brand-background opacity-70">Support Groups</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-brand-background">24/7</div>
                  <div className="text-sm text-brand-background opacity-70">Support</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Support Categories Section */}
        <div className="w-full py-8 px-4 sm:px-40">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-brand-background text-2xl font-bold text-center mb-8">Find Your Tribe</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {supportCategories.map((category, index) => (
                <Link
                  key={index}
                  href="/explore"
                  className="bg-[#2A4A42]/10 backdrop-blur-lg rounded-2xl p-4 border border-[#eedfc8]/20 hover:shadow-lg hover:shadow-brand-accent1/20 transition-all duration-300 group"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="text-3xl mb-2">{category.icon}</div>
                    <div className="font-semibold text-brand-background text-sm mb-1">{category.name}</div>
                    <div className="text-xs text-brand-background opacity-70">{category.count} groups</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Games & Activities Section */}
        <div className="w-full py-8 px-4 sm:px-40">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Games Section */}
              <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-lg rounded-2xl p-6 border border-[#eedfc8]/20">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="bg-[#eedfc8]/20 px-2 py-1 rounded-full text-xs font-medium text-brand-background">Fun!</div>
                  <div className="bg-[#eedfc8]/20 px-2 py-1 rounded-full text-xs font-medium text-brand-background">Play Together</div>
                </div>
                <h3 className="text-lg font-bold mb-2 text-brand-background">Game Zone Open!</h3>
                <p className="text-brand-background opacity-80 text-sm mb-4">
                  Connect with community members through fun games - chess, tic-tac-toe, wordle, and more!
                </p>
                <Link href="/games" className="bg-[#2A4A42] text-[#eedfc8] px-6 py-2 rounded-full font-semibold text-sm inline-block border-2 border-[#eedfc8] hover:bg-[#2A4A42]/90 hover:text-white hover:border-white transition-all duration-200">
                  Start Playing
                </Link>
              </div>

              {/* Group Activities Section */}
              <div className="bg-gradient-to-r from-emerald-600/20 to-teal-600/20 backdrop-blur-lg rounded-2xl p-6 border border-[#eedfc8]/20">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="bg-[#eedfc8]/20 px-2 py-1 rounded-full text-xs font-medium text-brand-background">New!</div>
                  <div className="bg-[#eedfc8]/20 px-2 py-1 rounded-full text-xs font-medium text-brand-background">Group Adventures</div>
                </div>
                <h3 className="text-lg font-bold mb-2 text-brand-background">Spread Joy Together!</h3>
                <p className="text-brand-background opacity-80 text-sm mb-4">
                  Join fellow members for meaningful volunteer activities - visit orphanages, spend time at hospices, or brighten someone's day.
                </p>
                <Link href="/community" className="bg-[#2A4A42] text-[#eedfc8] px-6 py-2 rounded-full font-semibold text-sm inline-block border-2 border-[#eedfc8] hover:bg-[#2A4A42]/90 hover:text-white hover:border-white transition-all duration-200">
                  Join Adventures
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Live Activities Section */}
        <div className="w-full py-8 px-4 sm:px-40">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-brand-background text-2xl font-bold text-center mb-8">Today's Good Vibes</h2>
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-teal-600/20 to-emerald-600/20 backdrop-blur-lg rounded-2xl p-6 border border-[#eedfc8]/20">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="bg-[#eedfc8]/20 px-2 py-1 rounded-full text-xs font-medium text-brand-background">Live Now</div>
                </div>
                <h4 className="font-bold mb-2 text-brand-background">Weekly Wellness Circle</h4>
                <p className="text-brand-background opacity-80 text-sm mb-4">
                  Join 47 friends sharing self-care wins and cozy chat about feeling good
                </p>
                <button className="bg-[#2A4A42] text-[#eedfc8] px-6 py-2 rounded-full font-semibold text-sm border-2 border-[#eedfc8] hover:bg-[#2A4A42]/90 hover:text-white hover:border-white transition-all duration-200">
                  Join the Circle
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#2A4A42]/10 backdrop-blur-lg rounded-2xl p-5 border border-[#eedfc8]/20">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 bg-[#eedfc8]/20 rounded-full flex items-center justify-center">
                      <span className="text-lg">📚</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-brand-background text-sm">Fresh Resource Added</h4>
                      <p className="text-xs text-brand-background opacity-70">Understanding Anxiety: Your Friendly Guide</p>
                    </div>
                    <Link href="/resources" className="text-brand-background text-sm font-medium hover:opacity-80">
                      Check it out
                    </Link>
                  </div>
                </div>

                <div className="bg-[#2A4A42]/10 backdrop-blur-lg rounded-2xl p-5 border border-[#eedfc8]/20">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 bg-[#eedfc8]/20 rounded-full flex items-center justify-center">
                      <span className="text-lg">👋</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-brand-background text-sm">New Buddy Available</h4>
                      <p className="text-xs text-brand-background opacity-70">Chronic pain warrior offering friendly 1-on-1 chats</p>
                    </div>
                    <Link href="/community" className="text-brand-background text-sm font-medium hover:opacity-80">
                      Say Hi
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="w-full py-10">
          <h2 className="text-brand-background text-2xl font-bold text-center mb-8 px-4">Key Features</h2>
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex flex-col gap-8">
              {/* Card 1 */}
              <div className="block relative overflow-hidden rounded-2xl border border-brand-accent3 border-opacity-30 bg-brand-primary backdrop-blur-lg bg-opacity-90 transition-all duration-300 hover:shadow-lg hover:shadow-brand-accent1/20 group">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-accent1/10 to-brand-accent1/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="flex h-full flex-col md:flex-row">
                  <div className="flex-1 p-6">
                    <h3 className="mb-3 text-2xl font-bold text-brand-background">Personalized Matching</h3>
                    <p className="mb-6 text-base text-brand-background opacity-80">Find compatible connections based on shared conditions, interests, and goals.</p>
                    <div className="relative z-10">
                      <Link 
                        href="/matching"
                        passHref
                        className="cursor-pointer inline-block rounded-full bg-[#2A4A42] px-8 py-3 text-base font-bold text-[#eedfc8] border-2 border-[#eedfc8] transition-all duration-200 hover:bg-[#2A4A42]/90 hover:text-white hover:border-white hover:shadow-lg hover:shadow-brand-accent2/40 transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-md pointer-events-auto"
                      >
                        Find Matches
                      </Link>
                    </div>
                  </div>
                  <div className="h-64 w-full md:h-auto md:w-1/2">
                    <div 
                      className="h-full w-full bg-cover bg-center"
                      style={{
                        backgroundImage: 'url(https://lh3.googleusercontent.com/aida-public/AB6AXuBeDRT8DFuw7cUeoYXAmVbKIxx5YBa9E3etYRaYAjhlQxM7xK0tfKp4g-vPuK-eKei4ocJhJ3YqscsFK8pxhcX4Ynk0wSHx6ddC33dO1j-BHtXhtbUd-2SObnuJtrAh7ape128dtXDJVf3SebqzkuXO5VX4mGfXv9Hp3fa6xcVofc93DcrI1uCnVw5fzKxMTiYhCx-ln8zowrE2t91sllnsYJ5dnW1cXqKCAkbUMT2zNL8sFgt_sWs8O_4rEtx7ivx0dYGMs4JQvcYj)',
                        minHeight: '250px'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Card 2 - Reversed on desktop */}
              <div className="block relative overflow-hidden rounded-2xl border border-brand-accent3 border-opacity-30 bg-brand-primary backdrop-blur-lg bg-opacity-90 transition-all duration-300 hover:shadow-lg hover:shadow-brand-accent1/20 group">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-accent1/10 to-brand-accent1/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="flex h-full flex-col md:flex-row-reverse">
                  <div className="flex-1 p-6">
                    <h3 className="mb-3 text-2xl font-bold text-brand-background">Support Groups</h3>
                    <p className="mb-6 text-base text-brand-background opacity-80">Join condition-specific groups for discussions, advice, and shared experiences.</p>
                    <div className="relative z-10">
                      <Link 
                        href="/groups"
                        passHref
                        className="cursor-pointer inline-block rounded-full bg-[#2A4A42] px-8 py-3 text-base font-bold text-[#eedfc8] border-2 border-[#eedfc8] transition-all duration-200 hover:bg-[#2A4A42]/90 hover:text-white hover:border-white hover:shadow-lg hover:shadow-brand-accent2/40 transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-md pointer-events-auto"
                      >
                        Explore Groups
                      </Link>
                    </div>
                  </div>
                  <div className="h-64 w-full md:h-auto md:w-1/2">
                    <div 
                      className="h-full w-full bg-cover bg-center"
                      style={{
                        backgroundImage: 'url(https://lh3.googleusercontent.com/aida-public/AB6AXuCJn5Rf3kj-6m4RualIi8zHttC_JU7nv2acLwqS5wpcSQNuD6rhwYKScV5bYldT44ZOMkYohOmJg1udyaNt9sKytqUbyHpjEQt0cbCMtrletCIBXocDQZ3Yc7nYEcPc848QYMIt5KPCxqxZyuxlIO9lqDY31n84_1a3DUlBI8Y3zlpnjXxrTKxjnCuCyjxTTn0-QIZ58Yy7mxAIpZ-d3tWArLWmy6aymENBmehD8ATWmIJFfWT1tzP3Zoz8xWwjCV0my6pWGYXeHqcu)',
                        minHeight: '250px'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Card 3 */}
              <div className="block relative overflow-hidden rounded-2xl border border-brand-accent3 border-opacity-30 bg-brand-primary backdrop-blur-lg bg-opacity-90 transition-all duration-300 hover:shadow-lg hover:shadow-brand-accent1/20 group">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-accent1/10 to-brand-accent1/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="flex h-full flex-col md:flex-row">
                  <div className="flex-1 p-6">
                    <h3 className="mb-3 text-2xl font-bold text-brand-background">Trauma-Bonding</h3>
                    <p className="mb-6 text-base text-brand-background opacity-80">Build meaningful relationships with others who understand the challenges of chronic conditions.</p>
                    <div className="relative z-10">
                      <Link 
                        href="/trauma-bonding"
                        passHref
                        className="cursor-pointer inline-block rounded-full bg-[#2A4A42] px-8 py-3 text-base font-bold text-[#eedfc8] border-2 border-[#eedfc8] transition-all duration-200 hover:bg-[#2A4A42]/90 hover:text-white hover:border-white hover:shadow-lg hover:shadow-brand-accent2/40 transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-md pointer-events-auto"
                      >
                        Discover Connections
                      </Link>
                    </div>
                  </div>
                  <div className="h-64 w-full md:h-auto md:w-1/2">
                    <div 
                      className="h-full w-full bg-cover bg-center"
                      style={{
                        backgroundImage: 'url(https://lh3.googleusercontent.com/aida-public/AB6AXuA69cErNk7dJcGUaxqrdIzOi0GcQiSpPrzT9LH6t6eNmQ-Gz6IIbwM_08OQ_dp1eTYkdklwwqJjueuTiHXhOljU6SYJ1Cl6HYKw3jVuDs-Bajgt0xZIWWaOUHkQBYgoybDtscPPzZvluPiWMBSkEUBNIyR3nNZuYesIKPtvlzdLVRIjXJONLj8YVhg9ncO4vSalxnzFa5JOsbDk7stVxpQPFEY93j4O4D9E-guNIJ_D0AdbKVRbeVD5UF4iTn3vPBtS8p2l5UTFxic6)',
                        minHeight: '250px'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <footer className="border-t border-[#cedbe8] bg-[#27433d] text-[#eedfc8] py-6 px-2 sm:px-0 mt-10">
  <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-6 md:gap-0">
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-sm">
      <Link className="hover:underline hover:opacity-80 transition-opacity px-2 py-1 rounded-md" href="#">Terms of Service</Link>
      <Link className="hover:underline hover:opacity-80 transition-opacity px-2 py-1 rounded-md" href="#">Privacy Policy</Link>
      <Link className="hover:underline hover:opacity-80 transition-opacity px-2 py-1 rounded-md" href="#">Contact Us</Link>
    </div>
    <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
      <div className="flex gap-3 mb-2 sm:mb-0">
        <a href="#" className="hover:opacity-80 transition-opacity p-2 rounded-full" aria-label="Twitter">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 256 256"><path d="M247.39,68.94A8,8,0,0,0,240,64H209.57A48.66,48.66,0,0,0,168.1,40a46.91,46.91,0,0,0-33.75,13.7A47.9,47.9,0,0,0,120,88v6.09C79.74,83.47,46.81,50.72,46.46,50.37a8,8,0,0,0-13.65,4.92c-4.31,47.79,9.57,79.77,22,98.18a110.93,110.93,0,0,0,21.88,24.2c-15.23,17.53-39.21,26.74-39.47,26.84a8,8,0,0,0-3.85,11.93c.75,1.12,3.75,5.05,11.08,8.72C53.51,229.7,65.48,232,80,232c70.67,0,129.72-54.42,135.75-124.44l29.91-29.9A8,8,0,0,0,247.39,68.94Zm-45,29.41a8,8,0,0,0-2.32,5.14C196,166.58,143.28,216,80,216c-10.56,0-18-1.4-23.22-3.08,11.51-6.25,27.56-17,37.88-32.48A8,8,0,0,0,92,169.08c-.47-.27-43.91-26.34-44-96,16,13,45.25,33.17,78.67,38.79A8,8,0,0,0,136,104V88a32,32,0,0,1,9.6-22.92A30.94,30.94,0,0,1,167.9,56c12.66.16,24.49,7.88,29.44,19.21A8,8,0,0,0,204.67,80h16Z"></path></svg>
        </a>
        <a href="#" className="hover:opacity-80 transition-opacity p-2 rounded-full" aria-label="Instagram">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 256 256"><path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160ZM176,24H80A56.06,56.06,0,0,0,24,80v96a56.06,56.06,0,0,0,56,56h96a56.06,56.06,0,0,0,56-56V80A56.06,56.06,0,0,0,176,24Zm40,152a40,40,0,0,1-40,40H80a40,40,0,0,1-40-40V80A40,40,0,0,1,80,40h96a40,40,0,0,1,40,40ZM192,76a12,12,0,1,1-12-12A12,12,0,0,1,192,76Z"></path></svg>
        </a>
        <a href="#" className="hover:opacity-80 transition-opacity p-2 rounded-full" aria-label="Facebook">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm8,191.63V152h24a8,8,0,0,0,0-16H136V112a16,16,0,0,1,16-16h16a8,8,0,0,0,0-16H152a32,32,0,0,0-32,32v24H96a8,8,0,0,0,0,16h24v63.63a88,88,0,1,1,16,0Z"></path></svg>
        </a>
      </div>
      <p className="text-xs sm:text-sm text-[#eedfc8] text-center sm:text-left">2025 KinSpace. All rights reserved.</p>
      <a
        href="https://boondocklabs.co.za"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 sm:mt-0 inline-block px-4 py-2 rounded-full bg-[#2A4A42] text-[#eedfc8] border border-[#eedfc8] shadow-sm hover:bg-[#eedfc8] hover:text-[#2A4A42] hover:border-[#2A4A42] font-semibold text-xs sm:text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#eedfc8]"
        aria-label="Visit Boondock Labs website"
      >
        By Boondock Labs
      </a>
    </div>
  </div>
</footer>

        </div>
      </div>
    </div>
  );
}
