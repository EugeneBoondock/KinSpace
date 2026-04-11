'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { formatCompactNumber, formatRelativeTime, getInitials } from '@/lib/platform'

type Tab = 'discussions' | 'angels' | 'mentors' | 'activities'

type Post = Record<string, unknown> & {
  id: string
  profile?: Record<string, unknown> | null
}

const tabs: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'discussions', label: 'Discussions', icon: 'ri-discuss-line' },
  { id: 'angels', label: 'Angels', icon: 'ri-heart-pulse-line' },
  { id: 'mentors', label: 'Mentors', icon: 'ri-user-star-line' },
  { id: 'activities', label: 'Activities', icon: 'ri-compass-3-line' },
]

export default function CommunityPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('discussions')
  const [posts, setPosts] = useState<Post[]>([])
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set())
  const [angels, setAngels] = useState<Record<string, unknown>[]>([])
  const [mentors, setMentors] = useState<Record<string, unknown>[]>([])
  const [activities, setActivities] = useState<Record<string, unknown>[]>([])
  const [newPostContent, setNewPostContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [joiningActivityIds, setJoiningActivityIds] = useState<Set<string>>(new Set())
  const [choosingAngelIds, setChoosingAngelIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, router, user])

  useEffect(() => {
    const initialGroup = searchParams.get('group')
    if (initialGroup) {
      setActiveTab('discussions')
    }
  }, [searchParams])

  useEffect(() => {
    async function loadCommunity() {
      if (!user) return

      try {
        const [profileData, communityPosts, likedIds, availableAngels, availableMentors, upcomingActivities] = await Promise.all([
          DatabaseService.getProfile(user.userId),
          DatabaseService.getCommunityPosts(24),
          DatabaseService.getUserLikedPostIds(user.userId),
          DatabaseService.getAvailableAngels(user.userId),
          DatabaseService.getMentors(),
          DatabaseService.getCommunityActivities(10),
        ])

        setProfile(profileData as Record<string, unknown> | null)
        setPosts(communityPosts as Post[])
        setLikedPostIds(likedIds)
        setAngels(availableAngels as Record<string, unknown>[])
        setMentors(availableMentors as Record<string, unknown>[])
        setActivities(upcomingActivities as Record<string, unknown>[])
      } catch (error) {
        console.error('Failed to load community:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user) loadCommunity()
  }, [user])

  const featuredPosts = useMemo(() => posts.slice(0, 8), [posts])

  async function handleCreatePost() {
    if (!user || !newPostContent.trim()) return

    setPosting(true)
    try {
      await DatabaseService.createPost(
        user.userId,
        newPostContent.trim(),
        'discussion',
        [],
        Boolean(profile?.is_anonymous),
      )
      const refreshedPosts = await DatabaseService.getCommunityPosts(24)
      setPosts(refreshedPosts as Post[])
      setNewPostContent('')
    } catch (error) {
      console.error('Failed to create post:', error)
    } finally {
      setPosting(false)
    }
  }

  async function handleToggleLike(postId: string) {
    if (!user) return

    const previouslyLiked = likedPostIds.has(postId)
    setLikedPostIds((current) => {
      const next = new Set(current)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })

    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              likes_count: Math.max(
                0,
                ((post.likes_count as number | undefined) ?? 0) + (previouslyLiked ? -1 : 1),
              ),
            }
          : post,
      ),
    )

    try {
      await DatabaseService.togglePostLike(postId, user.userId)
    } catch (error) {
      console.error('Failed to toggle like:', error)
    }
  }

  async function handleChooseAngel(angelId: string) {
    if (!user) return
    setChoosingAngelIds((current) => new Set(current).add(angelId))

    try {
      await DatabaseService.chooseAngel(user.userId, angelId)
    } catch (error) {
      console.error('Failed to choose angel:', error)
    } finally {
      setChoosingAngelIds((current) => {
        const next = new Set(current)
        next.delete(angelId)
        return next
      })
    }
  }

  async function handleJoinActivity(activityId: string) {
    if (!user) return
    setJoiningActivityIds((current) => new Set(current).add(activityId))

    try {
      await DatabaseService.joinActivity(activityId, user.userId)
      const refreshedActivities = await DatabaseService.getCommunityActivities(10)
      setActivities(refreshedActivities as Record<string, unknown>[])
    } catch (error) {
      console.error('Failed to join activity:', error)
    } finally {
      setJoiningActivityIds((current) => {
        const next = new Set(current)
        next.delete(activityId)
        return next
      })
    }
  }

  if (authLoading || loading || (!user && !authLoading)) {
    return (
      <PageFrame>
        <div className="space-y-4">
          <div className="h-24 skeleton rounded-3xl" />
          <div className="h-12 skeleton rounded-full" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-40 skeleton rounded-3xl" />
            ))}
          </div>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
                Community
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Show up with people who get it</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#eedfc8]/60">
                Real conversations, peer support, professional guidance, and shared activities all live here now.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-[#eedfc8]/50">
              <span className="badge">Posts {formatCompactNumber(posts.length)}</span>
              <span className="badge">Angels {formatCompactNumber(angels.length)}</span>
              <span className="badge">Mentors {formatCompactNumber(mentors.length)}</span>
              <span className="badge">Activities {formatCompactNumber(activities.length)}</span>
            </div>
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto rounded-2xl bg-[#eedfc8]/5 p-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-w-fit items-center gap-2 rounded-2xl px-4 py-2.5 text-sm transition-all ${
                  activeTab === tab.id ? 'tab-active' : 'tab-inactive'
                }`}
              >
                <i className={tab.icon} />
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {activeTab === 'discussions' && (
          <div className="page-grid lg:grid-cols-[minmax(0,1.2fr)_20rem] lg:items-start">
            <div className="space-y-4">
              <section className="card">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D19A58]/18 text-[#D19A58]">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url as string}
                        alt=""
                        className="h-12 w-12 rounded-2xl object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold">
                        {getInitials(
                          (profile?.full_name as string | undefined) ||
                            (profile?.username as string | undefined) ||
                            user?.displayName ||
                            'You',
                        )}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#eedfc8]">Start a discussion</p>
                    <p className="text-xs text-[#eedfc8]/45">
                      Share an update, ask for support, or celebrate progress.
                    </p>
                  </div>
                </div>

                <textarea
                  value={newPostContent}
                  onChange={(event) => setNewPostContent(event.target.value)}
                  rows={4}
                  placeholder="What is on your mind today?"
                  className="input-field mt-4 resize-none"
                />

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-[#eedfc8]/40">
                    {profile?.is_anonymous ? 'Posting in anonymous mode.' : 'Posting with your profile.'}
                  </p>
                  <button
                    onClick={handleCreatePost}
                    disabled={posting || !newPostContent.trim()}
                    className="btn-primary !py-2.5 !px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {posting ? 'Posting...' : 'Post to community'}
                  </button>
                </div>
              </section>

              <section className="space-y-4">
                {featuredPosts.length > 0 ? (
                  featuredPosts.map((post) => {
                    const author = post.is_anonymous
                      ? 'Anonymous'
                      : ((post.profile?.full_name as string | undefined) ||
                        (post.profile?.username as string | undefined) ||
                        'Community member')

                    const liked = likedPostIds.has(post.id)
                    return (
                      <article key={post.id} className="card">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eedfc8]/10 text-sm font-bold text-[#D19A58]">
                            {post.is_anonymous ? <i className="ri-spy-line text-base" /> : getInitials(author)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-semibold text-[#eedfc8]">{author}</p>
                              {typeof post.type === 'string' && (
                                <span className="badge text-[10px]">{post.type}</span>
                              )}
                            </div>
                            <p className="text-xs text-[#eedfc8]/40">{formatRelativeTime(post.created_at)}</p>
                          </div>
                        </div>

                        <p className="mt-4 text-sm leading-relaxed text-[#eedfc8]/75">
                          {post.content as string}
                        </p>

                        <div className="mt-4 flex items-center gap-4 border-t border-[#eedfc8]/8 pt-4 text-sm">
                          <button
                            onClick={() => handleToggleLike(post.id)}
                            className={`flex items-center gap-1.5 transition-colors ${
                              liked ? 'text-[#B85C3A]' : 'text-[#eedfc8]/45'
                            }`}
                          >
                            <i className={liked ? 'ri-heart-fill' : 'ri-heart-line'} />
                            {formatCompactNumber(post.likes_count as number | undefined)}
                          </button>
                          <span className="flex items-center gap-1.5 text-[#eedfc8]/45">
                            <i className="ri-chat-1-line" />
                            {formatCompactNumber(post.comments_count as number | undefined)}
                          </span>
                        </div>
                      </article>
                    )
                  })
                ) : (
                  <div className="card-light text-center">
                    <i className="ri-chat-smile-3-line text-3xl text-[#eedfc8]/30" />
                    <p className="mt-3 text-sm text-[#eedfc8]/60">No one has posted here yet.</p>
                    <p className="mt-1 text-xs text-[#eedfc8]/40">Your post can be the one that starts the conversation.</p>
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-4">
              <section className="card">
                <h2 className="section-title">Community rhythm</h2>
                <div className="space-y-3">
                  <div className="card-light !p-4">
                    <p className="text-xs text-[#eedfc8]/45">Latest activity</p>
                    <p className="mt-1 text-sm font-semibold text-[#eedfc8]">
                      {featuredPosts[0] ? formatRelativeTime(featuredPosts[0].created_at) : 'Waiting for the first update'}
                    </p>
                  </div>
                  <div className="card-light !p-4">
                    <p className="text-xs text-[#eedfc8]/45">Support available now</p>
                    <p className="mt-1 text-sm font-semibold text-[#eedfc8]">
                      {formatCompactNumber(angels.length + mentors.length)} people ready to help
                    </p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        )}

        {activeTab === 'angels' && (
          <section className="page-card-grid">
            {angels.length > 0 ? (
              angels.map((angel) => {
                const profileData = (angel.profile as Record<string, unknown> | undefined) ?? {}
                const name =
                  (profileData.full_name as string | undefined) ||
                  (profileData.username as string | undefined) ||
                  'Peer supporter'

                const isChoosing = choosingAngelIds.has(angel.id as string)
                return (
                  <article key={angel.id as string} className="card">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D19A58]/20 text-sm font-bold text-[#D19A58]">
                        {getInitials(name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate font-semibold text-[#eedfc8]">{name}</h2>
                          <span className="h-2 w-2 rounded-full bg-green-400" />
                        </div>
                        <p className="text-xs text-[#D19A58]">{angel.specialty as string}</p>
                        <p className="mt-1 text-xs text-[#eedfc8]/45">
                          Rating {angel.rating as number} • {(angel.response_time as string | undefined) || 'Responds soon'}
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-[#eedfc8]/70">
                      {(angel.bio as string | undefined) || 'A real peer supporter available to walk alongside you.'}
                    </p>

                    <div className="mt-4 flex items-center justify-between text-xs text-[#eedfc8]/45">
                      <span>{angel.current_souls as number}/{angel.max_souls as number} members supported</span>
                      <span>{formatCompactNumber(angel.total_reviews as number | undefined)} reviews</span>
                    </div>

                    <button
                      onClick={() => handleChooseAngel(angel.id as string)}
                      disabled={isChoosing}
                      className="btn-primary mt-4 w-full !py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isChoosing ? 'Connecting...' : 'Choose this angel'}
                    </button>
                  </article>
                )
              })
            ) : (
              <div className="card-light text-center">
                <i className="ri-heart-pulse-line text-3xl text-[#eedfc8]/30" />
                <p className="mt-3 text-sm text-[#eedfc8]/60">No angels are marked available right now.</p>
              </div>
            )}
          </section>
        )}

        {activeTab === 'mentors' && (
          <section className="page-card-grid">
            {mentors.length > 0 ? (
              mentors.map((mentor) => {
                const profileData = (mentor.profile as Record<string, unknown> | undefined) ?? {}
                const name =
                  (profileData.full_name as string | undefined) ||
                  (profileData.username as string | undefined) ||
                  'Mentor'

                return (
                  <article key={mentor.id as string} className="card">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#B85C3A]/16 text-sm font-bold text-[#B85C3A]">
                        {getInitials(name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate font-semibold text-[#eedfc8]">{name}</h2>
                        <p className="text-xs text-[#eedfc8]/45">
                          {(mentor.credentials as string | undefined) || 'Guided support'}
                        </p>
                        <p className="mt-1 text-xs text-[#D19A58]">
                          Rating {mentor.rating as number} • {formatCompactNumber(mentor.sessions_completed as number | undefined)} sessions
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {((mentor.expertise as string[] | undefined) || []).slice(0, 4).map((topic) => (
                        <span key={topic} className="badge text-[10px]">
                          {topic}
                        </span>
                      ))}
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-[#eedfc8]/70">
                      {(mentor.bio as string | undefined) || 'Available for guided, structured support.'}
                    </p>

                    <Link href="/therapy" className="btn-accent mt-4 block w-full !py-2.5 text-center text-sm">
                      View in support space
                    </Link>
                  </article>
                )
              })
            ) : (
              <div className="card-light text-center">
                <i className="ri-user-star-line text-3xl text-[#eedfc8]/30" />
                <p className="mt-3 text-sm text-[#eedfc8]/60">No mentors have been published yet.</p>
              </div>
            )}
          </section>
        )}

        {activeTab === 'activities' && (
          <section className="page-card-grid">
            {activities.length > 0 ? (
              activities.map((activity) => {
                const organizer = (activity.organizer as Record<string, unknown> | undefined) ?? {}
                const organizerName =
                  (organizer.full_name as string | undefined) ||
                  (organizer.username as string | undefined) ||
                  'Community host'
                const joining = joiningActivityIds.has(activity.id as string)

                return (
                  <article key={activity.id as string} className="card">
                    <div className="flex items-center justify-between gap-3">
                      <span className="badge">
                        {(activity.activity_type as string | undefined) || 'Group activity'}
                      </span>
                      <span className="text-xs text-[#eedfc8]/45">
                        {formatRelativeTime(activity.scheduled_at)}
                      </span>
                    </div>
                    <h2 className="mt-4 text-xl font-semibold text-[#eedfc8]">
                      {activity.title as string}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[#eedfc8]/65">
                      {(activity.description as string | undefined) || 'A live community activity.'}
                    </p>
                    <div className="mt-4 space-y-2 text-xs text-[#eedfc8]/45">
                      <p>
                        <i className="ri-user-heart-line mr-1.5" />
                        Hosted by {organizerName}
                      </p>
                      {(activity.location as string | undefined) && (
                        <p>
                          <i className="ri-map-pin-2-line mr-1.5" />
                          {activity.location as string}
                        </p>
                      )}
                      <p>
                        <i className="ri-group-line mr-1.5" />
                        {formatCompactNumber(activity.participants_count as number | undefined)} joined
                      </p>
                    </div>
                    <button
                      onClick={() => handleJoinActivity(activity.id as string)}
                      disabled={joining}
                      className="btn-primary mt-5 w-full !py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {joining ? 'Joining...' : 'Join activity'}
                    </button>
                  </article>
                )
              })
            ) : (
              <div className="card-light text-center">
                <i className="ri-compass-3-line text-3xl text-[#eedfc8]/30" />
                <p className="mt-3 text-sm text-[#eedfc8]/60">No activities have been scheduled yet.</p>
              </div>
            )}
          </section>
        )}
      </div>

      <BottomNav />
    </PageFrame>
  )
}
