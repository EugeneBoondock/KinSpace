import { cn } from '@/lib/cn'

/**
 * Privacy / anonymous indicator - a calming, animated pill that makes
 * "you are sharing privately" visible and comforting at a glance.
 */
export function PrivacyPill({
  active = true,
  label = 'Anonymous mode active',
  className,
}: {
  active?: boolean
  label?: string
  className?: string
}) {
  return (
    <span className={cn('privacy-pill', !active && 'opacity-60', className)} aria-live="polite">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        {active && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-accent3 opacity-60" />
        )}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-accent3" />
      </span>
      {label}
    </span>
  )
}
