'use client'

import { cn } from '@/lib/cn'

/**
 * Accessible on/off toggle (role="switch").
 * Replaces the hand-rolled toggle blocks in settings + onboarding.
 * The thumb uses a token color, never raw white.
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
  className,
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  disabled?: boolean
  /** Accessible label - required when no visible label is paired. */
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-brand-accent2' : 'bg-brand-ink/20',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-brand-surface shadow-sm transition-transform duration-200',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  )
}

/** Labeled switch row - the common settings/list pattern. */
export function SwitchRow({
  checked,
  onCheckedChange,
  title,
  description,
  disabled,
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  title: string
  description?: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-brand-ink">{title}</p>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-brand-ink/55">{description}</p>}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        label={title}
        className="mt-0.5"
      />
    </div>
  )
}
