'use client'

import { use, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProfileAvatar from '@/components/ProfileAvatar'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { StorageService } from '@/lib/storage'
import { EncryptionService } from '@/lib/encryption'
import BottomNav from '@/components/BottomNav'
import StrandButton from '@/components/StrandButton'
import { useToast } from '@/components/Toast'

interface Profile {
  id: string
  full_name?: string
  username?: string
  avatar_url?: string | null
  cover_image_url?: string
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
  const { push: toast } = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'activity'>('overview')
  const [connectionState, setConnectionState] = useState<'idle' | 'sent' | 'received' | 'accepted'>('idle')
  const [connectionRequestId, setConnectionRequestId] = useState<string | null>(null)

  // Post creation
  const [newPostContent, setNewPostContent] = useState('')
  const [posting, setPosting] = useState(false)

  // Cover photo upload
  const [uploadingCover, setUploadingCover] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const isOwnProfile = user?.userId === userId

  useEffect(() => {
    async function fetchProfile() {
      try {
        const [profileData, userPosts, memberships, sentRequests, receivedRequests] = await Promise.all([
          DatabaseService.getProfile(userId),
          DatabaseService.getCommunityPosts(20, { userId }),
          DatabaseService.getUserGroupMemberships(userId),
          user && user.userId !== userId
            ? DatabaseService.getSentConnectionRequests(user.userId)
            : Promise.resolve([]),
          user && user.userId !== userId
            ? DatabaseService.getReceivedConnectionRequests(user.userId)
            : Promise.resolve([]),
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

        setPosts(userPosts as Post[])
        setGroups(
          (memberships as Array<{ group?: Group | null }>)
            .map((membership) => membership.group)
            .filter(Boolean) as Group[],
        )

        if (user && user.userId !== userId) {
          const typedSentRequests = sentRequests as Record<string, unknown>[]
          const typedReceivedRequests = receivedRequests as Record<string, unknown>[]
          const pendingSent = typedSentRequests.find(
            (request) => request.target_user_id === userId && request.status === 'pending',
          )
          const pendingReceived = typedReceivedRequests.find(
            (request) => request.requester_id === userId && request.status === 'pending',
          )
          const acceptedRequest =
            typedSentRequests.find(
              (request) => request.target_user_id === userId && request.status === 'accepted',
            ) ||
            typedReceivedRequests.find(
              (request) => request.requester_id === userId && request.status === 'accepted',
            )

          if (pendingReceived) {
            setConnectionState('received')
            setConnectionRequestId(pendingReceived.id as string)
          } else if (pendingSent) {
            setConnectionState('sent')
            setConnectionRequestId(pendingSent.id as string)
          } else if (acceptedRequest) {
            setConnectionState('accepted')
            setConnectionRequestId(acceptedRequest.id as string)
          } else {
            setConnectionState('idle')
            setConnectionRequestId(null)
          }
        } else {
          setConnectionState('idle')
          setConnectionRequestId(null)
        }
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
      <div className="min-h-screen bg-brand-primary pb-24 md:pb-28">
        <div className="mx-auto w-full max-w-5xl">
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
        </div>
        <BottomNav />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-brand-primary pb-24 md:pb-28 flex flex-col items-center justify-center px-4">
        <i className="ri-user-unfollow-line text-5xl text-[#eedfc8]/30 mb-4" />
        <h2 className="text-[#eedfc8] text-xl font-bold mb-2">Profile Not Found</h2>
        <p className="text-[#eedfc8]/50 text-sm text-center mb-6">This user does not exist or their profile has been removed.</p>
        <Link href="/dashboard" className="btn-primary">Go to Dashboard</Link>
        <BottomNav />
      </div>
    )
  }

  const displayName = profile.full_name || profile.username || 'User'
  const visibleConditions = (profile.conditions || []).filter((condition) => condition !== 'Private')

  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: 'ri-user-line' },
    { key: 'groups' as const, label: 'Groups', icon: 'ri-group-line' },
    { key: 'activity' as const, label: 'Activity', icon: 'ri-time-line' },
  ]

  async function handleCreatePost() {
    if (!user || !newPostContent.trim() || !isOwnProfile) return

    setPosting(true)
    try {
      await DatabaseService.createPost(
        user.userId,
        newPostContent.trim(),
        'discussion',
        [],
        false,
      )
      const refreshedPosts = await DatabaseService.getCommunityPosts(20, { userId })
      setPosts(refreshedPosts as Post[])
      setNewPostContent('')
      toast('Post shared to your profile', 'success')
    } catch (error) {
      console.error('Failed to create post:', error)
      toast('Could not share post, please try again', 'error')
    } finally {
      setPosting(false)
    }
  }

  async function handleCoverUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !user || !isOwnProfile) return

    setUploadingCover(true)
    try {
      const coverUrl = await StorageService.uploadProfileCover(user.userId, file)
      await DatabaseService.updateProfile(user.userId, { cover_image_url: coverUrl })
      setProfile((prev) => prev ? { ...prev, cover_image_url: coverUrl } : prev)
      toast('Cover photo updated', 'success')
    } catch (error) {
      console.error('Failed to upload cover:', error)
      toast('Cover upload failed', 'error')
    } finally {
      setUploadingCover(false)
      if (coverInputRef.current) coverInputRef.current.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-brand-primary pb-24 md:pb-28">
      <div className="mx-auto w-full max-w-5xl">
        {/* Cover Area */}
        <div className="relative h-36 overflow-hidden bg-gradient-to-br from-brand-accent3/40 via-brand-primary to-brand-accent1/20">
          {profile?.cover_image_url ? (
            <img
              src={profile.cover_image_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          )}
          <div className="absolute top-4 left-4">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-full bg-brand-primary/60 backdrop-blur-sm flex items-center justify-center text-[#eedfc8] hover:bg-brand-primary/80 transition-colors"
            >
              <i className="ri-arrow-left-line text-lg" />
            </button>
          </div>
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {isOwnProfile && (
              <>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleCoverUpload}
                />
                <button
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploadingCover}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-primary/60 backdrop-blur-sm text-[#eedfc8] text-xs font-medium hover:bg-brand-primary/80 transition-colors disabled:opacity-50"
                >
                  <i className={uploadingCover ? 'ri-loader-4-line animate-spin text-sm' : 'ri-camera-line text-sm'} />
                  {uploadingCover ? 'Uploading...' : 'Cover photo'}
                </button>
                <Link
                  href="/settings"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-primary/60 backdrop-blur-sm text-[#eedfc8] text-xs font-medium hover:bg-brand-primary/80 transition-colors"
                >
                  <i className="ri-edit-line text-sm" />
                  Edit Profile
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Avatar + Info */}
        <div className="relative z-10 px-4 -mt-12">
        {/* Avatar */}
        <div className="mb-3">
          <ProfileAvatar
            alt={displayName}
            avatarUrl={profile.avatar_url}
            className="w-24 h-24 rounded-full object-cover border-4 border-brand-primary shadow-lg"
            fullName={profile.full_name}
            userId={profile.id}
            username={profile.username}
          />
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

        {/* Bio - thought bubble */}
        {profile.bio && (
          <div className="relative mb-3">
            <div className="relative rounded-2xl bg-[#eedfc8]/6 border border-[#eedfc8]/8 px-4 py-2.5">
              <p className="text-[#eedfc8]/70 text-xs leading-relaxed italic">&ldquo;{profile.bio}&rdquo;</p>
            </div>
            <div className="absolute -bottom-1.5 left-5 w-3 h-3 rounded-full bg-[#eedfc8]/6 border border-[#eedfc8]/8" />
            <div className="absolute -bottom-3.5 left-3 w-1.5 h-1.5 rounded-full bg-[#eedfc8]/6 border border-[#eedfc8]/8" />
          </div>
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
        {visibleConditions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {visibleConditions.map((condition, idx) => {
              const slug = condition
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
              return (
                <Link
                  key={condition}
                  href={`/conditions/${slug}`}
                  className={`badge !text-xs transition-opacity hover:opacity-80 ${conditionColors[idx % conditionColors.length]}`}
                  title={`See what works for ${condition}`}
                >
                  {condition}
                </Link>
              )
            })}
          </div>
        )}

        {/* Stats Row */}
        <div className="flex items-center gap-6 mb-5">
          <div className="text-center">
            <p className="text-[#eedfc8] font-bold text-lg">{groups.length}</p>
            <p className="text-[#eedfc8]/40 text-xs">Groups</p>
          </div>
          <div className="text-center">
            <p className="text-[#eedfc8] font-bold text-lg">{posts.length}</p>
            <p className="text-[#eedfc8]/40 text-xs">Posts</p>
          </div>
          <div className="text-center">
            <p className="text-[#eedfc8] font-bold text-lg">{profile.interests?.length ?? 0}</p>
            <p className="text-[#eedfc8]/40 text-xs">Interests</p>
          </div>
        </div>

        {/* Action Buttons (if not own profile) */}
        {!isOwnProfile && user && (
          <div className="mb-5 space-y-3">
            <div className="flex flex-wrap gap-3">
              <StrandButton
                targetUserId={userId}
                initialStatus={
                  connectionState === 'accepted'
                    ? 'accepted'
                    : connectionState === 'received'
                      ? 'received'
                      : connectionState === 'sent'
                        ? 'sent'
                        : 'idle'
                }
                initialRequestId={connectionRequestId}
                className="flex-1"
              />
              <button
                onClick={() => setActiveTab('groups')}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <i className="ri-group-line" /> See groups
              </button>
            </div>
            <p className="text-xs text-[#eedfc8]/45">
              {connectionState === 'received'
                ? '🧬 They sent you a strand. Accept to connect.'
                : connectionState === 'sent'
                  ? 'Strand pending, tap to withdraw.'
                  : connectionState === 'accepted'
                    ? '🧬 You are stranded with this member.'
                    : 'A strand is how KinSpace friends say hi, no algorithms, just you reaching out.'}
            </p>
          </div>
        )}

        {!isOwnProfile && !user && (
          <div className="flex gap-3 mb-5">
            <Link href="/login" className="btn-primary flex-1 flex items-center justify-center gap-2">
              <i className="ri-login-circle-line" /> Sign in to connect
            </Link>
            <button
              onClick={() => setActiveTab('groups')}
              className="btn-secondary flex-1 flex items-center justify-center gap-2"
            >
              <i className="ri-group-line" /> See groups
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
            {/* Create Post (own profile only) */}
            {isOwnProfile && (
              <div className="card">
                <h3 className="text-[#eedfc8] font-semibold text-sm mb-3 flex items-center gap-2">
                  <i className="ri-quill-pen-line text-[#D19A58]" /> Create a post
                </h3>
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  rows={3}
                  placeholder="Share something with the community..."
                  className="w-full rounded-xl bg-[#eedfc8]/6 border border-[#eedfc8]/10 px-4 py-3 text-sm text-[#eedfc8] placeholder-[#eedfc8]/30 outline-none focus:border-[#D19A58]/40 resize-none"
                />
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-[#eedfc8]/40">Posts appear in Community and on your Activity tab.</p>
                  <button
                    onClick={handleCreatePost}
                    disabled={posting || !newPostContent.trim()}
                    className="btn-primary !py-2 !px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {posting ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            )}

            {/* Crowd-source actions (own profile only) */}
            {isOwnProfile && (
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/groups?create=1"
                  className="card-light flex flex-col items-center gap-2 py-4 text-center hover:bg-[#eedfc8]/12 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#D19A58]/16 flex items-center justify-center">
                    <i className="ri-group-line text-lg text-[#D19A58]" />
                  </div>
                  <span className="text-[#eedfc8] text-xs font-semibold">Create Group</span>
                </Link>
                <Link
                  href="/resources?submit=1"
                  className="card-light flex flex-col items-center gap-2 py-4 text-center hover:bg-[#eedfc8]/12 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#6B8A83]/16 flex items-center justify-center">
                    <i className="ri-book-open-line text-lg text-[#6B8A83]" />
                  </div>
                  <span className="text-[#eedfc8] text-xs font-semibold">Add Resource</span>
                </Link>
              </div>
            )}

            {/* About — only the owner sees this nudge when bio is empty */}
            {!profile.bio && isOwnProfile && (
              <div className="card">
                <h3 className="text-[#eedfc8] font-semibold text-sm mb-3 flex items-center gap-2">
                  <i className="ri-information-line text-[#D19A58]" /> About
                </h3>
                <p className="text-[#eedfc8]/55 text-sm">
                  Add a short bio so the community has a sense of who you are.
                </p>
                <Link href="/settings" className="btn-primary mt-3 inline-block !py-2 !px-4 text-xs">
                  Write your bio
                </Link>
              </div>
            )}

            {/* Conditions */}
            {visibleConditions.length > 0 && (
              <div className="card">
                <h3 className="text-[#eedfc8] font-semibold text-sm mb-3 flex items-center gap-2">
                  <i className="ri-heart-pulse-line text-[#B85C3A]" /> Conditions
                </h3>
                <div className="flex flex-wrap gap-2">
                  {visibleConditions.map((condition, idx) => (
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
                    <ProfileAvatar
                      alt={displayName}
                      avatarUrl={profile.avatar_url}
                      className="w-7 h-7 rounded-full object-cover"
                      fullName={profile.full_name}
                      userId={profile.id}
                      username={profile.username}
                    />
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
      </div>

      <BottomNav />
    </div>
  )
}
