import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'light' | 'plain'
  interactive?: boolean
}

const surfaces = {
  default: 'bg-brand-surface border border-brand-line shadow-[var(--shadow-card)]',
  light: 'bg-brand-surface-raised border border-brand-line shadow-[var(--shadow-card)]',
  plain: 'bg-transparent',
}

export function Card({ variant = 'default', interactive = false, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl p-5',
        surfaces[variant],
        interactive &&
          'transition-all duration-200 hover:border-brand-line-strong hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mb-3 flex items-start justify-between gap-3', className)}>{children}</div>
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h3 className={cn('text-base font-bold text-brand-ink', className)}>{children}</h3>
}

export function CardDescription({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn('text-sm leading-relaxed text-brand-ink/60', className)}>{children}</p>
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mt-4 flex items-center gap-3', className)}>{children}</div>
}
