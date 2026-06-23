'use client'

import { useState } from 'react'
import { DatabaseService } from '@/lib/database'
import { isEmoji } from '@/lib/social'
import ReactionSummaryButton from '@/components/community/ReactionSummaryButton'

const QUICK_REACTIONS = ['❤️', '👍', '🤗', '🙏', '💪', '😊']

type Props = {
  commentId: string
  initialCounts?: Record<string, number>
  initialMine?: string[]
  canReact: boolean
  reactors?: Record<string, string[]>
}

/**
 * Compact emoji reactions for a single comment. Optimistic, self-contained state;
 * counts come from getCommentsForPosts (computed on read) and the server toggle is
 * best-effort (the next comments load reconciles). Used by both the groups PostCard
 * and the inline community feed.
 */
export default function CommentReactions({ commentId, initialCounts, initialMine, canReact, reactors = {} }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts ?? {})
  const [mine, setMine] = useState<Set<string>>(() => new Set(initialMine ?? []))
  const [pickerOpen, setPickerOpen] = useState(false)

  async function toggle(emoji: string) {
    if (!canReact || !isEmoji(emoji)) return
    const wasActive = mine.has(emoji)
    setMine((current) => {
      const next = new Set(current)
      if (wasActive) next.delete(emoji)
      else next.add(emoji)
      return next
    })
    setCounts((current) => {
      const next = { ...current }
      const value = (next[emoji] ?? 0) + (wasActive ? -1 : 1)
      if (value <= 0) delete next[emoji]
      else next[emoji] = value
      return next
    })
    setPickerOpen(false)
    try {
      await DatabaseService.toggleCommentReaction(commentId, emoji)
    } catch {
      // best-effort; the next comments load reconciles the true state
    }
  }

  const top = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  if (!canReact && top.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {top.map(([emoji, count]) => (
        <ReactionSummaryButton
          key={emoji}
          emoji={emoji}
          count={count}
          active={mine.has(emoji)}
          actors={reactors[emoji] ?? []}
          onClick={() => toggle(emoji)}
          disabled={!canReact}
          className={
            mine.has(emoji)
              ? 'border-transparent px-2 py-0.5 text-brand-accent2'
              : 'border-transparent bg-brand-background/[0.06] px-2 py-0.5 text-brand-background/70 hover:bg-brand-background/10'
          }
        />
      ))}
      {canReact && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            aria-label="React to this comment"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-background/[0.06] text-brand-background/55 transition-colors hover:bg-brand-background/10 hover:text-brand-background/80"
          >
            <i className="ri-emotion-line text-sm" aria-hidden="true" />
          </button>
          {pickerOpen && (
            <div className="absolute left-0 top-7 z-20 flex gap-0.5 rounded-full border border-brand-line bg-brand-surface p-1 shadow-[0_10px_28px_rgba(16,28,24,0.18)]">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => toggle(emoji)}
                  className="rounded-full px-1.5 py-0.5 text-base transition-transform hover:scale-110"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
