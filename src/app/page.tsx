'use client';
import Link from "next/link";
import React, { useEffect, useRef } from "react";

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
              <div className="dna-helix-line absolute h-0.5 bg-white/30" style={{ zIndex: 1 }} />
              <div className="dna-helix-dot1 absolute w-3 h-3 bg-white rounded-full" style={{ zIndex: 2 }} />
              <div className="dna-helix-dot2 absolute w-3 h-3 bg-white rounded-full" style={{ zIndex: 2 }} />
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
            <div className="dna-helix-line absolute h-0.5 bg-white/30" style={{ zIndex: 1 }} />
            <div className="dna-helix-dot1 absolute w-3 h-3 bg-white rounded-full" style={{ zIndex: 2 }} />
            <div className="dna-helix-dot2 absolute w-3 h-3 bg-white rounded-full" style={{ zIndex: 2 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#111b22] dark group/design-root overflow-x-hidden" style={{ fontFamily: 'Manrope, Noto Sans, sans-serif' }}>
      <AnimatedDnaStrand mobile />
      <AnimatedDnaStrand side="left" />
      <AnimatedDnaStrand side="right" />
      
      {/* Main Content */}
      <div className="flex-1">
        <div className="px-4 sm:px-40 py-5">
          <div className="max-w-[960px] mx-auto">
            <div className="flex flex-col items-center justify-center min-h-[480px] text-center p-4">
              <div className="bg-cover bg-center bg-no-repeat rounded-xl p-8 w-full" style={{ backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.4) 100%), url(https://lh3.googleusercontent.com/aida-public/AB6AXuC_SZD8MiQpQEKROLyfk7DFgv8Gy_FLLMcrv064EGST29ybSbzVlAgKU9eJpC4-zYYdC8u6FC1j8qQA95jj8iwxU4ZAyhUmlanSBBofEn1GxOEPZ7iW683lFBnhWygZ4_oDvBh8XElXugnj2Uo3x6AgVaYhgelrHFa-QiwY1JIXaxk2WEgsS16r-izj3uDhuTXjmZQHVfST8rG82r2j-uKVKmdxxMdtsUpaD04WQd-qwlP9xYQpDKNhqanqcvotqlfBPaHP1FUf-UAo)' }}>
                <div className="flex flex-col items-center gap-6">
                  <h1 className="text-white text-4xl font-black leading-tight tracking-[-0.033em] sm:text-5xl">
                    Find Your Support System
                  </h1>
                  <h2 className="text-white text-sm sm:text-base font-normal max-w-2xl">
                    Connect with others who understand your journey. the Gathering is a community for individuals with chronic conditions, offering support, friendship, and dating opportunities.
                  </h2>
                  <Link 
                    href="/signup" 
                    className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 px-6 sm:h-12 sm:px-8 bg-[#1993e5] text-white text-sm font-bold hover:bg-[#0d7bc4] transition-colors duration-200"
                  >
                    <span className="truncate">Get Started</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="w-full py-10">
          <h2 className="text-white text-2xl font-bold text-center mb-8 px-4">Key Features</h2>
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex flex-col gap-8">
              {/* Card 1 */}
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-lg transition-all duration-300 hover:shadow-lg hover:shadow-[#1993e5]/20">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1993e5]/10 to-[#1993e5]/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="flex h-full flex-col md:flex-row">
                  <div className="flex-1 p-6">
                    <h3 className="mb-3 text-2xl font-bold text-white">Personalized Matching</h3>
                    <p className="mb-6 text-base text-[#b8d0e0]">Find compatible connections based on shared conditions, interests, and goals.</p>
                    <button className="rounded-full bg-[#1993e5] px-6 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#0d7bc4]">
                      Learn More
                    </button>
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
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-lg transition-all duration-300 hover:shadow-lg hover:shadow-[#1993e5]/20">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1993e5]/10 to-[#1993e5]/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="flex h-full flex-col md:flex-row-reverse">
                  <div className="flex-1 p-6">
                    <h3 className="mb-3 text-2xl font-bold text-white">Support Groups</h3>
                    <p className="mb-6 text-base text-[#b8d0e0]">Join condition-specific groups for discussions, advice, and shared experiences.</p>
                    <button className="rounded-full bg-[#1993e5] px-6 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#0d7bc4]">
                      Explore Groups
                    </button>
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
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-lg transition-all duration-300 hover:shadow-lg hover:shadow-[#1993e5]/20">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1993e5]/10 to-[#1993e5]/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="flex h-full flex-col md:flex-row">
                  <div className="flex-1 p-6">
                    <h3 className="mb-3 text-2xl font-bold text-white">Trauma-Bonding</h3>
                    <p className="mb-6 text-base text-[#b8d0e0]">Build meaningful relationships with others who understand the challenges of chronic conditions.</p>
                    <button className="rounded-full bg-[#1993e5] px-6 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#0d7bc4]">
                      Discover Connections
                    </button>
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
          <footer className="mt-20 px-4 py-10 bg-[#0d1217] text-white">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex flex-wrap justify-center gap-6">
                  <Link 
                    href="#"
                    className="text-[#93b3c8] text-base font-normal leading-normal hover:text-white transition-colors"
                  >
                    Terms of Service
                  </Link>
                  <Link 
                    className="text-[#93b3c8] text-base font-normal leading-normal hover:text-white transition-colors" 
                    href="#"
                  >
                    Privacy Policy
                  </Link>
                  <Link 
                    className="text-[#93b3c8] text-base font-normal leading-normal hover:text-white transition-colors" 
                    href="#"
                  >
                    Contact Us
                  </Link>
                </div>
              </div>
              
              <div className="flex gap-4">
                <a 
                  href="#" 
                  className="text-[#93b3c8] hover:text-white transition-colors"
                  aria-label="Twitter"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M247.39,68.94A8,8,0,0,0,240,64H209.57A48.66,48.66,0,0,0,168.1,40a46.91,46.91,0,0,0-33.75,13.7A47.9,47.9,0,0,0,120,88v6.09C79.74,83.47,46.81,50.72,46.46,50.37a8,8,0,0,0-13.65,4.92c-4.31,47.79,9.57,79.77,22,98.18a110.93,110.93,0,0,0,21.88,24.2c-15.23,17.53-39.21,26.74-39.47,26.84a8,8,0,0,0-3.85,11.93c.75,1.12,3.75,5.05,11.08,8.72C53.51,229.7,65.48,232,80,232c70.67,0,129.72-54.42,135.75-124.44l29.91-29.9A8,8,0,0,0,247.39,68.94Zm-45,29.41a8,8,0,0,0-2.32,5.14C196,166.58,143.28,216,80,216c-10.56,0-18-1.4-23.22-3.08,11.51-6.25,27.56-17,37.88-32.48A8,8,0,0,0,92,169.08c-.47-.27-43.91-26.34-44-96,16,13,45.25,33.17,78.67,38.79A8,8,0,0,0,136,104V88a32,32,0,0,1,9.6-22.92A30.94,30.94,0,0,1,167.9,56c12.66.16,24.49,7.88,29.44,19.21A8,8,0,0,0,204.67,80h16Z"></path>
                  </svg>
                </a>
                
                <a 
                  href="#" 
                  className="text-[#93b3c8] hover:text-white transition-colors"
                  aria-label="Instagram"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160ZM176,24H80A56.06,56.06,0,0,0,24,80v96a56.06,56.06,0,0,0,56,56h96a56.06,56.06,0,0,0,56-56V80A56.06,56.06,0,0,0,176,24Zm40,152a40,40,0,0,1-40,40H80a40,40,0,0,1-40-40V80A40,40,0,0,1,80,40h96a40,40,0,0,1,40,40ZM192,76a12,12,0,1,1-12-12A12,12,0,0,1,192,76Z"></path>
                  </svg>
                </a>
                
                <a 
                  href="#" 
                  className="text-[#93b3c8] hover:text-white transition-colors"
                  aria-label="Facebook"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm8,191.63V152h24a8,8,0,0,0,0-16H136V112a16,16,0,0,1,16-16h16a8,8,0,0,0,0-16H152a32,32,0,0,0-32,32v24H96a8,8,0,0,0,0,16h24v63.63a88,88,0,1,1,16,0Z"></path>
                  </svg>
                </a>
              
                <p className="text-[#93b3c8] text-base font-normal leading-normal">
                  © 2025 the Gathering. All rights reserved.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
