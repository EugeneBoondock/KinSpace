'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import BottomNav from '@/components/BottomNav'

interface Profile {
  id: string
  full_name?: string
  username?: string
  avatar_url?: string
  conditions?: string[]
  [key: string]: unknown
}

interface Group {
  id: string
  name?: string
  category?: string
  members_count?: number
  description?: string
  icon?: string
  [key: string]: unknown
}

interface Post {
  id: string
  content?: string
  type?: string
  likes_count?: number
  comments_count?: number
  created_at?: { seconds: number }
  is_anonymous?: boolean
  profile?: {
    full_name?: string
    username?: string
    avatar_url?: string
  } | null
  [key: string]: unknown
}

const moodEmojis = [
  { emoji: '\u{1F604}', label: 'Great', value: 'great' },
  { emoji: '\u{1F642}', label: 'Good', value: 'good' },
  { emoji: '\u{1F610}', label: 'Okay', value: 'okay' },
  { emoji: '\u{1F614}', label: 'Rough', value: 'rough' },
  { emoji: '\u{1F622}', label: 'Bad', value: 'bad' },
]

const quickActions = [
  { href: '/therapy', icon: 'ri-heart-pulse-line', label: 'Therapy', color: 'bg-brand-accent1/20 text-brand-accent1' },
  { href: '/games', icon: 'ri-gamepad-line', label: 'Games', color: 'bg-brand-accent2/20 text-brand-accent2' },
  { href: '/community', icon: 'ri-group-line', label: 'Groups', color: 'bg-brand-accent3/20 text-brand-accent3' },
  { href: '/map', icon: 'ri-map-pin-line', label: 'Map', color: 'bg-[#eedfc8]/10 text-[#eedfc8]' },
]

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 18) return 'Good Afternoon'
  return 'Good Evening'
}

