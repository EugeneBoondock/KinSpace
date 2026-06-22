'use client'

import { useState } from 'react'
import { resolveAvatarUrl, getPlatformAvatarForSeed } from '@/lib/profile-avatars'

type ProfileAvatarProps = {
  alt: string
  avatarUrl?: string | null
  className: string
  email?: string | null
  fallbackClassName?: string
  fallbackText?: string
  fallbackTextClassName?: string
  fullName?: string | null
  userId?: string | null
  username?: string | null
}

export default function ProfileAvatar({
  alt,
  avatarUrl,
  className,
  email,
  fallbackClassName,
  fallbackText,
  fallbackTextClassName,
  fullName,
  userId,
  username,
}: ProfileAvatarProps) {
  // If a custom (uploaded) avatar URL fails to load, fall back to a deterministic
  // local platform SVG that is always served, so an avatar always renders.
  const [errored, setErrored] = useState(false)

  const primary = resolveAvatarUrl({
    avatar_url: avatarUrl,
    email,
    full_name: fullName,
    id: userId,
    username,
  })
  const seeded = getPlatformAvatarForSeed(userId || username || fullName || email || alt).src
  const src = errored ? seeded : primary

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
        onError={() => {
          if (!errored) setErrored(true)
        }}
      />
    )
  }

  const label = (fallbackText || fullName || username || alt || '?').trim().charAt(0).toUpperCase() || '?'

  return (
    <div className={fallbackClassName}>
      <span className={fallbackTextClassName}>{label}</span>
    </div>
  )
}
