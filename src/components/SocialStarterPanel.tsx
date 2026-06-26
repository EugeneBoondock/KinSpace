'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import ProfileAvatar from '@/components/ProfileAvatar'
import { MemberName } from '@/components/MemberIdentity'
import StrandButton from '@/components/StrandButton'
import { Badge, Card, LinkButton, Skeleton } from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'
import { cn } from '@/lib/cn'
import { isTransientFetchError } from '@/lib/client-errors'
import { DatabaseService } from '@/lib/database'

type SharedTraits = {
  conditions?: string[]
  comorbidities?: string[]
  interests?: string[]
  symptoms?: string[]
  treatments?: string[]
}

type StarterMember = {
  id?: string
  user_id?: string
  username?: string | null
  full_name?: string | null
  pseudonym?: string | null
  is_anonymous?: boolean
  avatar_url?: string | null
  shared?: SharedTraits
  match_reasons?: string[]
  starter_prompt?: string
  activity_labels?: string[]
}

type StarterLiveness = {
  close_matches_count: number
  available_supporters_count: number
  open_lanterns_count: number
  recent_posts_count: number
  upcoming_activities_count: number
}

type SocialStarterResponse = {
  members?: StarterMember[]
  liveness?: StarterLiveness
}

type SocialStarterPanelProps = {
  className?: string
  compact?: boolean
  embedded?: boolean
  title?: string
  description?: string
}

function memberId(member: StarterMember): string {
  return member.id || member.user_id || ''
}

function displayName(member: StarterMember): string {
  if (member.is_anonymous) return member.pseudonym || 'Anonymous member'
  return member.full_name || member.username || 'Community member'
}

const emptyLiveness: StarterLiveness = {
  close_matches_count: 0,
  available_supporters_count: 0,
  open_lanterns_count: 0,
  recent_posts_count: 0,
  upcoming_activities_count: 0,
}

export default function SocialStarterPanel({
  className,
  compact = false,
  embedded = false,
  title = 'Start with one real person',
  description = 'Suggestions use shared conditions, symptoms, treatments, goals, and recent activity. Private fields stay private.',
}: SocialStarterPanelProps) {
  const { user } = useAuth()
  const [members, setMembers] = useState<StarterMember[]>([])
  const [liveness, setLiveness] = useState<StarterLiveness>(emptyLiveness)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    let active = true
    const userId = user.userId
    async function load() {
      try {
        setLoading(true)
        const starter = (await DatabaseService.getSocialStarter(userId, { limit: compact ? 2 : 3 })) as SocialStarterResponse

        if (!active) return
        setMembers(Array.isArray(starter.members) ? starter.members : [])
        setLiveness(starter.liveness ?? emptyLiveness)
      } catch (error) {
        if (!active) return
        setMembers([])
        setLiveness(emptyLiveness)
        if (!isTransientFetchError(error)) console.error('Failed to load social starter suggestions:', error)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [compact, user])

  const stats = useMemo(
    () => [
      { label: 'Close matches', value: liveness.close_matches_count, icon: 'ri-user-heart-line' },
      { label: 'Available now', value: liveness.available_supporters_count, icon: 'ri-hand-heart-line' },
      { label: 'Open lanterns', value: liveness.open_lanterns_count, icon: 'ri-lightbulb-line' },
      { label: 'Fresh posts', value: liveness.recent_posts_count, icon: 'ri-chat-3-line' },
      { label: 'Upcoming', value: liveness.upcoming_activities_count, icon: 'ri-calendar-event-line' },
    ],
    [liveness],
  )
  const visibleStats = compact ? stats.slice(0, 3) : stats

  const content = (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Warm start</p>
          <h2 className="mt-1 text-lg font-bold text-brand-ink">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-brand-ink/60">{description}</p>
        </div>
        <LinkButton href="/people-like-you" variant="secondary" size="sm" className="shrink-0">
          Find people
        </LinkButton>
      </div>

      <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-5'}`}>
        {visibleStats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-center rounded-2xl bg-brand-ink/[0.04] px-1.5 py-2.5 text-center"
          >
            <i className={`${stat.icon} text-base text-brand-ink/45`} aria-hidden="true" />
            <p className="mt-1 text-xl font-bold leading-none text-brand-ink">{stat.value}</p>
            <p className="mt-1 text-[11px] font-medium leading-tight text-brand-ink/55">{stat.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: compact ? 2 : 3 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : members.length > 0 ? (
        <div className="divide-y divide-brand-line overflow-hidden rounded-2xl border border-brand-line">
          {members.slice(0, compact ? 2 : 3).map((member) => {
            const id = memberId(member)
            const name = displayName(member)
            const starterPrompt = member.starter_prompt
            const activityLabels = member.activity_labels ?? []

            return (
              <div key={id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <Link href={`/profile/${id}`} className="shrink-0" aria-label={`View ${name}`}>
                    <ProfileAvatar
                      alt={name}
                      avatarUrl={member.is_anonymous ? null : member.avatar_url}
                      fullName={member.is_anonymous ? null : member.full_name}
                      username={member.is_anonymous ? null : member.username}
                      userId={id}
                      className="h-11 w-11 rounded-2xl object-cover"
                      fallbackClassName="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-accent3/15"
                      fallbackTextClassName="text-sm font-semibold text-brand-accent3"
                      fallbackText={name}
                    />
                  </Link>
                  <div className="min-w-0">
                    <MemberName
                      profile={member as unknown as Record<string, unknown>}
                      userId={id}
                      name={name}
                      isAnonymous={Boolean(member.is_anonymous)}
                      className="text-sm font-semibold text-brand-ink hover:text-brand-accent3"
                      quickActionClassName="border-brand-ink/10 bg-brand-ink/[0.04] text-brand-ink/60 hover:bg-brand-accent2/15"
                    />
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {activityLabels.slice(0, 1).map((label) => (
                        <Badge key={`activity-${label}`} tone={label === 'Available now' ? 'sage' : 'neutral'}>
                          {label}
                        </Badge>
                      ))}
                      {/* Privacy: never reveal another member's specific conditions. */}
                      <Badge tone="sage">Something in common</Badge>
                    </div>
                    {starterPrompt && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-brand-ink/55">{starterPrompt}</p>
                    )}
                  </div>
                </div>
                <StrandButton targetUserId={id} size="sm" className="sm:shrink-0" />
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-brand-line-strong bg-brand-ink/[0.03] p-4">
          <p className="text-sm font-semibold text-brand-ink">No close matches yet</p>
          <p className="mt-1 text-sm leading-relaxed text-brand-ink/60">
            Add a condition report or profile details to give matching more signal.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <LinkButton href="/support" variant="ghost" size="sm" leadingIcon={<i className="ri-hand-heart-line" aria-hidden="true" />}>
          Lanterns
        </LinkButton>
        <LinkButton href="/community" variant="ghost" size="sm" leadingIcon={<i className="ri-group-line" aria-hidden="true" />}>
          Community
        </LinkButton>
      </div>
    </>
  )

  if (embedded) {
    return (
      <div className={cn('space-y-5 rounded-2xl border border-brand-line bg-brand-ink/[0.03] p-4', className)}>
        {content}
      </div>
    )
  }

  return (
    <Card className={cn('space-y-5', compact && 'p-4', className)}>
      {content}
    </Card>
  )
}
