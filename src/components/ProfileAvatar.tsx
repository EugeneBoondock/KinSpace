import { resolveAvatarUrl } from '@/lib/profile-avatars'

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
  const resolvedAvatar = resolveAvatarUrl({
    avatar_url: avatarUrl,
    email,
    full_name: fullName,
    id: userId,
    username,
  })

  if (resolvedAvatar) {
    return <img src={resolvedAvatar} alt={alt} className={className} />
  }

  const label = (fallbackText || fullName || username || alt || '?').trim().charAt(0).toUpperCase() || '?'

  return (
    <div className={fallbackClassName}>
      <span className={fallbackTextClassName}>{label}</span>
    </div>
  )
}
