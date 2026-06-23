import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'

const MENTION_RE = /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{2,30})/g

/**
 * Render plain post/comment text with @mentions linkified to the member's
 * profile (via the /u/{handle} resolver). Everything else stays literal text,
 * so a parent's `whitespace-pre-wrap` still preserves line breaks. Returns the
 * raw string untouched when there are no mentions.
 */
export function renderWithMentions(text: string): ReactNode {
  if (!text || !text.includes('@')) return text
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let key = 0
  const re = new RegExp(MENTION_RE)
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const [full, pre, handle] = match
    if (match.index > lastIndex) {
      nodes.push(<Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>)
    }
    if (pre) nodes.push(<Fragment key={key++}>{pre}</Fragment>)
    nodes.push(
      <Link
        key={key++}
        href={`/u/${handle}`}
        className="font-medium text-brand-accent2 hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        @{handle}
      </Link>,
    )
    lastIndex = match.index + full.length
  }
  if (lastIndex < text.length) nodes.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>)
  return nodes
}
