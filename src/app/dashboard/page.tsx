'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import ProfileAvatar from '@/components/ProfileAvatar'
import SpoonsToday from '@/components/SpoonsToday'
import SymptomCheckin from '@/components/SymptomCheckin'
import DailyBrief from '@/components/DailyBrief'
import DailyQuestPanel from '@/components/DailyQuestPanel'
import SocialStarterPanel from '@/components/SocialStarterPanel'
import ForYou from '@/components/ForYou'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { updateCachedProfile } from '@/lib/profile-cache'
import { formatCompactNumber, formatRelativeTime, toDate } from '@/lib/platform'
import { Badge, Card, EmptyState, LinkButton, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { getPersona } from '@/lib/therapy-config'

const THERAPY_STARTER_KEY = 'kinspace:therapy-starter'

type Profile = Record<string, unknown> & {
  id: string
  full_name?: string
  username?: string
  avatar_url?: string | null
  onboarding_complete?: boolean
  created_at?: unknown
}

type GroupMembership = {
  id: string
  group?: Record<string, unknown> | null
}

type Post = Record<string, unknown> & {
  id: string
  content?: string
  profile?: Record<string, unknown> | null
  created_at?: unknown
}

type SignalEntry = {
  label: string
  count: number
}

const moodChoices = [
  { value: 'grounded', label: 'Grounded', icon: 'ri-plant-line' },
  { value: 'hopeful', label: 'Hopeful', icon: 'ri-sun-line' },
  { value: 'tired', label: 'Tired', icon: 'ri-moon-line' },
  { value: 'stretched', label: 'Stretched', icon: 'ri-focus-3-line' },
  { value: 'heavy', label: 'Heavy', icon: 'ri-cloudy-line' },
]

const quickActions = [
  { href: '/ask', label: 'Ask', icon: 'ri-search-2-line', tint: 'tint-terracotta' },
  { href: '/insights', label: 'Insights', icon: 'ri-heart-pulse-line', tint: 'tint-gold' },
  { href: '/strands', label: 'Connections', icon: 'ri-links-line', tint: 'tint-sage' },
  { href: '/research', label: 'Research', icon: 'ri-flask-line', tint: 'tint-cream' },
]

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [discreet, setDiscreet] = useState(false)
  const [memberships, setMemberships] = useState<GroupMembership[]>([])
  const [recommendedGroups, setRecommendedGroups] = useState<Record<string, unknown>[]>([])
  const [recentPosts, setRecentPosts] = useState<Post[]>([])
  const [supportTeamCount, setSupportTeamCount] = useState(0)
  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [checkinChat, setCheckinChat] = useState<{ mood: string } | null>(null)
  const [celebrations, setCelebrations] = useState<Array<{ badge_id: string; name: string; tier: string }>>([])
  const [greeting, setGreeting] = useState('Hello')
  const [moodPattern, setMoodPattern] = useState<{ streak: number; recent: string[]; hint: string | null }>({
    streak: 0,
    recent: [],
    hint: null,
  })
  const [strandPending, setStrandPending] = useState(0)
  const [communitySignals, setCommunitySignals] = useState<{
    topConditions: SignalEntry[]
    topMedications: SignalEntry[]
    topTopics: SignalEntry[]
  }>({
    topConditions: [],
    topMedications: [],
    topTopics: [],
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, router, user])

  useEffect(() => {
    setGreeting(getGreeting())
  }, [])

  // Record + celebrate freshly-earned achievements (writes the ledger once per
  // badge, returns only first-crossings). Best-effort; never blocks the page.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    DatabaseService.syncAchievementUnlocks()
      .then((res) => {
        if (cancelled) return
        const fresh = (res as { freshly_unlocked?: Array<{ badge_id: string; name: string; tier: string }> })
          ?.freshly_unlocked
        if (Array.isArray(fresh) && fresh.length > 0) setCelebrations(fresh)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    async function loadDashboard() {
      if (!user) return

      try {
        const results = await Promise.allSettled([
          DatabaseService.getProfile(user.userId),
          DatabaseService.getUserGroupMemberships(user.userId),
          DatabaseService.getRecommendedGroups(user.userId, 4),
          DatabaseService.getCommunityPosts(6),
          DatabaseService.getUserAngels(user.userId),
          DatabaseService.getCommunitySignals(5),
          DatabaseService.analyzeMoodPattern(user.userId),
          DatabaseService.getStrandCounts(user.userId),
        ])
        const valueAt = (index: number): unknown =>
          results[index]?.status === 'fulfilled' ? results[index].value : null
        const failedReads = results.filter((result) => result.status === 'rejected').length
        if (failedReads > 0) console.warn(`Dashboard loaded with ${failedReads} unavailable section${failedReads === 1 ? '' : 's'}.`)

        const [profileData, groupMemberships, recommended, posts, angels, signals, pattern, strandCounts] =
          Array.from({ length: results.length }, (_, index) => valueAt(index))

        const typedProfile = profileData as Profile | null

        if (typedProfile && typedProfile.onboarding_complete === false) {
          router.replace('/onboarding')
          return
        }

        const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])
        setProfile(typedProfile)
        setDiscreet(Boolean((typedProfile as Record<string, unknown> | null)?.hide_conditions_on_home))
        setMemberships(asArray<GroupMembership>(groupMemberships))
        setRecommendedGroups(asArray<Record<string, unknown>>(recommended))
        setRecentPosts(asArray<Post>(posts))
        setSupportTeamCount(asArray(angels).length)
        setSelectedMood((typedProfile?.daily_mood as string | undefined) ?? null)
        // RPC serializes keys to snake_case; map the computed signal wrapper back.
        const sig = signals as { top_conditions?: SignalEntry[]; top_medications?: SignalEntry[]; top_topics?: SignalEntry[] } | null
        setCommunitySignals({
          topConditions: asArray<SignalEntry>(sig?.top_conditions),
          topMedications: asArray<SignalEntry>(sig?.top_medications),
          topTopics: asArray<SignalEntry>(sig?.top_topics),
        })
        const mp = pattern as { streak?: number; recent?: string[]; hint?: string | null } | null
        setMoodPattern({ streak: mp?.streak ?? 0, recent: asArray<string>(mp?.recent), hint: mp?.hint ?? null })
        setStrandPending((strandCounts as { pending_received?: number } | null)?.pending_received ?? 0)
      } catch (error) {
        console.error('Failed to load dashboard:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      void loadDashboard()
    }
  }, [router, user])

  const activeDays = useMemo(() => {
    const joinedDate = toDate(profile?.created_at)
    if (!joinedDate) return 0
    return Math.max(1, Math.ceil((Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24)))
  }, [profile?.created_at])

  const displayName =
    (profile?.full_name as string | undefined) ||
    user?.displayName ||
    (profile?.username as string | undefined) ||
    user?.username ||
    'friend'

  const conditions = (profile?.conditions as string[] | undefined) ?? []

  async function handleMoodSelect(value: string) {
    setSelectedMood(value)
    if (!user) return

    try {
      const moodUpdatedAt = new Date().toISOString()
      await Promise.all([
        DatabaseService.updateProfile(user.userId, {
          daily_mood: value,
          mood_updated_at: moodUpdatedAt,
        }),
        DatabaseService.recordMoodCheckin(user.userId, { mood: value }),
      ])
      updateCachedProfile(user.userId, { daily_mood: value, mood_updated_at: moodUpdatedAt })
      window.dispatchEvent(new Event('kinspace:daily-quest-refresh'))
      // Offer a contextual chat with their Guide right after a check-in.
      setCheckinChat({ mood: value })
    } catch (error) {
      console.error('Failed to save mood:', error)
    }
  }

  async function toggleDiscreet() {
    const next = !discreet
    setDiscreet(next)
    if (!user) return
    try {
      await DatabaseService.updateProfile(user.userId, { hide_conditions_on_home: next })
    } catch (error) {
      console.error('Failed to update discreet mode:', error)
      setDiscreet(!next)
    }
  }

  function startCheckinChat() {
    if (!checkinChat) return
    const label = moodChoices.find((m) => m.value === checkinChat.mood)?.label ?? checkinChat.mood
    const starter = `I just did my daily check-in and I'm feeling ${label.toLowerCase()} today. Can we talk about it?`
    try {
      sessionStorage.setItem(THERAPY_STARTER_KEY, starter)
    } catch {
      // sessionStorage can be unavailable; the therapy room still opens.
    }
    setCheckinChat(null)
    router.push('/therapy')
  }

  if (authLoading || (!user && !authLoading)) {
    return (
      <PageFrame>
        <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading your dashboard">
          <Skeleton className="h-28 rounded-2xl" />
          <div className="page-card-grid">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  return (
    <PageFrame>
      <div className="page-grid">
        <Card className="overflow-hidden !p-0">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_20rem]">
            <div className="p-6 md:p-8">
              <p className="text-sm text-brand-background/60">{greeting},</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <ProfileAvatar
                    alt={displayName}
                    avatarUrl={profile?.avatar_url}
                    className="h-14 w-14 rounded-2xl object-cover border border-brand-background/20"
                    fullName={profile?.full_name}
                    userId={profile?.id}
                    username={profile?.username}
                  />
                  <div>
                    <h1 className="text-2xl font-bold text-brand-background sm:text-3xl">{displayName}</h1>
                    <p className="mt-1 text-sm text-brand-background/60">
                      Welcome back to your corner of KinSpace.
                    </p>
                  </div>
                </div>
                <LinkButton href={user ? `/profile/${user.userId}` : '/login'} variant="secondary" size="sm">
                  View profile
                </LinkButton>
              </div>

              {conditions.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-brand-background/10 bg-brand-background/[0.04] p-3">
                  {discreet ? (
                    <span className="text-xs font-medium text-brand-background/55">
                      <i className="ri-eye-off-line mr-1.5" aria-hidden="true" />
                      Health details hidden on your home screen
                    </span>
                  ) : (
                    <>
                      <span className="text-xs font-medium text-brand-background/45">Living with</span>
                      {conditions.slice(0, 6).map((condition) => (
                        <Badge key={condition}>{condition}</Badge>
                      ))}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={toggleDiscreet}
                    aria-pressed={discreet}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-brand-background/60 transition-colors hover:bg-brand-background/8 hover:text-brand-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                  >
                    <i className={discreet ? 'ri-eye-line' : 'ri-eye-off-line'} aria-hidden="true" />
                    {discreet ? 'Show' : 'Hide'}
                  </button>
                </div>
              )}

              <div className="mt-8 page-card-grid">
                {quickActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="card-hover flex items-center gap-3 rounded-2xl border border-brand-background/10 bg-brand-background/[0.08] p-4 hover:bg-brand-background/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                  >
                    <span className={cn('icon-chip', action.tint)}>
                      <i className={`${action.icon} text-xl`} aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block font-semibold text-brand-background">{action.label}</span>
                      <span className="block text-xs text-brand-background/45">Open now</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="border-t border-brand-background/10 bg-brand-background/[0.04] p-6 lg:border-l lg:border-t-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-background/40">
                Snapshot
              </p>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.08] p-4">
                  <p className="text-xs text-brand-background/45">Days active</p>
                  <p className="mt-2 text-3xl font-bold text-brand-accent2">
                    {formatCompactNumber(activeDays)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.08] p-4">
                    <p className="text-xs text-brand-background/45">Groups</p>
                    <p className="mt-2 text-2xl font-bold text-brand-background">
                      {formatCompactNumber(memberships.length)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.08] p-4">
                    <p className="text-xs text-brand-background/45">Support team</p>
                    <p className="mt-2 text-2xl font-bold text-brand-background">
                      {formatCompactNumber(supportTeamCount)}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.08] p-4">
                  <p className="text-xs text-brand-background/45">Posts shared</p>
                  <p className="mt-2 text-2xl font-bold text-brand-background">
                    {formatCompactNumber((profile?.postsCount as number | undefined) ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <DailyQuestPanel />

        <div className="page-grid lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,24rem)] lg:items-start">
          <div className="space-y-5">
            <DailyBrief />
            <Card id="daily-check-in">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-brand-background">Daily check-in</h2>
                  <p className="mt-1 text-sm text-brand-background/55">How is today feeling for you?</p>
                </div>
                {selectedMood && (
                  <Badge tone="accent">
                    <i className="ri-check-line" aria-hidden="true" />
                    Saved
                  </Badge>
                )}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5" role="group" aria-label="Select how today feels">
                {moodChoices.map((mood) => {
                  const isSelected = selectedMood === mood.value
                  return (
                    <button
                      key={mood.value}
                      type="button"
                      onClick={() => handleMoodSelect(mood.value)}
                      aria-pressed={isSelected}
                      className={cn(
                        'min-h-[5.5rem] rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                        isSelected
                          ? 'border-brand-accent2/50 bg-brand-accent2/[0.12]'
                          : 'border-brand-background/10 bg-brand-background/[0.04] hover:bg-brand-background/[0.08]',
                      )}
                    >
                      <i className={`${mood.icon} text-2xl text-brand-accent2`} aria-hidden="true" />
                      <p className="mt-3 text-sm font-semibold text-brand-background">{mood.label}</p>
                    </button>
                  )
                })}
              </div>

              {moodPattern.recent.length > 0 && (
                <div className="mt-5 rounded-2xl bg-brand-background/[0.04] p-4">
                  <div className="flex items-center justify-between gap-3 text-xs text-brand-background/55">
                    <span>Last {moodPattern.recent.length} days</span>
                    <Link href="/therapy" className="font-medium text-brand-accent2 hover:text-brand-accent2/80">
                      Talk to the Guide →
                    </Link>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {moodPattern.recent.map((mood, index) => {
                      const tone =
                        mood === 'heavy' || mood === 'tired'
                          ? 'bg-brand-accent1/30 text-brand-background'
                          : mood === 'stretched'
                            ? 'bg-brand-accent2/30 text-brand-background'
                            : mood === 'grounded' || mood === 'hopeful'
                              ? 'bg-brand-accent3/30 text-brand-background'
                              : 'bg-brand-background/10 text-brand-background/60'
                      return (
                        <span key={index} className={`rounded-full px-2 py-1 text-[10px] capitalize ${tone}`}>
                          {mood}
                        </span>
                      )
                    })}
                  </div>
                  {moodPattern.hint && (
                    <p className="mt-3 text-sm leading-relaxed text-brand-background/75">
                      <i className="ri-sparkling-line mr-1 text-brand-accent2" aria-hidden="true" />
                      {moodPattern.hint}
                    </p>
                  )}
                </div>
              )}

              <SymptomCheckin />
            </Card>

            <Card className="border-brand-accent2/30 bg-brand-accent2/[0.06]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-accent2/15 text-brand-accent2">
                    <i className="ri-lightbulb-flash-line text-xl" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-brand-background">Talk to someone now</h2>
                    <p className="mt-1 max-w-md text-sm leading-relaxed text-brand-background/60">
                      A hard moment is lighter with company. Light a lantern and a caring member will sit with
                      you. No appointment, no waiting room.
                    </p>
                  </div>
                </div>
                <LinkButton
                  href="/support"
                  className="shrink-0"
                  leadingIcon={<i className="ri-lightbulb-flash-line" aria-hidden="true" />}
                >
                  Light a lantern
                </LinkButton>
              </div>
            </Card>

            {!discreet && <ForYou />}

            <SpoonsToday />

            {strandPending > 0 && (
              <Link
                href="/strands"
                className="block rounded-2xl border border-brand-background/10 bg-brand-primary/50 p-5 backdrop-blur-sm transition-colors hover:border-brand-accent2/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-accent2/[0.18] text-brand-accent2">
                    <i className="ri-links-line text-xl" aria-hidden="true" />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-brand-background">
                      {strandPending} new connection request{strandPending === 1 ? '' : 's'}
                    </p>
                    <p className="text-xs text-brand-background/55">Accept, decline, or say hi.</p>
                  </div>
                  <i className="ri-arrow-right-s-line text-xl text-brand-background/40" aria-hidden="true" />
                </div>
              </Link>
            )}

            <SocialStarterPanel compact />

            <Card>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-brand-background">Your groups</h2>
                <Link href="/groups" className="text-sm font-medium text-brand-accent2 hover:text-brand-accent2/80">
                  Manage
                </Link>
              </div>
              {loading ? (
                <div className="page-card-grid">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-28 rounded-2xl" />
                  ))}
                </div>
              ) : memberships.length > 0 ? (
                <div className="page-card-grid">
                  {memberships.slice(0, 4).map((membership) => {
                    const group = membership.group ?? {}
                    return (
                      <Link
                        key={membership.id}
                        href={`/groups/${group.id as string}`}
                        className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.08] p-4 transition-colors hover:bg-brand-background/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-accent3/[0.18] text-brand-accent3">
                            <i
                              className={`${(group.icon as string | undefined) || 'ri-group-line'} text-xl`}
                              aria-hidden="true"
                            />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-brand-background">
                              {(group.name as string | undefined) || 'Support group'}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs text-brand-background/50">
                              {(group.description as string | undefined) ||
                                'A space to keep showing up for each other.'}
                            </p>
                            <p className="mt-3 text-xs text-brand-accent2">
                              {formatCompactNumber(group.members_count as number | undefined)} members
                            </p>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={<i className="ri-group-line text-3xl" aria-hidden="true" />}
                  image="/images/app/empty-groups.webp"
                  imageAlt="Two people walking toward a warm, welcoming doorway"
                  title="No groups yet"
                  description="Groups are small, steady circles of people who get it. Find one that fits."
                  action={
                    <LinkButton href="/explore" size="sm">
                      Explore groups
                    </LinkButton>
                  }
                />
              )}
            </Card>

            <Card>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-brand-background">Recent community activity</h2>
                <Link href="/community" className="text-sm font-medium text-brand-accent2 hover:text-brand-accent2/80">
                  View all
                </Link>
              </div>

              <div className="space-y-3">
                {recentPosts.length > 0 ? (
                  recentPosts.slice(0, 4).map((post) => {
                    const author = post.is_anonymous
                      ? 'Anonymous'
                      : ((post.profile?.full_name as string | undefined) ||
                        (post.profile?.username as string | undefined) ||
                        'Community member')

                    return (
                      <div
                        key={post.id}
                        className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.04] p-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-accent2/[0.18] text-sm font-bold text-brand-accent2">
                            {post.is_anonymous ? (
                              <i className="ri-spy-line text-base" aria-hidden="true" />
                            ) : (
                              <ProfileAvatar
                                alt={author}
                                avatarUrl={post.profile?.avatar_url as string | undefined}
                                className="h-10 w-10 rounded-2xl object-cover"
                                fullName={post.profile?.full_name as string | undefined}
                                userId={post.profile?.id as string | undefined}
                                username={post.profile?.username as string | undefined}
                              />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-brand-background">{author}</p>
                            <p className="text-xs text-brand-background/40">
                              {formatRelativeTime(post.created_at)}
                            </p>
                          </div>
                          {typeof post.type === 'string' && (
                            <Badge className="text-[10px] capitalize">{post.type}</Badge>
                          )}
                        </div>
                        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-brand-background/75">
                          {post.content as string}
                        </p>
                      </div>
                    )
                  })
                ) : loading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-20 rounded-2xl" />
                  ))
                ) : (
                  <EmptyState
                    icon={<i className="ri-chat-smile-3-line text-3xl" aria-hidden="true" />}
                    image="/images/app/empty-feed.webp"
                    imageAlt="A person writing their first post"
                    title="The feed is quiet"
                    description="Be the first to share how you are doing. A few words can mean a lot to someone reading."
                    action={
                      <LinkButton href="/community" variant="secondary" size="sm">
                        Start a post
                      </LinkButton>
                    }
                  />
                )}
              </div>
            </Card>
          </div>

          <aside className="space-y-5">
            <Card>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-brand-background">Recommended next</h2>
                <Link href="/explore" className="text-sm font-medium text-brand-accent2 hover:text-brand-accent2/80">
                  Browse
                </Link>
              </div>

              <div className="space-y-3">
                {recommendedGroups.length > 0 ? (
                  recommendedGroups.map((group) => (
                    <Link
                      key={group.id as string}
                      href={`/community?group=${group.id as string}`}
                      className="block rounded-2xl border border-brand-background/10 bg-brand-background/[0.08] p-4 transition-colors hover:bg-brand-background/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                    >
                      <p className="font-semibold text-brand-background">{group.name as string}</p>
                      <p className="mt-1 text-sm text-brand-background/55">
                        {(group.description as string | undefined) ||
                          'A live community space waiting for you.'}
                      </p>
                      <div className="mt-4 flex items-center justify-between text-xs text-brand-background/45">
                        <span>{group.category as string}</span>
                        <span>{formatCompactNumber(group.members_count as number | undefined)} members</span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.04] p-4 text-sm text-brand-background/60">
                    Recommendations grow as you join groups and update your profile.
                  </p>
                )}
              </div>
            </Card>

            <Card>
              <h2 className="mb-4 text-lg font-bold text-brand-background">Community signals</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-background/35">
                    Common conditions
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {communitySignals.topConditions.length > 0 ? (
                      communitySignals.topConditions.map((entry) => (
                        <Badge key={entry.label}>
                          {entry.label} · {entry.count}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-brand-background/55">
                        Signals will appear as member profiles fill out.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-background/35">
                    Frequent treatment mentions
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {communitySignals.topMedications.length > 0 ? (
                      communitySignals.topMedications.map((entry) => (
                        <Badge key={entry.label} className="bg-brand-accent1/[0.16] text-brand-background">
                          {entry.label} · {entry.count}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-brand-background/55">
                        Treatment themes will show up once members add them.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-background/35">
                    Topics in motion
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {communitySignals.topTopics.length > 0 ? (
                      communitySignals.topTopics.map((entry) => (
                        <Badge key={entry.label} className="bg-brand-accent3/[0.16] text-brand-background">
                          {entry.label} · {entry.count}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-brand-background/55">
                        Topic trends will grow with groups and resources.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <h2 className="mb-4 text-lg font-bold text-brand-background">Keep momentum</h2>
              <div className="space-y-3">
                <Link
                  href="/settings"
                  className="flex items-center gap-3 rounded-2xl border border-brand-background/10 bg-brand-background/[0.08] p-4 transition-colors hover:bg-brand-background/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-accent1/15 text-brand-accent1">
                    <i className="ri-settings-3-line text-lg" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-semibold text-brand-background">Refresh your profile</span>
                    <span className="block text-xs text-brand-background/45">
                      Keep your preferences and support needs current.
                    </span>
                  </span>
                </Link>
                <Link
                  href="/resources"
                  className="flex items-center gap-3 rounded-2xl border border-brand-background/10 bg-brand-background/[0.08] p-4 transition-colors hover:bg-brand-background/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-accent3/[0.16] text-brand-accent3">
                    <i className="ri-book-open-line text-lg" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-semibold text-brand-background">Check fresh resources</span>
                    <span className="block text-xs text-brand-background/45">
                      Read guides and support material published to the platform.
                    </span>
                  </span>
                </Link>
              </div>
            </Card>
          </aside>
        </div>
      </div>

      {checkinChat && (() => {
        const persona = getPersona(profile?.therapist_persona as string | undefined)
        const moodLabel = (moodChoices.find((m) => m.value === checkinChat.mood)?.label ?? checkinChat.mood).toLowerCase()
        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Chat with ${persona.name}`}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 backdrop-blur-sm p-4 md:items-center"
            onClick={() => setCheckinChat(null)}
          >
            <div
              className="w-full max-w-sm rounded-3xl border border-brand-line bg-brand-surface p-5 shadow-[0_24px_60px_rgba(16,28,24,0.35)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={persona.avatarSrc}
                  alt={persona.name}
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-brand-ink">{persona.name}</p>
                  <p className="mt-1 text-sm leading-relaxed text-brand-ink/75">
                    I see you’re feeling {moodLabel} today. Want to talk it through with me for a few minutes?
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={startCheckinChat}
                  className="flex-1 rounded-2xl bg-brand-accent2 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/40"
                >
                  Yes, let’s talk
                </button>
                <button
                  type="button"
                  onClick={() => setCheckinChat(null)}
                  className="rounded-2xl bg-brand-ink/[0.06] px-4 py-2.5 text-sm font-medium text-brand-ink/65 transition hover:bg-brand-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/20"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {celebrations.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Achievement unlocked"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setCelebrations([])}
        >
          <div
            className="celebrate-pop w-full max-w-sm rounded-3xl border border-brand-line bg-brand-surface p-6 text-center shadow-[0_24px_60px_rgba(16,28,24,0.35)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent3/15 text-3xl text-brand-accent3">
              <i className="ri-medal-2-line" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-brand-ink">
              {celebrations.length === 1 ? 'Achievement unlocked' : `${celebrations.length} achievements unlocked`}
            </h2>
            <p className="mt-1 text-sm text-brand-ink/60">Quietly proud of you for showing up.</p>
            <ul className="mt-4 space-y-2 text-left">
              {celebrations.slice(0, 5).map((item) => (
                <li
                  key={item.badge_id}
                  className="flex items-center gap-2 rounded-xl bg-brand-ink/[0.04] px-3 py-2 text-sm font-medium text-brand-ink"
                >
                  <i className="ri-checkbox-circle-fill text-brand-accent3" aria-hidden="true" /> {item.name}
                </li>
              ))}
              {celebrations.length > 5 && (
                <li className="px-3 text-xs text-brand-ink/45">and {celebrations.length - 5} more</li>
              )}
            </ul>
            <button
              type="button"
              onClick={() => setCelebrations([])}
              className="mt-5 w-full rounded-2xl bg-brand-accent3 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-105"
            >
              Lovely
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </PageFrame>
  )
}
