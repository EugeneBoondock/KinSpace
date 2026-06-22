import type { SelectHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Styled native <select> with a chevron.
 * Replaces the copy-pasted `selectClasses` string that appeared in
 * settings, share-experience, and resources. Theme-aware via tokens.
 */
export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Optional leading Remixicon class, e.g. "ri-heart-pulse-line" */
  leadingIcon?: string
}

export function Select({ className, leadingIcon, children, ...rest }: SelectProps) {
  if (leadingIcon) {
    return (
      <div className="relative">
        <i
          className={cn('ri-absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-brand-ink/40', leadingIcon)}
          aria-hidden="true"
        />
        <select
          className={cn(
            fieldBase,
            'appearance-none pl-10 pr-10',
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <Chevron />
      </div>
    )
  }
  return (
    <div className="relative">
      <select className={cn(fieldBase, 'appearance-none pr-10', className)} {...rest}>
        {children}
      </select>
      <Chevron />
    </div>
  )
}

const fieldBase =
  'w-full rounded-xl bg-brand-ink/[0.04] border border-brand-line-strong px-4 py-3 text-sm ' +
  'text-brand-ink transition-colors focus:outline-none focus:border-brand-accent2/55 ' +
  'focus:ring-2 focus:ring-brand-accent2/15 disabled:opacity-50'

function Chevron() {
  return (
    <i
      className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-lg text-brand-ink/45"
      aria-hidden="true"
    />
  )
}

/** Option helper for callers that build option lists from data. */
export function SelectOption({ value, children }: { value: string; children: ReactNode }) {
  return (
    <option value={value} className="bg-brand-surface text-brand-ink">
      {children}
    </option>
  )
}
