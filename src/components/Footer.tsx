import Link from 'next/link'

const footerLinks = [
  { href: '/conditions', label: 'Conditions' },
  { href: '/research', label: 'Research' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/community-guidelines', label: 'Guidelines' },
  { href: '/crisis', label: 'Crisis support' },
  { href: '/report-bug', label: 'Report a bug' },
  { href: '/terms', label: 'Terms & Conditions' },
  { href: '/privacy', label: 'Privacy' },
]

export default function Footer() {
  return (
    <footer className="border-t border-brand-line bg-brand-canvas-2/60 px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 text-sm sm:flex-row sm:justify-between">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-brand-ink/70">
          <i className="ri-heart-pulse-line text-brand-accent2" aria-hidden="true" />
          <span className="font-semibold">KinSpace</span>
          <span className="text-brand-ink/45">Peer support, not medical advice</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-brand-ink/60 transition-colors hover:text-brand-accent2"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="mt-5 text-center text-xs text-brand-ink/40">
        © {new Date().getFullYear()} KinSpace by{' '}
        <a
          href="https://boondocklabs.co.za"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-ink/55 transition-colors hover:text-brand-accent2"
        >
          Boondock Labs
        </a>
      </p>
    </footer>
  )
}
