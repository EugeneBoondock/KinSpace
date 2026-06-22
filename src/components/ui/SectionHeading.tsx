import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Canonical section header - one eyebrow style across the whole app.
 * Replaces the three competing eyebrow approaches (`.eyebrow` class,
 * inline tracking utilities, `tracking-wide`).
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = 'left',
  className,
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  align?: 'left' | 'center'
  className?: string
}) {
  const centered = align === 'center'
  return (
    <div className={cn(centered ? 'mx-auto max-w-2xl text-center' : 'text-left', className)}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className={cn('text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl', centered && 'mt-2')}>
        {title}
      </h2>
      {description && (
        <p className={cn('mt-2 text-sm leading-relaxed text-brand-ink/60', centered && 'mx-auto max-w-xl')}>
          {description}
        </p>
      )}
      {action && <div className={cn('mt-4', centered && 'flex justify-center')}>{action}</div>}
    </div>
  )
}
