'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { formatCompactNumber, formatRelativeTime, getInitials, toDate } from '@/lib/platform'

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
  { href: '/community', label: 'Community', icon: 'ri-chat-3-line' },
  { href: '/groups', label: 'Groups', icon: 'ri-group-line' },
  { href: '/therapy', label: 'Support', icon: 'ri-heart-pulse-line' },
  { href: '/map', label: 'Nearby', icon: 'ri-map-pin-line' },
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
  const [memberships, setMemberships] = useState<GroupMembership[]>([])
  const [recommendedGroups, setRecommendedGroups] = useState<Record<string, unknown>[]>([])
  const [recentPosts, setRecentPosts] = useState<Post[]>([])
  const [supportTeamCount, setSupportTeamCount] = useState(0)
  const [selectedMood, setSelectedMood] = useState<string | null>(null)
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
    async function loadDashboard() {
      if (!user) return

      try {
        const [profileData, groupMemberships, recommended, posts, angels, signals] = await Promise.all([
          DatabaseService.getProfile(user.userId),
          DatabaseService.getUserGroupMemberships(user.userId),
          DatabaseService.getRecommendedGroups(user.userId, 4),
          DatabaseService.getCommunityPosts(6),
          DatabaseService.getUserAngels(user.userId),
          DatabaseService.getCommunitySignals(5),
        ])

        const typedProfile = profileData as Profile | null

        if (typedProfile && typedProfile.onboarding_complete === false) {
          router.replace('/onboarding')
          return
        }

        setProfile(typedProfile)
        setMemberships(groupMemberships as GroupMembership[])
        setRecommendedGroups(recommended as Record<string, unknown>[])
        setRecentPosts(posts as Post[])
        setSupportTeamCount((angels as unknown[]).length)
        setSelectedMood((typedProfile?.daily_mood as string | undefined) ?? null)
        setCommunitySignals(signals as {
          topConditions: SignalEntry[]
          topMedications: SignalEntry[]
          topTopics: SignalEntry[]
        })
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

  async function handleMoodSelect(value: string) {
    setSelectedMood(value)
    if (!user) return

    try {
      await DatabaseService.updateProfile(user.userId, {
        daily_mood: value,
        mood_updated_at: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Failed to save mood:', error)
    }
  }

  if (authLoading || (!user && !authLoading)) {
    return (
      <PageFrame>
        <div className="space-y-5">
          <div className="h-24 skeleton rounded-3xl" />
          <div className="page-card-grid">
            <div className="h-44 skeleton rounded-3xl" />
            <div className="h-44 skeleton rounded-3xl" />
            <div className="h-44 skeleton rounded-3xl" />
          </div>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card overflow-hidden !p-0">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_20rem]">
            <div className="p-6 md:p-8">
              <p className="text-sm text-[#eedfc8]/60">{getGreeting()},</p>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-4">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={displayName}
                      className="h-14 w-14 rounded-2xl object-cover border border-[#eedfc8]/20"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D19A58]/20 text-lg font-bold text-[#D19A58]">
                      {getInitials(displayName)}
                    </div>
                  )}
                  <div>
                    <h1 className="text-3xl font-bold text-[#eedfc8]">{displayName}</h1>
                    <p className="mt-1 text-sm text-[#eedfc8]/60">
                      Welcome back to your corner of KinSpace.
                    </p>
                  </div>
                </div>
                <Link
                  href={user ? `/profile/${user.userId}` : '/login'}
                  className="btn-secondary !px-4 !py-2.5 text-xs"
                >
                  View profile
                </Link>
              </div>

              <div className="mt-8 page-card-grid">
                {quickActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="card-light flex items-center gap-3 transition-colors hover:bg-[#eedfc8]/12"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eedfc8]/10 text-[#D19A58]">
                      <i className={`${action.icon} text-xl`} />
                    </div>
                    <div>
                      <p className="font-semibold text-[#eedfc8]">{action.label}</p>
                      <p className="text-xs text-[#eedfc8]/45">Open now</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="border-t border-[#eedfc8]/10 bg-[#eedfc8]/4 p-6 lg:border-l lg:border-t-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
                Snapshot
              </p>
              <div className="mt-4 space-y-4">
                <div className="card-light !p-4">
                  <p className="text-xs text-[#eedfc8]/45">Days active</p>
                  <p className="mt-2 text-3xl font-bold text-[#D19A58]">
                    {formatCompactNumber(activeDays)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="card-light !p-4">
                    <p className="text-xs text-[#eedfc8]/45">Groups</p>
                    <p className="mt-2 text-2xl font-bold text-[#eedfc8]">
                      {formatCompactNumber(memberships.length)}
                    </p>
                  </div>
                  <div className="card-light !p-4">
                    <p className="text-xs text-[#eedfc8]/45">Support team</p>
                    <p className="mt-2 text-2xl font-bold text-[#eedfc8]">
                      {formatCompactNumber(supportTeamCount)}
                    </p>
                  </div>
                </div>
                <div className="card-light !p-4">
                  <p className="text-xs text-[#eedfc8]/45">Posts shared</p>
                  <p className="mt-2 text-2xl font-bold text-[#eedfc8]">
                    {formatCompactNumber((profile?.postsCount as number | undefined) ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="page-grid lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,24rem)] lg:items-start">
          <div className="space-y-5">
            <section className="card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="section-title !mb-1">Daily check-in</h2>
                  <p className="text-sm text-[#eedfc8]/55">How is today feeling for you?</p>
                </div>
                {selectedMood && (
                  <span className="badge bg-[#D19A58]/15 text-[#D19A58]">Saved</span>
                )}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {moodChoices.map((mood) => (
                  <button
                    key={mood.value}
                    onClick={() => handleMoodSelect(mood.value)}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      selectedMood === mood.value
                        ? 'border-[#D19A58]/50 bg-[#D19A58]/12'
                        : 'border-[#eedfc8]/8 bg-[#eedfc8]/4 hover:bg-[#eedfc8]/8'
                    }`}
                  >
                    <i className={`${mood.icon} text-2xl text-[#D19A58]`} />
                    <p className="mt-3 text-sm font-semibold text-[#eedfc8]">{mood.label}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="section-title !mb-0">Your groups</h2>
                <Link href="/groups" className="text-sm font-medium text-[#D19A58]">
                  Manage
                </Link>
              </div>
              {loading ? (
                <div className="page-card-grid">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-28 skeleton rounded-3xl" />
                  ))}
                </div>
              ) : memberships.length > 0 ? (
                <div className="page-card-grid">
                  {memberships.slice(0, 4).map((membership) => {
                    const group = membership.group ?? {}
                    return (
                      <Link
                        key={membership.id}
                        href={`/community?group=${group.id as string}`}
                        className="card-light transition-colors hover:bg-[#eedfc8]/12"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6B8A83]/18 text-[#6B8A83]">
                            <i
                              className={`${(group.icon as string | undefined) || 'ri-group-line'} text-xl`}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-[#eedfc8]">
                              {(group.name as string | undefined) || 'Support group'}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs text-[#eedfc8]/50">
                              {(group.description as string | undefined) ||
                                'A space to keep showing up for each other.'}
                            </p>
                            <p className="mt-3 text-xs text-[#D19A58]">
                              {formatCompactNumber(group.members_count as number | undefined)} members
                            </p>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <div className="card-light text-center">
                  <i className="ri-group-line text-3xl text-[#eedfc8]/30" />
                  <p className="mt-3 text-sm text-[#eedfc8]/60">You have not joined a group yet.</p>
                  <Link href="/explore" className="btn-primary mt-4 inline-flex !px-4 !py-2.5 text-xs">
                    Explore groups
                  </Link>
                </div>
              )}
            </section>

            <section className="card">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="section-title !mb-0">Recent community activity</h2>
                <Link href="/community" className="text-sm font-medium text-[#D19A58]">
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
                        className="rounded-2xl border border-[#eedfc8]/8 bg-[#eedfc8]/4 p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#D19A58]/18 text-sm font-bold text-[#D19A58]">
                            {post.is_anonymous ? (
                              <i className="ri-spy-line text-base" />
                            ) : (
                              getInitials(author)
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#eedfc8]">{author}</p>
                            <p className="text-xs text-[#eedfc8]/40">
                              {formatRelativeTime(post.created_at)}
                            </p>
                          </div>
                          {typeof post.type === 'string' && (
                            <span className="badge text-[10px]">{post.type}</span>
                          )}
                        </div>
                        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[#eedfc8]/75">
                          {post.content as string}
                        </p>
                      </div>
                    )
                  })
                ) : (
                  <div className="card-light text-center">
                    <i className="ri-chat-smile-3-line text-3xl text-[#eedfc8]/30" />
                    <p className="mt-3 text-sm text-[#eedfc8]/60">Your community feed is still quiet.</p>
                    <Link href="/community" className="btn-secondary mt-4 inline-flex !px-4 !py-2.5 text-xs">
                      Start a post
                    </Link>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="card">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="section-title !mb-0">Recommended next</h2>
                <Link href="/explore" className="text-sm font-medium text-[#D19A58]">
                  Browse
                </Link>
              </div>

              <div className="space-y-3">
                {recommendedGroups.length > 0 ? (
                  recommendedGroups.map((group) => (
                    <Link
                      key={group.id as string}
                      href={`/community?group=${group.id as string}`}
                      className="card-light block transition-colors hover:bg-[#eedfc8]/12"
                    >
                      <p className="font-semibold text-[#eedfc8]">{group.name as string}</p>
                      <p className="mt-1 text-sm text-[#eedfc8]/55">
                        {(group.description as string | undefined) ||
                          'A live community space waiting for you.'}
                      </p>
                      <div className="mt-4 flex items-center justify-between text-xs text-[#eedfc8]/45">
                        <span>{group.category as string}</span>
                        <span>{formatCompactNumber(group.members_count as number | undefined)} members</span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="card-light text-center">
                    <p className="text-sm text-[#eedfc8]/60">
                      Recommendations grow as you join groups and update your profile.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="card">
              <h2 className="section-title">Community signals</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#eedfc8]/35">
                    Common conditions
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {communitySignals.topConditions.length > 0 ? (
                      communitySignals.topConditions.map((entry) => (
                        <span key={entry.label} className="badge">
                          {entry.label} - {entry.count}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-[#eedfc8]/55">
                        Signals will appear as member profiles fill out.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#eedfc8]/35">
                    Frequent treatment mentions
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {communitySignals.topMedications.length > 0 ? (
                      communitySignals.topMedications.map((entry) => (
                        <span key={entry.label} className="badge bg-[#B85C3A]/16 text-[#eedfc8]">
                          {entry.label} - {entry.count}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-[#eedfc8]/55">
                        Treatment themes will show up once members add them.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#eedfc8]/35">
                    Topics in motion
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {communitySignals.topTopics.length > 0 ? (
                      communitySignals.topTopics.map((entry) => (
                        <span key={entry.label} className="badge bg-[#6B8A83]/16 text-[#eedfc8]">
                          {entry.label} - {entry.count}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-[#eedfc8]/55">
                        Topic trends will grow with groups and resources.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="card">
              <h2 className="section-title">Keep momentum</h2>
              <div className="space-y-3">
                <Link
                  href="/settings"
                  className="card-light flex items-center gap-3 transition-colors hover:bg-[#eedfc8]/12"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#B85C3A]/15 text-[#B85C3A]">
                    <i className="ri-settings-3-line text-lg" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#eedfc8]">Refresh your profile</p>
                    <p className="text-xs text-[#eedfc8]/45">
                      Keep your preferences and support needs current.
                    </p>
                  </div>
                </Link>
                <Link
                  href="/resources"
                  className="card-light flex items-center gap-3 transition-colors hover:bg-[#eedfc8]/12"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#6B8A83]/16 text-[#6B8A83]">
                    <i className="ri-book-open-line text-lg" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#eedfc8]">Check fresh resources</p>
                    <p className="text-xs text-[#eedfc8]/45">
                      Read guides and support material published to the platform.
                    </p>
                  </div>
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
