import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Reusable "not medical advice / talk to a professional" band.
 * Because KinSpace deals with sensitive health topics, this pattern appears
 * on treatment, research, insights, conditions, and ask surfaces.
 */
export function CrisisBar({
  variant = 'advice',
  title,
  children,
  action,
  className,
}: {
  variant?: 'advice' | 'urgent'
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  const isUrgent = variant === 'urgent'
  return (
    <div
      role={isUrgent ? 'alert' : 'note'}
      className={cn(
        'flex items-start gap-3 rounded-2xl border px-4 py-3',
        isUrgent
          ? 'border-brand-crisis/30 bg-brand-crisis/8'
          : 'border-brand-accent3/25 bg-brand-accent3/8',
        className,
      )}
    >
      <i
        className={cn(
          'mt-0.5 text-lg',
          isUrgent ? 'ri-alarm-warning-line text-brand-crisis' : 'ri-shield-cross-line text-brand-accent3',
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        {title && (
          <p className={cn('text-sm font-semibold', isUrgent ? 'text-brand-crisis' : 'text-brand-accent3')}>
            {title}
          </p>
        )}
        {children && (
          <div className={cn('text-xs leading-relaxed text-brand-ink/70', title ? 'mt-0.5' : undefined)}>{children}</div>
        )}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  )
}
