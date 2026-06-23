'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { formatReactionActorSummary, getReactionActorList } from '@/lib/social'

type Props = {
  emoji: string
  count: number
  active?: boolean
  actors?: string[]
  disabled?: boolean
  onClick?: () => void
  className?: string
  children?: ReactNode
}

export default function ReactionSummaryButton({
  emoji,
  count,
  active = false,
  actors = [],
  disabled = false,
  onClick,
  className,
  children,
}: Props) {
  const actorList = getReactionActorList(actors)
  const label = formatReactionActorSummary(actorList)

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-all',
          active
            ? 'border border-brand-accent2/40 bg-brand-accent2/20'
            : 'border border-brand-background/10 bg-brand-background/8 hover:bg-brand-background/14',
          disabled && 'cursor-default opacity-80',
          className,
        )}
      >
        {children ?? (
          <>
            <span className="text-sm">{emoji}</span>
            <span className={active ? 'font-semibold text-brand-accent2' : 'text-brand-background/60'}>{count}</span>
          </>
        )}
      </button>
      <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden min-w-44 max-w-72 rounded-lg border border-brand-line bg-brand-surface p-2 text-left text-xs font-medium text-brand-ink shadow-[0_10px_28px_rgba(16,28,24,0.18)] group-hover:block group-focus-within:block">
        <span className="block pb-1 text-[11px] uppercase tracking-wide text-brand-ink/55">Reacted</span>
        {actorList.length > 0 ? (
          <span className="block max-h-48 overflow-y-auto">
            {actorList.map((name) => (
              <span key={name} className="block whitespace-normal break-words py-0.5 leading-snug">
                {name}
              </span>
            ))}
          </span>
        ) : (
          <span className="block whitespace-normal break-words py-0.5 leading-snug">No names yet</span>
        )}
      </span>
    </span>
  )
}
