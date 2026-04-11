'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { EncryptionService } from '@/lib/encryption'
import BottomNav from '@/components/BottomNav'

interface Profile {
  id: string
  full_name?: string
  username?: string
  avatar_url?: string
  bio?: string
  location?: string
  conditions?: string[]
  comorbidities?: string[]
  interests?: string[]
  pronouns?: string
  status?: string
  followers?: number
  following?: number
  postsCount?: number
  created_at?: { seconds: number }
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
  [key: string]: unknown
}

interface Group {
  id: string
  name?: string
  category?: string
  members_count?: number
  icon?: string
  [key: string]: unknown
}

const conditionColors = [
  'bg-brand-accent1/20 text-brand-accent1',
  'bg-brand-accent2/20 text-[#D19A58]',
  'bg-brand-accent3/20 text-brand-accent3',
  'bg-[#eedfc8]/10 text-[#eedfc8]',
  'bg-[#B85C3A]/15 text-[#B85C3A]',
]

function timeAgo(seconds: number): string {
  const now = Date.now() / 1000
  const diff = now - seconds
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(seconds * 1000).toLocaleDateString()
}

export default function ProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'activity'>('overview')

  const isOwnProfile = user?.userId === userId

  useEffect(() => {
    async function fetchProfile() {
      try {
        const [profileData, allPosts, allGroups] = await Promise.all([
          DatabaseService.getProfile(userId),
          DatabaseService.getCommunityPosts(10),
          DatabaseService.getGroups(),
        ])

        if (profileData) {
          const data = profileData as Record<string, unknown>
          // Decrypt health fields if viewing own profile
          if (user?.userId === userId) {
            try {
              const key = await EncryptionService.getOrCreateUserKey(userId)
              const decrypted = await EncryptionService.decryptFields(data, key)
              setProfile({
                ...(data as Profile),
                conditions: decrypted.conditions,
                comorbidities: decrypted.comorbidities,
                medications: decrypted.medications,
                status: decrypted.status || undefined,
              })
            } catch {
              setProfile(profileData as Profile)
            }
          } else {
            // For other users, clear encrypted fields and show placeholder
            const hasEncrypted = data.conditions_encrypted || data.comorbidities_encrypted || data.medications_encrypted
            setProfile({
              ...(data as Profile),
              conditions: hasEncrypted ? ['Private'] : (data.conditions as string[]) || [],
              comorbidities: hasEncrypted ? [] : (data.comorbidities as string[]) || [],
              medications: hasEncrypted ? [] : (data.medications as string[]) || [],
              status: data.status_encrypted ? 'Private' : (data.status as string) || undefined,
            })
          }
        } else {
          setProfile(null)
        }

        // Filter posts by this user
        const userPosts = (allPosts as Post[]).filter(
          (p) => (p as { user_id?: string }).user_id === userId
        )
        setPosts(userPosts)
        setGroups((allGroups as Group[]).slice(0, 6))
      } catch (err) {
        console.error('Failed to fetch profile:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [userId, user])

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-brand-primary pb-20">
        {/* Skeleton cover */}
        <div className="h-36 skeleton" />
        <div className="px-4 -mt-12">
          <div className="w-24 h-24 rounded-full skeleton border-4 border-brand-primary" />
          <div className="mt-3 space-y-2">
            <div className="h-6 w-40 skeleton rounded" />
            <div className="h-4 w-28 skeleton rounded" />
            <div className="h-4 w-full skeleton rounded mt-3" />
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-brand-primary pb-20 flex flex-col items-center justify-center px-4">
        <i className="ri-user-unfollow-line text-5xl text-[#eedfc8]/30 mb-4" />
        <h2 className="text-[#eedfc8] text-xl font-bold mb-2">Profile Not Found</h2>
        <p className="text-[#eedfc8]/50 text-sm text-center mb-6">This user does not exist or their profile has been removed.</p>
        <Link href="/dashboard" className="btn-primary">Go to Dashboard</Link>
        <BottomNav />
      </div>
    )
  }

  const displayName = profile.full_name || profile.username || 'User'
  const initial = displayName.charAt(0).toUpperCase()

  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: 'ri-user-line' },
    { key: 'groups' as const, label: 'Groups', icon: 'ri-group-line' },
    { key: 'activity' as const, label: 'Activity', icon: 'ri-time-line' },
  ]

  return (
    <div className="min-h-screen bg-brand-primary pb-20">
      {/* Cover Area */}
      <div className="relative h-36 bg-gradient-to-br from-brand-accent3/40 via-brand-primary to-brand-accent1/20 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-4 left-4">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-brand-primary/60 backdrop-blur-sm flex items-center justify-center text-[#eedfc8] hover:bg-brand-primary/80 transition-colors"
          >
            <i className="ri-arrow-left-line text-lg" />
          </button>
        </div>
        {isOwnProfile && (
          <div className="absolute top-4 right-4">
            <Link
              href="/settings"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-primary/60 backdrop-blur-sm text-[#eedfc8] text-xs font-medium hover:bg-brand-primary/80 transition-colors"
            >
              <i className="ri-edit-line text-sm" />
              Edit Profile
            </Link>
          </div>
        )}
      </div>

      {/* Avatar + Info */}
      <div className="px-4 -mt-12 relative z-10">
        {/* Avatar */}
        <div className="mb-3">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={displayName}
              className="w-24 h-24 rounded-full object-cover border-4 border-brand-primary shadow-lg"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-accent2/40 to-brand-accent1/30 border-4 border-brand-primary flex items-center justify-center shadow-lg">
              <span className="text-3xl font-bold text-[#D19A58]">{initial}</span>
            </div>
          )}
        </div>

        {/* Name & Username */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#eedfc8]">{displayName}</h1>
            {profile.status && (
              <span className="badge !text-[10px] !py-0.5 bg-brand-accent3/20 text-brand-accent3">
                {profile.status}
              </span>
            )}
          </div>
          {profile.username && (
            <p className="text-[#eedfc8]/50 text-sm">@{profile.username}</p>
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-[#eedfc8]/70 text-sm leading-relaxed mb-3">{profile.bio}</p>
        )}

        {/* Location & Pronouns */}
        <div className="flex flex-wrap items-center gap-3 text-[#eedfc8]/50 text-xs mb-4">
          {profile.location && (
            <span className="flex items-center gap-1">
              <i className="ri-map-pin-2-line" /> {profile.location}
            </span>
          )}
          {profile.pronouns && (
            <span className="flex items-center gap-1">
              <i className="ri-user-smile-line" /> {profile.pronouns}
            </span>
          )}
          {profile.created_at?.seconds && (
            <span className="flex items-center gap-1">
              <i className="ri-calendar-line" /> Joined {new Date(profile.created_at.seconds * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>

        {/* Conditions Badges */}
        {profile.conditions && profile.conditions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {profile.conditions.map((condition, idx) => (
              <span
                key={condition}
                className={`badge !text-xs ${conditionColors[idx % conditionColors.length]}`}
              >
                {condition}
              </span>
            ))}
          </div>
        )}

        {/* Stats Row */}
        <div className="flex items-center gap-6 mb-5">
          <div className="text-center">
            <p className="text-[#eedfc8] font-bold text-lg">{profile.followers ?? 0}</p>
            <p className="text-[#eedfc8]/40 text-xs">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-[#eedfc8] font-bold text-lg">{profile.following ?? 0}</p>
            <p className="text-[#eedfc8]/40 text-xs">Following</p>
          </div>
          <div className="text-center">
            <p className="text-[#eedfc8] font-bold text-lg">{profile.postsCount ?? posts.length}</p>
            <p className="text-[#eedfc8]/40 text-xs">Posts</p>
          </div>
        </div>

        {/* Action Buttons (if not own profile) */}
        {!isOwnProfile && user && (
          <div className="flex gap-3 mb-5">
            <button className="btn-primary flex-1 flex items-center justify-center gap-2">
              <i className="ri-user-add-line" /> Follow
            </button>
            <button className="btn-secondary flex-1 flex items-center justify-center gap-2">
              <i className="ri-chat-1-line" /> Message
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-[#eedfc8]/5 rounded-full p-1 mb-5 border border-[#eedfc8]/10">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-full text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? 'tab-active'
                  : 'tab-inactive'
              }`}
            >
              <i className={tab.icon} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* About */}
            <div className="card">
              <h3 className="text-[#eedfc8] font-semibold text-sm mb-3 flex items-center gap-2">
                <i className="ri-information-line text-[#D19A58]" /> About
              </h3>
              {profile.bio ? (
                <p className="text-[#eedfc8]/70 text-sm leading-relaxed">{profile.bio}</p>
              ) : (
                <p className="text-[#eedfc8]/40 text-sm">No bio yet.</p>
              )}
            </div>

            {/* Conditions */}
            {profile.conditions && profile.conditions.length > 0 && (
              <div className="card">
                <h3 className="text-[#eedfc8] font-semibold text-sm mb-3 flex items-center gap-2">
                  <i className="ri-heart-pulse-line text-[#B85C3A]" /> Conditions
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.conditions.map((condition, idx) => (
                    <span
                      key={condition}
                      className={`badge ${conditionColors[idx % conditionColors.length]}`}
                    >
                      {condition}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Activity Preview */}
            {posts.length > 0 && (
              <div className="card">
                <h3 className="text-[#eedfc8] font-semibold text-sm mb-3 flex items-center gap-2">
                  <i className="ri-time-line text-brand-accent3" /> Recent Activity
                </h3>
                <div className="space-y-3">
                  {posts.slice(0, 3).map((post) => (
                    <div key={post.id} className="py-2 border-b border-[#eedfc8]/5 last:border-0">
                      <p className="text-[#eedfc8]/70 text-sm line-clamp-2">{post.content}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[#eedfc8]/40 text-xs">
                        <span><i className="ri-heart-line mr-1" />{post.likes_count || 0}</span>
                        <span><i className="ri-chat-1-line mr-1" />{post.comments_count || 0}</span>
                        {post.created_at?.seconds && (
                          <span className="ml-auto">{timeAgo(post.created_at.seconds)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interests */}
            {profile.interests && profile.interests.length > 0 && (
              <div className="card">
                <h3 className="text-[#eedfc8] font-semibold text-sm mb-3 flex items-center gap-2">
                  <i className="ri-star-line text-[#D19A58]" /> Interests
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((interest) => (
                    <span key={interest} className="badge bg-[#eedfc8]/10 text-[#eedfc8]/70">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'groups' && (
          <div className="space-y-3">
            {groups.length > 0 ? (
              groups.map((group) => (
                <Link
                  key={group.id}
                  href={`/community?group=${group.id}`}
                  className="card-light flex items-center gap-3 block"
                >
                  <div className="w-11 h-11 rounded-xl bg-brand-accent1/20 flex items-center justify-center flex-shrink-0">
                    <i className={`${group.icon || 'ri-group-line'} text-lg text-brand-accent1`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#eedfc8] font-semibold text-sm truncate">{group.name || 'Group'}</p>
                    <p className="text-[#eedfc8]/40 text-xs">{group.members_count || 0} members</p>
                  </div>
                  <i className="ri-arrow-right-s-line text-[#eedfc8]/30" />
                </Link>
              ))
            ) : (
              <div className="card-light text-center py-8">
                <i className="ri-group-line text-3xl text-[#eedfc8]/30 block mb-2" />
                <p className="text-[#eedfc8]/50 text-sm">No groups joined yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-3">
            {posts.length > 0 ? (
              posts.map((post) => (
                <div key={post.id} className="card-light">
                  <div className="flex items-center gap-2 mb-2">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-brand-accent2/30 flex items-center justify-center">
                        <span className="text-[#D19A58] text-xs font-bold">{initial}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[#eedfc8] text-sm font-semibold truncate">{displayName}</p>
                      <p className="text-[#eedfc8]/40 text-xs">
                        {post.created_at?.seconds ? timeAgo(post.created_at.seconds) : 'recently'}
                      </p>
                    </div>
                    {post.type && <span className="badge text-[10px]">{post.type}</span>}
                  </div>
                  <p className="text-[#eedfc8]/80 text-sm">{post.content}</p>
                  <div className="flex items-center gap-4 mt-3 text-[#eedfc8]/40 text-xs">
                    <span className="flex items-center gap-1">
                      <i className="ri-heart-line" /> {post.likes_count || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="ri-chat-1-line" /> {post.comments_count || 0}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="card-light text-center py-8">
                <i className="ri-chat-smile-3-line text-3xl text-[#eedfc8]/30 block mb-2" />
                <p className="text-[#eedfc8]/50 text-sm">No activity yet</p>
                <p className="text-[#eedfc8]/40 text-xs mt-1">Posts will show up here</p>
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
