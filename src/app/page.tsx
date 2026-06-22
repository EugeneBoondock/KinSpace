'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import InstallAppButton from '@/components/InstallAppButton'
import { useAuth } from '@/lib/AuthContext'
import Footer from '@/components/Footer'
import { CrisisBar, LinkButton, PathwayCard, type PathwayTint } from '@/components/ui'

// Example conditions: deliberately mix mental-health staples with African/SA-prevalent
// conditions so a first-time visitor sees this isn't a Western-only platform.
const TEASER_CHIPS = ['Depression', 'HIV', 'Anxiety', 'Migraine', 'Type 2 diabetes', 'IBS', 'Sickle cell', 'PTSD']

const PLATFORM_TILES: Array<{ title: string; description: string; icon: string; tint: PathwayTint; href: string }> = [
  { title: 'Condition studies', description: 'What actually works for 52 conditions, clinical evidence, refined by real member reports.', icon: 'ri-flask-line', tint: 'gold', href: '/conditions' },
  { title: 'AI guide & therapy', description: 'A gentle AI companion with five human-feeling personas, and it knows when a moment is a crisis.', icon: 'ri-message-3-line', tint: 'violet', href: '/therapy' },
  { title: 'Community & peer support', description: 'Angels, mentors, and condition groups, people who actually get it.', icon: 'ri-group-line', tint: 'sage', href: '/community' },
  { title: 'Nearby care map', description: 'Doctors, pharmacies, and support groups near you, built right in.', icon: 'ri-map-pin-line', tint: 'blue', href: '/nearby-support' },
  { title: 'Ask anything', description: 'Careful, sourced answers, plus the questions worth asking your own doctor.', icon: 'ri-questionnaire-line', tint: 'terracotta', href: '/ask' },
  { title: 'Private trackers & timeline', description: 'A private journal and health timeline that quietly remembers your story.', icon: 'ri-line-chart-line', tint: 'sage', href: '/dashboard' },
]