function timeAgo(seconds: number): string {
  const now = Date.now() / 1000
  const diff = now - seconds
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [recommendedGroups, setRecommendedGroups] = useState<Group[]>([])
  const [recentPosts, setRecentPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMood, setSelectedMood] = useState<string | null>(null)
  const [moodSaved, setMoodSaved] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    async function fetchData() {
      if (!user) return
      try {
        const [profileData, allGroups, posts] = await Promise.all([
          DatabaseService.getProfile(user.userId),
          DatabaseService.getGroups(),
          DatabaseService.getCommunityPosts(5),
        ])
        const prof = profileData as Profile | null
        if (prof && (prof as Record<string, unknown>).onboarding_complete === false) {
          router.push('/onboarding')
          return
        }
        setProfile(prof)
        const groupList = allGroups as Group[]
        setGroups(groupList.slice(0, 5))
        setRecommendedGroups(groupList.slice(5, 8))
        setRecentPosts(posts as Post[])
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    if (user) fetchData()
  }, [user])

  const handleMoodSelect = async (value: string) => {
    setSelectedMood(value)
    setMoodSaved(true)
    setTimeout(() => setMoodSaved(false), 2000)
    if (user) {
      try {
        await DatabaseService.updateProfile(user.userId, { daily_mood: value, mood_updated_at: new Date().toISOString() })
      } catch (err) {
        console.error('Failed to save mood:', err)
      }
    }
  }

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-brand-primary pb-20">
        <div className="px-4 pt-14 space-y-6">
          <div className="h-8 w-48 skeleton rounded-lg" />
          <div className="h-4 w-32 skeleton rounded" />
          <div className="grid grid-cols-4 gap-3">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-20 skeleton rounded-xl" />
            ))}
          </div>
          <div className="h-40 skeleton rounded-xl" />
          <div className="h-32 skeleton rounded-xl" />
        </div>
        <BottomNav />
      </div>
    )
  }

  const displayName = profile?.full_name || user?.displayName || user?.username || 'Friend'

  return (
    <div className="min-h-screen bg-brand-primary pb-20">
      {/* Header */}
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-[#eedfc8]/60 text-sm">{getGreeting()},</p>
            <h1 className="text-2xl font-bold text-[#eedfc8]">{displayName}</h1>
          </div>
          <Link href={user ? `/profile/${user.userId}` : '/login'} className="relative">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-10 h-10 rounded-full object-cover border-2 border-[#D19A58]"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-brand-accent2/30 flex items-center justify-center border-2 border-[#D19A58]">
                <span className="text-[#D19A58] font-bold text-sm">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </Link>
        </div>
      </div>

      <div className="px-4 space-y-5">
        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[#eedfc8]/5 border border-[#eedfc8]/10 hover:bg-[#eedfc8]/10 transition-all active:scale-95"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${action.color}`}>
                <i className={`${action.icon} text-lg`} />
              </div>
              <span className="text-[#eedfc8]/80 text-xs font-medium">{action.label}</span>
            </Link>
          ))}
        </div>

        {/* Daily Wellness Card */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <i className="ri-mental-health-line text-[#D19A58] text-lg" />
            <h2 className="section-title !mb-0">Daily Wellness</h2>
          </div>
          <p className="text-[#eedfc8]/60 text-sm mb-4">How are you feeling today?</p>
          <div className="flex items-center justify-between gap-2">
            {moodEmojis.map((mood) => (
              <button
                key={mood.value}
                onClick={() => handleMoodSelect(mood.value)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all flex-1 ${
                  selectedMood === mood.value
                    ? 'bg-[#D19A58]/20 border border-[#D19A58]/40 scale-105'
                    : 'bg-[#eedfc8]/5 border border-transparent hover:bg-[#eedfc8]/10'
                }`}
              >
                <span className="text-2xl">{mood.emoji}</span>
                <span className="text-[10px] text-[#eedfc8]/60">{mood.label}</span>
              </button>
            ))}
          </div>
          {moodSaved && (
            <div className="mt-3 text-center text-sm text-[#D19A58]">
              <i className="ri-check-line mr-1" />Mood saved!
            </div>
          )}
        </div>

        {/* Your Groups - Horizontal Scroll */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title !mb-0">Your Groups</h2>
            <Link href="/community" className="text-[#D19A58] text-sm font-medium">
              See All <i className="ri-arrow-right-s-line" />
            </Link>
          </div>
          {loading ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="min-w-[140px] h-[100px] skeleton rounded-xl flex-shrink-0" />
              ))}
            </div>
          ) : groups.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {groups.map((group) => (
                <Link
                  key={group.id}
                  href={`/community?group=${group.id}`}
                  className="min-w-[140px] p-3 rounded-xl bg-[#eedfc8]/5 border border-[#eedfc8]/10 flex-shrink-0 hover:bg-[#eedfc8]/10 transition-all"
                >
                  <div className="w-8 h-8 rounded-lg bg-brand-accent1/20 flex items-center justify-center mb-2">
                    <i className={`${group.icon || 'ri-group-line'} text-brand-accent1`} />
                  </div>
                  <p className="text-[#eedfc8] text-sm font-semibold truncate">{group.name || 'Unnamed Group'}</p>
                  <p className="text-[#eedfc8]/50 text-xs mt-0.5">
                    {group.members_count || 0} members
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="card-light text-center py-8">
              <i className="ri-group-line text-3xl text-[#eedfc8]/30 block mb-2" />
              <p className="text-[#eedfc8]/50 text-sm">No groups yet</p>
              <Link href="/community" className="text-[#D19A58] text-sm font-medium mt-2 inline-block">
                Browse Groups <i className="ri-arrow-right-s-line" />
              </Link>
            </div>
          )}
        </div>

        {/* Recommended For You */}
        <div>
          <h2 className="section-title">Recommended For You</h2>
          {loading ? (
            <div className="space-y-3">
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-20 skeleton rounded-xl" />
              ))}
            </div>
          ) : recommendedGroups.length > 0 ? (
            <div className="space-y-3">
              {recommendedGroups.map((group) => (
                <div key={group.id} className="card-light flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-brand-accent2/20 flex items-center justify-center flex-shrink-0">
                    <i className={`${group.icon || 'ri-team-line'} text-xl text-[#D19A58]`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#eedfc8] font-semibold text-sm truncate">{group.name || 'Support Group'}</p>
                    <p className="text-[#eedfc8]/50 text-xs truncate">{group.description || 'A supportive community'}</p>
                    <p className="text-[#eedfc8]/40 text-xs mt-0.5">{group.members_count || 0} members</p>
                  </div>
                  <Link
                    href={`/community?group=${group.id}`}
                    className="btn-accent !py-1.5 !px-3 !text-xs flex-shrink-0"
                  >
                    Join
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="card-light text-center py-6">
              <p className="text-[#eedfc8]/50 text-sm">No recommendations yet. Join some groups to get started!</p>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title !mb-0">Recent Activity</h2>
            <Link href="/community" className="text-[#D19A58] text-sm font-medium">
              View All <i className="ri-arrow-right-s-line" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-24 skeleton rounded-xl" />
              ))}
            </div>
          ) : recentPosts.length > 0 ? (
            <div className="space-y-3">
              {recentPosts.map((post) => (
                <div key={post.id} className="card-light">
                  <div className="flex items-center gap-2 mb-2">
                    {post.is_anonymous ? (
                      <div className="w-8 h-8 rounded-full bg-[#eedfc8]/10 flex items-center justify-center">
                        <i className="ri-spy-line text-[#eedfc8]/50 text-sm" />
                      </div>
                    ) : post.profile?.avatar_url ? (
                      <img
                        src={post.profile.avatar_url}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-brand-accent3/30 flex items-center justify-center">
                        <span className="text-[#eedfc8] text-xs font-bold">
                          {(post.profile?.full_name || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[#eedfc8] text-sm font-semibold truncate">
                        {post.is_anonymous ? 'Anonymous' : post.profile?.full_name || post.profile?.username || 'Unknown'}
                      </p>
                      <p className="text-[#eedfc8]/40 text-xs">
                        {post.created_at?.seconds ? timeAgo(post.created_at.seconds) : 'recently'}
                      </p>
                    </div>
                    {post.type && (
                      <span className="badge text-[10px]">{post.type}</span>
                    )}
                  </div>
                  <p className="text-[#eedfc8]/80 text-sm line-clamp-2">{post.content}</p>
                  <div className="flex items-center gap-4 mt-3 text-[#eedfc8]/40">
                    <button className="flex items-center gap-1 text-xs hover:text-[#B85C3A] transition-colors">
                      <i className="ri-heart-line" /> {post.likes_count || 0}
                    </button>
                    <button className="flex items-center gap-1 text-xs hover:text-[#eedfc8]/70 transition-colors">
                      <i className="ri-chat-1-line" /> {post.comments_count || 0}
                    </button>
                    <button className="flex items-center gap-1 text-xs hover:text-[#eedfc8]/70 transition-colors ml-auto">
                      <i className="ri-share-forward-line" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card-light text-center py-6">
              <i className="ri-chat-smile-3-line text-3xl text-[#eedfc8]/30 block mb-2" />
              <p className="text-[#eedfc8]/50 text-sm">No recent activity</p>
              <p className="text-[#eedfc8]/40 text-xs mt-1">Posts from your community will appear here</p>
            </div>
          )}
        </div>

        {/* Stats Card */}
        <div className="card">
          <h2 className="section-title">Your Stats</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#D19A58]">
                {loading ? <span className="inline-block w-8 h-7 skeleton rounded" /> : '7'}
              </div>
              <p className="text-[#eedfc8]/50 text-xs mt-1">Days Active</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#B85C3A]">
                {loading ? <span className="inline-block w-8 h-7 skeleton rounded" /> : groups.length}
              </div>
              <p className="text-[#eedfc8]/50 text-xs mt-1">Groups Joined</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-brand-accent3">
                {loading ? <span className="inline-block w-8 h-7 skeleton rounded" /> : '12'}
              </div>
              <p className="text-[#eedfc8]/50 text-xs mt-1">Connections</p>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
