'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'

const sizes = { sm: 32, md: 40, lg: 56, xl: 80 } as const

/**
 * Avatar uses a plain <img> (not next/image) on purpose: avatar URLs are often
 * our own platform SVG icons, which next/image blocks unless dangerouslyAllowSVG
 * is enabled, and uploaded avatars are served same-origin from /api/media. A
 * raw img renders both, and falls back to initials if the source fails to load.
 */
export function Avatar({
  src,
  name,
  size = 'md',
  className,
}: {
  src?: string | null
  name?: string | null
  size?: keyof typeof sizes
  className?: string
}) {
  const [errored, setErrored] = useState(false)
  const px = sizes[size]
  const initials = (name ?? '?')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (src && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? 'Avatar'}
        width={px}
        height={px}
        loading="lazy"
        onError={() => setErrored(true)}
        style={{ width: px, height: px }}
        className={cn('rounded-full object-cover ring-1 ring-brand-line', className)}
      />
    )
  }

  return (
    <div
      style={{ width: px, height: px }}
      className={cn(
        'flex items-center justify-center rounded-full bg-brand-accent3/30 text-xs font-bold text-brand-ink ring-1 ring-brand-line',
        className,
      )}
      aria-label={name ?? 'Avatar'}
    >
      {initials || '·'}
    </div>
  )
}
