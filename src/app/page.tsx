'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'

function AnimatedDnaStrand({ side = 'left', mobile = false }: { side?: 'left' | 'right'; mobile?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rungs = 32
  const height = 420
  const amplitude = 32
  const dotRadius = 7
  const duration = 4000

  useEffect(() => {
    let frame: number
    let start: number

    function animate(ts: number) {
      if (!start) start = ts
      const phase = (((ts - start) % duration) / duration) * 2 * Math.PI
      const children = containerRef.current?.children

      if (children) {
        for (let index = 0; index < rungs; index += 1) {
          const t = index / (rungs - 1)
          const angle = phase + t * 2 * Math.PI
          const x1 = Math.sin(angle) * amplitude
          const x2 = Math.sin(angle + Math.PI) * amplitude
          const y = t * height
          const z1 = Math.cos(angle) * amplitude
          const z2 = Math.cos(angle + Math.PI) * amplitude
          const opacity1 = 0.5 + 0.5 * (z1 / amplitude)
          const opacity2 = 0.5 + 0.5 * (z2 / amplitude)
          const scale1 = 0.7 + 0.3 * (z1 / amplitude)
          const scale2 = 0.7 + 0.3 * (z2 / amplitude)
          const rung = children[index] as HTMLElement
          const line = rung.querySelector('.dna-helix-line') as HTMLElement | null

          if (line) {
            const dx = x2 - x1
            line.style.width = `${Math.sqrt(dx * dx)}px`
            line.style.left = `${x1 + amplitude}px`
            line.style.top = `${y}px`
            line.style.transform = `rotate(${Math.atan2(0, dx)}rad)`
            line.style.opacity = `${(opacity1 + opacity2) / 2}`
          }

          const dot1 = rung.querySelector('.dna-helix-dot1') as HTMLElement | null
          const dot2 = rung.querySelector('.dna-helix-dot2') as HTMLElement | null

          if (dot1) {
            dot1.style.left = `${x1 + amplitude - dotRadius}px`
            dot1.style.top = `${y - dotRadius}px`
            dot1.style.opacity = `${opacity1}`
            dot1.style.transform = `scale(${scale1})`
          }

          if (dot2) {
            dot2.style.left = `${x2 + amplitude - dotRadius}px`
            dot2.style.top = `${y - dotRadius}px`
            dot2.style.opacity = `${opacity2}`
            dot2.style.transform = `scale(${scale2})`
          }
        }
      }

      frame = requestAnimationFrame(animate)
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])

  if (mobile) {
    return (
      <div
        className="fixed left-1/2 top-1/2 z-0 block -translate-x-1/2 -translate-y-1/2 select-none opacity-20 pointer-events-none sm:hidden"
        style={{ perspective: 1000, width: amplitude * 2 + 40, height }}
      >
        <div
          ref={containerRef}
          className="absolute left-1/2 -translate-x-1/2"
          style={{ height, width: amplitude * 2 + 20 }}
        >
          {Array.from({ length: rungs }).map((_, index) => (
            <div key={index} className="absolute">
              <div className="dna-helix-line absolute h-0.5 bg-[#eedfc8] bg-opacity-50" style={{ zIndex: 1 }} />
              <div className="dna-helix-dot1 absolute h-3 w-3 rounded-full bg-[#eedfc8]" style={{ zIndex: 2 }} />
              <div className="dna-helix-dot2 absolute h-3 w-3 rounded-full bg-[#eedfc8]" style={{ zIndex: 2 }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`pointer-events-none hidden select-none sm:fixed sm:top-1/2 sm:z-20 sm:flex sm:h-[420px] sm:w-20 sm:-translate-y-1/2 sm:items-center sm:justify-center ${
        side === 'left' ? 'sm:left-16 -rotate-12' : 'sm:right-16 rotate-12'
      }`}
      style={{ perspective: 1000 }}
    >
      <div
        ref={containerRef}
        className="absolute left-1/2 -translate-x-1/2"
        style={{ height, width: amplitude * 2 + 20 }}
      >
        {Array.from({ length: rungs }).map((_, index) => (
          <div key={index} className="absolute">
            <div className="dna-helix-line absolute h-0.5 bg-[#eedfc8] bg-opacity-50" style={{ zIndex: 1 }} />
            <div className="dna-helix-dot1 absolute h-3 w-3 rounded-full bg-[#eedfc8]" style={{ zIndex: 2 }} />
            <div className="dna-helix-dot2 absolute h-3 w-3 rounded-full bg-[#eedfc8]" style={{ zIndex: 2 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

const platformPillars = [
  {
    title: 'Private by choice',
    description: 'Stay anonymous when you need to, control what you share, and keep returning to the same support spaces.',
    icon: 'ri-lock-line',
    color: '#D19A58',
  },
  {
    title: 'Live platform data',
    description: 'Groups, posts, resources, and care directories now come from the real app instead of hardcoded filler.',
    icon: 'ri-database-2-line',
    color: '#6B8A83',
  },
  {
    title: 'Maps built in',
    description: 'Doctors, pharmacies, and support groups stay inside KinSpace with native routing and nearby discovery.',
    icon: 'ri-map-pin-line',
    color: '#B85C3A',
  },
]

const supportPaths = [
  {
    title: 'Mental health',
    description: 'Daily check-ins, guided support, and community conversation.',
    href: '/therapy',
    icon: 'ri-mental-health-line',
    color: '#6B8A83',
  },
  {
    title: 'Chronic conditions',
    description: 'Explore live groups, resources, and treatment signals shaped by member profiles.',
    href: '/explore',
    icon: 'ri-heart-pulse-line',
    color: '#B85C3A',
  },
  {
    title: 'Recovery and grief',
    description: 'Find peers, show up consistently, and keep one thread of support going.',
    href: '/community',
    icon: 'ri-shield-star-line',
    color: '#D19A58',
  },
  {
    title: 'Nearby support',
    description: 'Open the in-app map for doctors, pharmacies, and local groups.',
    href: '/nearby-support',
    icon: 'ri-route-line',
    color: '#6B8A83',
  },
  {
    title: 'Research and resources',
    description: 'Read through live resources and research alongside community signals and care pathways.',
    href: '/research',
    icon: 'ri-microscope-line',
    color: '#B85C3A',
  },
  {
    title: 'Games and connection',
    description: 'Practice solo, join live rooms, or open a shared space before a support session.',
    href: '/games',
    icon: 'ri-gamepad-line',
    color: '#D19A58',
  },
]

const featureCards = [
  {
    title: 'Join live conversations',
    description: 'Step into the community feed, then move into support groups that actually exist in the database.',
    href: '/community',
    cta: 'Open community',
    icon: 'ri-chat-3-line',
    tone: 'from-teal-600/15 to-emerald-600/15 border-emerald-500/20',
  },
  {
    title: 'Find nearby care',
    description: 'Use KinSpace maps for doctors, pharmacies, and in-person support without bouncing to Google Maps.',
    href: '/map',
    cta: 'Open care map',
    icon: 'ri-route-line',
    tone: 'from-amber-600/15 to-orange-600/15 border-orange-500/20',
  },
  {
    title: 'Learn from people and research',
    description: 'Browse resources, research, and member signals that reflect what people are actually sharing.',
    href: '/resources',
    cta: 'Browse resources',
    icon: 'ri-book-open-line',
    tone: 'from-sky-600/15 to-cyan-600/15 border-sky-500/20',
  },
]

const trustCards = [
  {
    title: 'No inflated numbers',
    description: 'The public experience now avoids inflated counts and invented testimonials in favor of honest navigation.',
    icon: 'ri-bar-chart-box-line',
  },
  {
    title: 'Desktop-first after login',
    description: 'Signed-in pages use shared framing and tighter desktop grids so wide screens feel designed, not stretched.',
    icon: 'ri-layout-grid-line',
  },
  {
    title: 'One connected care surface',
    description: 'Community, support rooms, resources, and maps now reinforce each other.',
    icon: 'ri-links-line',
  },
]

export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard')
    }
  }, [loading, router, user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="skeleton h-20 w-20 rounded-full" />
          <div className="skeleton h-6 w-48" />
          <div className="skeleton h-4 w-64" />
        </div>
      </div>
    )
  }

  if (user) return null

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <AnimatedDnaStrand mobile />
      <AnimatedDnaStrand side="left" />
      <AnimatedDnaStrand side="right" />

      <section className="relative px-4 pb-14 pt-10 sm:px-10 sm:pb-20 sm:pt-16">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[#D19A58] opacity-[0.04] blur-[120px]" />

        <div className="relative z-10 mx-auto max-w-[1100px]">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_28rem]">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#eedfc8]/15 bg-[#eedfc8]/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/65">
                <i className="ri-heart-pulse-line text-[#D19A58]" />
                Built for those who need support.
              </div>

              <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight text-[#eedfc8] sm:text-5xl lg:text-6xl">
                A better place to understand what helps, who relates, and where care actually is
              </h1>

              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#eedfc8]/78 lg:mx-0 lg:text-lg">
                KinSpace brings together community support, condition discovery, resources, and native care maps so people can move from feeling alone to feeling informed, connected, and supported.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Link href="/signup" className="btn-primary px-10 py-3.5 text-center text-base font-bold">
                  Join KinSpace
                </Link>
                <Link href="/login" className="btn-secondary px-10 py-3.5 text-center text-base font-bold">
                  Sign in
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-[#eedfc8]/60 lg:justify-start">
                {platformPillars.map((pillar) => (
                  <div key={pillar.title} className="badge bg-[#eedfc8]/10 text-[#eedfc8]">
                    <i className={`${pillar.icon} mr-1.5`} style={{ color: pillar.color }} />
                    {pillar.title}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <div className="hero-glow rounded-[2rem] border border-[#eedfc8]/12 bg-[#eedfc8]/6 p-4 backdrop-blur-sm">
                <div className="overflow-hidden rounded-[1.6rem] border border-[#eedfc8]/10 bg-[#214038]">
                  <Image
                    src="/images/kinspace_hero.png"
                    alt="KinSpace platform illustration"
                    width={520}
                    height={520}
                    priority
                    className="h-[280px] w-[280px] object-contain sm:h-[420px] sm:w-[420px]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-10 mb-12">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {platformPillars.map((pillar) => (
              <div key={pillar.title} className="card bg-[#2A4A42]/50 border border-[#eedfc8]/20 backdrop-blur-lg">
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${pillar.color}20` }}
                >
                  <i className={`${pillar.icon} text-xl`} style={{ color: pillar.color }} />
                </div>
                <h2 className="text-lg font-bold text-[#eedfc8]">{pillar.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#eedfc8]/70">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-10 mb-12">
        <div className="mx-auto max-w-5xl">
          <div className="card border-[#B85C3A]/30 bg-[#B85C3A]/10">
            <div className="mb-4 flex items-center gap-2">
              <i className="ri-first-aid-kit-line text-xl text-[#B85C3A]" />
              <h2 className="text-lg font-bold text-[#eedfc8]">Need Help Nearby?</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <a
                href="tel:988"
                className="flex flex-col items-center gap-2 rounded-xl bg-[#B85C3A]/20 p-4 text-center transition-colors hover:bg-[#B85C3A]/30"
              >
                <i className="ri-phone-line text-2xl text-[#B85C3A]" />
                <span className="text-sm font-semibold text-[#eedfc8]">Call 988 hotline</span>
              </a>
              <Link
                href="/map?type=doctor"
                className="flex flex-col items-center gap-2 rounded-xl bg-[#6B8A83]/20 p-4 text-center transition-colors hover:bg-[#6B8A83]/30"
              >
                <i className="ri-stethoscope-line text-2xl text-[#6B8A83]" />
                <span className="text-sm font-semibold text-[#eedfc8]">Find doctors</span>
              </Link>
              <Link
                href="/map?type=pharmacy"
                className="flex flex-col items-center gap-2 rounded-xl bg-[#D19A58]/20 p-4 text-center transition-colors hover:bg-[#D19A58]/30"
              >
                <i className="ri-capsule-line text-2xl text-[#D19A58]" />
                <span className="text-sm font-semibold text-[#eedfc8]">Find pharmacies</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-10 mb-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-8 text-center text-2xl font-bold text-[#eedfc8]">Choose Your Starting Point</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {supportPaths.map((path) => (
              <Link
                key={path.title}
                href={path.href}
                className="card-light group flex h-full flex-col p-5 transition-all duration-200 hover:border-[#eedfc8]/25"
              >
                <div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${path.color}20` }}
                >
                  <i className={`${path.icon} text-2xl`} style={{ color: path.color }} />
                </div>
                <h3 className="text-lg font-semibold text-[#eedfc8]">{path.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-[#eedfc8]/60">{path.description}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#D19A58]">
                  Open now
                  <i className="ri-arrow-right-line transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-10 mb-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-8 text-center text-2xl font-bold text-[#eedfc8]">What You Can Do Inside</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {featureCards.map((card) => (
              <div key={card.title} className={`card bg-gradient-to-br ${card.tone}`}>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eedfc8]/10">
                  <i className={`${card.icon} text-2xl text-[#eedfc8]`} />
                </div>
                <h3 className="text-lg font-bold text-[#eedfc8]">{card.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#eedfc8]/70">{card.description}</p>
                <Link href={card.href} className="btn-primary mt-5 inline-block px-6 py-2.5 text-sm">
                  {card.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-10 mb-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-8 text-center text-2xl font-bold text-[#eedfc8]">Built for Real Support</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {trustCards.map((card) => (
              <div key={card.title} className="card-light">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#D19A58]/20">
                    <i className={`${card.icon} text-xl text-[#D19A58]`} />
                  </div>
                  <p className="text-sm font-semibold text-[#eedfc8]">{card.title}</p>
                  <p className="mt-3 text-sm leading-relaxed text-[#eedfc8]/70">{card.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-10 mb-12">
        <div className="mx-auto max-w-4xl">
          <div className="card py-10 text-center">
            <i className="ri-hand-heart-line mb-4 block text-5xl text-[#D19A58]" />
            <h2 className="mb-3 text-2xl font-bold text-[#eedfc8]">You Don&apos;t Have to Do This Alone</h2>
            <p className="mx-auto mb-6 max-w-2xl text-[#eedfc8]/60">
              Start with the part of KinSpace you need most today, then grow into community, nearby care discovery, and support that stays with you after you log in.
            </p>
            <Link href="/signup" className="btn-accent inline-block px-10 py-3.5 text-base font-bold">
              Get Started Free
            </Link>
            <p className="mt-3 text-xs text-[#eedfc8]/40">No credit card required. Always free.</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#eedfc8]/10 bg-[#27433d] px-4 py-6 text-[#eedfc8] sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 md:flex-row md:items-center md:justify-between md:gap-0">
          <div className="flex flex-col items-center gap-4 text-sm sm:flex-row sm:gap-6">
            <Link href="/resources" className="transition-colors hover:text-[#D19A58]">
              Resources
            </Link>
            <Link href="/research" className="transition-colors hover:text-[#D19A58]">
              Research
            </Link>
            <Link href="/map" className="transition-colors hover:text-[#D19A58]">
              Care map
            </Link>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
            <div className="flex gap-3">
              <Link href="/community" className="p-2 transition-colors hover:text-[#D19A58]" aria-label="Community">
                <i className="ri-chat-3-line text-lg" />
              </Link>
              <Link href="/groups" className="p-2 transition-colors hover:text-[#D19A58]" aria-label="Groups">
                <i className="ri-group-line text-lg" />
              </Link>
              <Link href="/games" className="p-2 transition-colors hover:text-[#D19A58]" aria-label="Games">
                <i className="ri-gamepad-line text-lg" />
              </Link>
            </div>
            <p className="text-xs text-[#eedfc8]/50">2026 KinSpace. All rights reserved.</p>
            <a
              href="https://boondocklabs.co.za"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary px-4 py-2 text-xs"
            >
              By Boondock Labs
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
