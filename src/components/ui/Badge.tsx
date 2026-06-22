import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'neutral' | 'accent' | 'terracotta' | 'gold' | 'sage' | 'violet' | 'blue' | 'success' | 'warning' | 'info'

/**
 * Tone name compatibility: existing callers pass 'success' | 'warning' | 'info'
 * (kept), plus richer accent tones for the redesign.
 */
const tones: Record<Tone, string> = {
  neutral: 'bg-brand-ink/[0.08] text-brand-ink/90',
  accent: 'bg-brand-accent1/15 text-brand-background',
  terracotta: 'bg-brand-accent1/15 text-brand-background',
  gold: 'bg-brand-accent2/18 text-brand-background',
  sage: 'bg-brand-accent3/20 text-brand-background',
  violet: 'bg-brand-accent4/18 text-brand-background',
  blue: 'bg-brand-accent5/18 text-brand-background',
  success: 'bg-brand-accent3/15 text-brand-background',
  warning: 'bg-brand-accent2/18 text-brand-background',
  info: 'bg-brand-accent5/15 text-brand-background',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
