import type { ReactNode } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5 animate-spin text-brand-ink/70', className)} viewBox="0 0 24 24" fill="none" role="status" aria-label="Loading">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full rounded-md', className)} aria-hidden="true" />
}

/**
 * Comforting empty state - never "dead." Designed to reduce emotional weight:
 * warm icon, gentle copy, an optional next step.
 */
export function EmptyState({
  icon,
  image,
  imageAlt,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  /** Optional warm illustration (path under /public). Takes the place of the icon chip. */
  image?: string
  imageAlt?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-line-strong bg-brand-surface/50 px-6 py-12 text-center',
        className,
      )}
    >
      {image ? (
        <Image
          src={image}
          alt={imageAlt ?? ''}
          width={176}
          height={176}
          className="mb-4 h-36 w-36 object-contain sm:h-40 sm:w-40"
        />
      ) : (
        icon && (
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-ink/[0.04] text-brand-ink/45">
            {icon}
          </div>
        )
      )}
      <h3 className="text-base font-semibold text-brand-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-brand-ink/55">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

type AlertTone = 'info' | 'success' | 'warning' | 'error' | 'advice'
const alertTones: Record<AlertTone, string> = {
  info: 'border-brand-accent5/30 bg-brand-accent5/10 text-brand-accent5',
  success: 'border-brand-accent3/30 bg-brand-accent3/10 text-brand-accent3',
  warning: 'border-brand-accent2/30 bg-brand-accent2/10 text-brand-accent2',
  error: 'border-brand-crisis/30 bg-brand-crisis/10 text-brand-crisis',
  advice: 'border-brand-line-strong bg-brand-ink/[0.03] text-brand-ink/70',
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: AlertTone
  title?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('rounded-xl border px-4 py-3 text-sm', alertTones[tone], className)}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn(title && 'mt-0.5', 'opacity-90 [&_a]:underline')}>{children}</div>}
    </div>
  )
}
