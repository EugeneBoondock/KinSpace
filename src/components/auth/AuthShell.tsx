import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'

type Mode = 'login' | 'signup'

const COPY: Record<Mode, { brandTitle: string; brandSub: string; switchText: string; switchCta: string; switchHref: string }> = {
  login: {
    brandTitle: 'Welcome back to your space.',
    brandSub: 'Pick up right where you left off, with the people and care that get you.',
    switchText: 'New to KinSpace?',
    switchCta: 'Create an account',
    switchHref: '/signup',
  },
  signup: {
    brandTitle: 'Your cozy corner for healing.',
    brandSub: 'Join a community that actually gets it, plus what really works for 52 conditions.',
    switchText: 'Already have an account?',
    switchCta: 'Log in',
    switchHref: '/login',
  },
}

const HIGHLIGHTS = [
  { icon: 'ri-flask-line', text: 'What actually works for 52 conditions' },
  { icon: 'ri-group-line', text: 'Peer support from people who get it' },
  { icon: 'ri-shield-keyhole-line', text: 'Private, and anonymous if you want' },
]

/**
 * Split-screen auth layout (a warm brand panel + the form). Used by login and
 * signup. The brand panel is desktop-only; mobile gets a compact header.
 */
export default function AuthShell({
  mode,
  title,
  subtitle,
  children,
}: {
  mode: Mode
  title: string
  subtitle: string
  children: ReactNode
}) {
  const copy = COPY[mode]

  return (
    <div className="relative min-h-screen bg-brand-canvas lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── Brand panel (desktop) ── */}
      <aside className="relative hidden overflow-hidden bg-brand-ink p-10 text-brand-surface lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="breathing-gradient pointer-events-none absolute -left-16 top-10 h-80 w-80 rounded-full bg-brand-accent2 opacity-20 blur-[120px]" />
        <div aria-hidden="true" className="breathing-gradient pointer-events-none absolute -right-10 bottom-0 h-80 w-80 rounded-full bg-brand-accent3 opacity-20 blur-[120px]" />

        <Link href="/" className="relative z-10 flex items-center gap-2.5" aria-label="KinSpace home">
          <Image src="/images/gather_logo.png" alt="" width={40} height={40} className="h-9 w-9 rounded-xl" priority />
          <span className="text-xl font-black tracking-tight">KinSpace</span>
        </Link>

        <div className="relative z-10 space-y-7">
          <div className="space-y-3">
            <h2 className="max-w-md text-4xl font-black leading-[1.08] tracking-tight">{copy.brandTitle}</h2>
            <p className="max-w-md text-base leading-relaxed text-brand-surface/75">{copy.brandSub}</p>
          </div>

          <div className="relative max-w-md">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] ring-1 ring-white/10">
              <Image
                src="/images/landing/hero-peer.webp"
                alt="Two friends talking, one comforting the other"
                width={540}
                height={540}
                priority
                className="h-full w-full object-cover object-center"
              />
            </div>
            <div className="absolute -bottom-3 -right-3 flex items-center gap-1.5 rounded-full bg-brand-surface px-3 py-1.5 text-xs font-semibold text-brand-ink shadow-lg">
              <i className="ri-hand-heart-fill text-brand-accent2" aria-hidden="true" />
              You&rsquo;re not alone
            </div>
          </div>

          <ul className="space-y-2.5">
            {HIGHLIGHTS.map((h) => (
              <li key={h.text} className="flex items-center gap-3 text-sm text-brand-surface/85">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <i className={`${h.icon} text-brand-surface`} aria-hidden="true" />
                </span>
                {h.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex items-center gap-4 text-xs text-brand-surface/60">
          <span>Free · not medical advice</span>
          <span aria-hidden="true">·</span>
          <Link href="/crisis" className="font-semibold text-brand-surface/80 hover:text-brand-surface">
            In crisis? Get help
          </Link>
        </div>
      </aside>

      {/* ── Form panel ── */}
      <main className="flex min-h-screen flex-col lg:min-h-0">
        <div className="flex items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2 lg:invisible" aria-label="KinSpace home">
            <Image src="/images/gather_logo.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" priority />
            <span className="text-lg font-black tracking-tight text-brand-ink">KinSpace</span>
          </Link>
          <p className="hidden text-sm text-brand-ink/60 sm:block">
            {copy.switchText}{' '}
            <Link href={copy.switchHref} className="font-semibold text-brand-accent2 hover:underline">
              {copy.switchCta}
            </Link>
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-12 pt-4 sm:px-8">
          <div className="w-full max-w-md animate-fade-in">
            <header className="mb-7 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-accent2/15">
                <i className="ri-heart-pulse-line text-3xl text-brand-accent2" aria-hidden="true" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-brand-ink">{title}</h1>
              <p className="mt-1.5 text-sm text-brand-ink/60">{subtitle}</p>
            </header>
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
