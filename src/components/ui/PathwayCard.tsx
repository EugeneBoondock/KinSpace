import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tint = 'terracotta' | 'gold' | 'sage' | 'violet' | 'blue' | 'cream'

const tintMap: Record<Tint, string> = {
  terracotta: 'tint-terracotta',
  gold: 'tint-gold',
  sage: 'tint-sage',
  violet: 'tint-violet',
  blue: 'tint-blue',
  cream: 'tint-cream',
}

/**
 * Emotionally-specific entry card - "I need to talk", "I want to read quietly", etc.
 * Used on the homepage pathway grid and the dashboard quick-actions.
 * Reads as a gentle invitation, never a marketing tile.
 */
export function PathwayCard({
  title,
  description,
  icon,
  tint = 'sage',
  href,
  cta = 'Open',
  onClick,
  className,
}: {
  title: string
  description: string
  icon: string
  tint?: Tint
  href?: string
  cta?: string
  onClick?: () => void
  className?: string
}) {
  const inner = (
    <>
      <div className={cn('icon-chip mb-4', tintMap[tint])}>
        <i className={cn(icon, 'text-2xl')} aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-brand-ink">{title}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-brand-ink/60">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-accent2">
        {cta}
        <i className="ri-arrow-right-line transition-transform group-hover:translate-x-1" aria-hidden="true" />
      </span>
    </>
  )

  const classes = cn(
    'group flex h-full flex-col rounded-2xl border border-brand-line bg-brand-surface p-5 shadow-[var(--shadow-card)]',
    'transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-line-strong hover:shadow-[var(--shadow-lift)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/40',
    className,
  )

  if (href) {
    return (
      <Link href={href} className={classes}>
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cn(classes, 'text-left')}>
      {inner}
    </button>
  )
}

/** Compact variant for dashboard quick-action grids. */
export function PathwayChip({
  label,
  sublabel,
  icon,
  tint = 'sage',
  href,
  className,
}: {
  label: string
  sublabel?: string
  icon: string
  tint?: Tint
  href: string
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-brand-line bg-brand-surface p-4 transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-brand-line-strong hover:shadow-[var(--shadow-card)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/40',
        className,
      )}
    >
      <span className={cn('icon-chip', tintMap[tint])}>
        <i className={cn(icon, 'text-xl')} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-brand-ink">{label}</span>
        {sublabel && <span className="block text-xs text-brand-ink/45">{sublabel}</span>}
      </span>
    </Link>
  )
}

export type { Tint as PathwayTint }

// Re-export ReactNode type alias for callers that build custom pathway footers.
export type PathwayFooter = ReactNode
