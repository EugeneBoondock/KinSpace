export function getReactionCounts(post: Record<string, unknown>): Record<string, number> {
  return (post.reaction_counts as Record<string, number> | undefined) ?? {}
}

export function getTopReactions(post: Record<string, unknown>, limit = 8): Array<{ emoji: string; count: number }> {
  const counts = getReactionCounts(post)
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([emoji, count]) => ({ emoji, count }))
}

export function isEmoji(str: string): boolean {
  const trimmed = str.trim()
  if (trimmed.length === 0 || trimmed.length > 8) return false
  const emojiRegex = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]+$/u
  return emojiRegex.test(trimmed)
}

export function applyReactionMutation<T extends Record<string, unknown>>(
  post: T,
  emoji: string,
  nextActive: boolean,
) {
  const reactionCounts = {
    ...getReactionCounts(post),
  }

  const currentValue = reactionCounts[emoji] ?? 0
  const nextValue = Math.max(0, currentValue + (nextActive ? 1 : -1))

  if (nextValue === 0) delete reactionCounts[emoji]
  else reactionCounts[emoji] = nextValue

  return {
    ...post,
    reaction_counts: reactionCounts,
  }
}