export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [loading, router, user])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="skeleton h-16 w-16 rounded-full" />
          <div className="skeleton h-5 w-44" />
          <div className="skeleton h-4 w-60" />
        </div>
      </div>
    )
  }
  if (user) return null

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ── Sticky header, logo + wordmark + nav + crisis + sign in/up ── */}
      <header className="safe-glass sticky top-0 z-30 border-b border-brand-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/40" aria-label="KinSpace home">
            <Image src="/images/gather_logo.png" alt="" width={36} height={36} className="h-8 w-8 rounded-lg" priority />
            <span className="text-lg font-black tracking-tight text-brand-ink">KinSpace</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link href="/conditions" className="rounded-full px-3 py-2 text-sm font-medium text-brand-ink/70 transition-colors hover:bg-brand-ink/5 hover:text-brand-ink">
              Conditions
            </Link>
            <Link href="/research" className="rounded-full px-3 py-2 text-sm font-medium text-brand-ink/70 transition-colors hover:bg-brand-ink/5 hover:text-brand-ink">
              Research
            </Link>
            <Link href="/pricing" className="rounded-full px-3 py-2 text-sm font-medium text-brand-ink/70 transition-colors hover:bg-brand-ink/5 hover:text-brand-ink">
              Pricing
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/crisis"
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-crisis/12 px-3 py-1.5 text-xs font-semibold text-brand-crisis transition-colors hover:bg-brand-crisis/20"
            >
              <i className="ri-lifebuoy-line" aria-hidden="true" />
              <span className="hidden sm:inline">In crisis?</span>
              <span className="sm:hidden">Crisis</span>
            </Link>
            <Link
              href="/login"
              className="hidden rounded-full px-3 py-2 text-sm font-semibold text-brand-ink/75 transition-colors hover:bg-brand-ink/5 hover:text-brand-ink sm:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-brand-ink px-4 py-2 text-sm font-bold text-brand-surface shadow-sm transition-colors hover:bg-brand-ink/90"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO, social-style split: promise + image collage ── */}
      <section className="relative px-4 pb-14 pt-10 sm:px-8 sm:pt-14">
        <div
          aria-hidden="true"
          className="breathing-gradient pointer-events-none absolute right-[2%] top-[6%] h-[480px] w-[480px] rounded-full bg-brand-accent2 opacity-[0.08] blur-[130px]"
        />
        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.02fr_1fr]">
          {/* Left, the promise */}
          <div className="text-center lg:text-left">
            <span className="eyebrow inline-flex items-center gap-2">
              <i className="ri-heart-3-line text-brand-accent2" aria-hidden="true" />
              Your cozy corner for healing
            </span>

            <h1 className="mt-5 text-4xl font-black leading-[1.06] tracking-tight text-brand-ink sm:text-5xl lg:text-[3.4rem]">
              Find the people &amp; care{' '}
              <span className="text-brand-accent2">you love</span>.
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-brand-ink/70 lg:mx-0 lg:text-lg">
              KinSpace brings together what actually works for 52 conditions, clinical evidence refined by real
              member reports, with an AI guide, peer support, and a care map. Free, private, and yours.
            </p>

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <LinkButton href="/signup" variant="accent" size="lg">
                Create a free space
              </LinkButton>
              <LinkButton href="/conditions" variant="secondary" size="lg" leadingIcon={<i className="ri-flask-line" aria-hidden="true" />}>
                Explore conditions
              </LinkButton>
              <InstallAppButton
                label="Install app"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-brand-ink/15 bg-brand-ink/[0.04] px-8 text-base font-semibold text-brand-ink transition-colors hover:bg-brand-ink/10"
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm lg:justify-start">
              <span className="text-brand-ink/55">Not sure where to start?</span>
              <Link href="/symptom-checker" className="inline-flex items-center gap-1.5 text-brand-accent3 hover:underline">
                <i className="ri-stethoscope-line" aria-hidden="true" /> Check a symptom
              </Link>
              <Link href="/nearby-support" className="inline-flex items-center gap-1.5 text-brand-accent5 hover:underline">
                <i className="ri-map-pin-line" aria-hidden="true" /> Find care near me
              </Link>
            </div>

            <p className="mt-5 text-xs text-brand-ink/45">Free · post anonymously · not medical advice.</p>
          </div>

          {/* Right, the image collage */}
          <HeroCollage />
        </div>
      </section>

      {/* ── CONDITIONS TEASER, points to the dedicated explorer page ── */}
      <section className="px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl border border-brand-line bg-brand-surface-raised p-6 sm:p-10">
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div>
              <span className="eyebrow inline-flex items-center gap-2">
                <i className="ri-shield-check-line text-brand-accent3" aria-hidden="true" />
                Evidence-based · refined by member reports
              </span>
              <h2 className="mt-3 text-2xl font-bold text-brand-ink sm:text-3xl">
                What actually works, see for yourself.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-ink/65 sm:text-base">
                Type a condition and see its real top treatments, ranked by effectiveness and refined by member
                reports. Fifty-two conditions, including the ones most platforms ignore, HIV, TB, hypertension,
                sickle cell, cervical cancer. No account needed.
              </p>
              <div className="mt-5">
                <LinkButton href="/conditions" variant="accent" leadingIcon={<i className="ri-search-line" aria-hidden="true" />}>
                  Explore 52 condition studies
                </LinkButton>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              {TEASER_CHIPS.map((label) => (
                <Link
                  key={label}
                  href="/conditions"
                  className="card-hover rounded-full border border-brand-line bg-brand-surface px-3 py-1.5 text-sm text-brand-ink/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/40"
                >
                  {label}
                </Link>
              ))}
              <Link
                href="/conditions"
                className="rounded-full border border-brand-line px-3 py-1.5 text-sm text-brand-ink/55 transition-colors hover:text-brand-ink"
              >
                +44 more
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── PLATFORM MOSAIC, the rest of your space ── */}
      <section className="px-4 py-12 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-2xl font-bold text-brand-ink">Everything in one calm place</h2>
          <p className="mt-2 max-w-2xl text-sm text-brand-ink/60">
            The condition studies are just the front door. This is the rest of your space, here when you need it.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORM_TILES.map((tile) => (
              <PathwayCard
                key={tile.title}
                title={tile.title}
                description={tile.description}
                icon={tile.icon}
                tint={tile.tint}
                href={tile.href}
                cta="Open"
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── CLOSE, a human line + gentle conversion ── */}
      <section className="px-4 py-14 sm:px-8">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-brand-line bg-brand-surface-raised p-8 text-center sm:p-12">
          <div
            aria-hidden="true"
            className="breathing-gradient pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-brand-accent1 opacity-[0.07] blur-[90px]"
          />
          <h2 className="relative text-2xl font-black text-brand-ink sm:text-3xl">
            You don&rsquo;t have to figure out your health alone.
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-brand-ink/65">
            Explore freely. Create a space only when you&rsquo;re ready, it&rsquo;s free, private, and yours.
          </p>
          <div className="relative mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <LinkButton href="/signup" variant="accent" size="lg">
              Create a free space
            </LinkButton>
            <LinkButton href="/conditions" variant="ghost" size="lg">
              Keep exploring
            </LinkButton>
          </div>
          <p className="relative mt-4 text-xs text-brand-ink/45">Free · post anonymously · not medical advice.</p>
        </div>
      </section>

      {/* ── CRISIS BAND, reachable from the foot of the page ── */}
      <div className="px-4 pb-10 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <CrisisBar
            variant="urgent"
            title="Need help right now?"
            action={
              <LinkButton href="/crisis" variant="accent" size="sm">
                See crisis support
              </LinkButton>
            }
          >
            If you&rsquo;re in crisis, you&rsquo;re not alone. Free, confidential South African and international
            helplines.
          </CrisisBar>
        </div>
      </div>

      <Footer />
    </div>
  )
}

