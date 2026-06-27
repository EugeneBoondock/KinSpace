'use client'

import Link from 'next/link'
import { useState } from 'react'
import ProfileAvatar from '@/components/ProfileAvatar'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { useToast } from '@/components/Toast'
import { cn } from '@/lib/cn'

type ProfileLike = Record<string, unknown> | null | undefined

function value(profile: ProfileLike, ...keys: string[]): string | null {
  for (const key of keys) {
    const next = profile?.[key]
    if (typeof next === 'string' && next.trim()) return next
  }
  return null
}

export function getProfileUserId(profile: ProfileLike): string | null {
  return value(profile, 'id', 'user_id', 'userId')
}

export function getProfileDisplayName(profile: ProfileLike, fallback = 'Community member'): string {
  return value(profile, 'full_name', 'fullName', 'username') ?? fallback
}

type QuickStrandActionProps = {
  targetUserId?: string | null
  className?: string
}

export function QuickStrandAction({ targetUserId, className }: QuickStrandActionProps) {
  const { user } = useAuth()
  const { push: toast } = useToast()
  const [busy, setBusy] = useState(false)
  const isSelf = Boolean(user?.userId && targetUserId && user.userId === targetUserId)

  if (!user || !targetUserId || isSelf) return null

  async function sendStrand() {
    if (!user || !targetUserId || busy) return
    setBusy(true)
    try {
      await DatabaseService.sendConnectionRequest(user.userId, targetUserId)
      toast('Strand sent', 'success')
    } catch {
      toast('Could not send strand', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={sendStrand}
      disabled={busy}
      title="Send strand"
      aria-label="Send strand"
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-background/10 bg-brand-background/[0.06] text-brand-background/70 transition-colors hover:bg-brand-accent2/20 hover:text-brand-accent2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 disabled:opacity-50',
        className,
      )}
    >
      <i className={busy ? 'ri-loader-4-line animate-spin text-sm' : 'ri-user-add-line text-sm'} aria-hidden="true" />
    </button>
  )
}

type MemberNameProps = {
  profile?: ProfileLike
  userId?: string | null
  name: string
  isAnonymous?: boolean
  showQuickAction?: boolean
  className?: string
  quickActionClassName?: string
}

export function MemberName({
  profile,
  userId,
  name,
  isAnonymous = false,
  showQuickAction = true,
  className,
  quickActionClassName,
}: MemberNameProps) {
  const targetUserId = userId ?? getProfileUserId(profile)
  const canLink = Boolean(targetUserId && !isAnonymous)
  const label = canLink ? (
    <Link
      href={`/profile/${targetUserId}`}
      className={cn('min-w-0 max-w-full truncate transition-colors hover:text-brand-accent2', className)}
    >
      {name}
    </Link>
  ) : (
    <span className={cn('min-w-0 max-w-full truncate', className)}>{name}</span>
  )

  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 align-middle">
      {label}
      {showQuickAction && canLink && <QuickStrandAction targetUserId={targetUserId} className={quickActionClassName} />}
    </span>
  )
}

type MemberAvatarProps = {
  profile?: ProfileLike
  userId?: string | null
  alt: string
  avatarUrl?: string | null
  fullName?: string | null
  username?: string | null
  isAnonymous?: boolean
  className: string
  fallbackClassName?: string
  fallbackTextClassName?: string
}

export function MemberAvatar({
  profile,
  userId,
  alt,
  avatarUrl,
  fullName,
  username,
  isAnonymous = false,
  className,
  fallbackClassName,
  fallbackTextClassName,
}: MemberAvatarProps) {
  const targetUserId = isAnonymous ? null : userId ?? getProfileUserId(profile)
  const resolvedAvatar = isAnonymous ? null : avatarUrl ?? value(profile, 'avatar_url', 'avatarUrl')
  const resolvedFullName = isAnonymous ? null : fullName ?? value(profile, 'full_name', 'fullName')
  const resolvedUsername = isAnonymous ? null : username ?? value(profile, 'username')
  const avatar = (
    <ProfileAvatar
      alt={alt}
      avatarUrl={resolvedAvatar}
      className={className}
      fallbackClassName={fallbackClassName}
      fallbackTextClassName={fallbackTextClassName}
      fullName={resolvedFullName}
      userId={targetUserId}
      username={resolvedUsername}
    />
  )

  return avatar
}