// ── The hero image collage (the social-media flourish) ──────────────────────
function HeroCollage() {
  return (
    <div className="relative mx-auto w-full max-w-[420px] lg:max-w-[500px]">
      <div className="relative aspect-[4/5]">
        {/* Main portrait, the support circle */}
        <figure className="absolute right-[6%] top-0 w-[58%] overflow-hidden rounded-[1.75rem] shadow-xl ring-1 ring-brand-ink/5 rotate-[2deg]">
          <Image
            src="/images/landing/hero-community.webp"
            alt="A diverse group sharing a warm, supportive moment"
            width={760}
            height={1140}
            priority
            className="h-full w-full object-cover"
          />
        </figure>

        {/* Top-left card, a calm self-care moment */}
        <figure className="absolute left-0 top-[12%] w-[44%] overflow-hidden rounded-[1.5rem] shadow-lg ring-1 ring-brand-ink/5 -rotate-[5deg]">
          <Image
            src="/images/landing/hero-selfcare.webp"
            alt="A person taking a calm breathing moment by a sunlit window"
            width={540}
            height={540}
            className="h-full w-full object-cover"
          />
        </figure>

        {/* Bottom-left card, peer support */}
        <figure className="absolute bottom-[3%] left-[8%] w-[46%] overflow-hidden rounded-[1.5rem] shadow-lg ring-1 ring-brand-ink/5 rotate-[3deg]">
          <Image
            src="/images/landing/hero-peer.webp"
            alt="Two friends talking, one comforting the other"
            width={540}
            height={540}
            className="h-full w-full object-cover"
          />
        </figure>

        {/* Avatar bubble */}
        <figure className="absolute bottom-[12%] right-[2%] h-[26%] w-[26%] overflow-hidden rounded-full shadow-xl ring-4 ring-brand-surface">
          <Image
            src="/images/landing/hero-avatar.webp"
            alt="A friendly KinSpace member"
            width={360}
            height={360}
            className="h-full w-full object-cover"
          />
        </figure>

        {/* Floating reaction chip, heart */}
        <div className="absolute right-[0%] top-[34%] flex h-12 w-12 items-center justify-center rounded-full bg-brand-surface shadow-lg ring-1 ring-brand-ink/5">
          <i className="ri-heart-3-fill text-xl text-brand-accent1" aria-hidden="true" />
        </div>

        {/* Floating stat pill */}
        <div className="absolute left-[2%] top-[2%] flex items-center gap-1.5 rounded-full bg-brand-surface px-3 py-1.5 text-xs font-semibold text-brand-ink shadow-lg ring-1 ring-brand-ink/5">
          <i className="ri-flask-line text-brand-accent3" aria-hidden="true" />
          52 conditions
        </div>

        {/* Floating chip, you're not alone */}
        <div className="absolute bottom-[0%] left-[40%] flex items-center gap-1.5 rounded-full bg-brand-surface px-3 py-1.5 text-xs font-semibold text-brand-ink shadow-lg ring-1 ring-brand-ink/5">
          <i className="ri-hand-heart-fill text-brand-accent2" aria-hidden="true" />
          You&rsquo;re not alone
        </div>
      </div>
    </div>
  )
}
