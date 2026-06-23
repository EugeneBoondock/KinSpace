'use client'

import { use, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { resendVerificationAction } from '@/app/actions/auth'
import ProfileAvatar from '@/components/ProfileAvatar'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { StorageService } from '@/lib/storage'
import { toDate } from '@/lib/platform'
import { EncryptionService } from '@/lib/encryption'
import BottomNav from '@/components/BottomNav'
import ReportDialog from '@/components/ReportDialog'
import StrandButton from '@/components/StrandButton'
import { useToast } from '@/components/Toast'
import { Button, LinkButton, Card, Textarea, Badge, Skeleton, EmptyState } from '@/components/ui'
import type { AchievementSummary } from '@/lib/achievements'

type Achievements = AchievementSummary & { is_owner: boolean }

const tierStyles: Record<string, string> = {
  bronze: 'bg-brand-accent2/15 text-brand-accent2 border-brand-accent2/30',
  silver: 'bg-brand-background/10 text-brand-background border-brand-background/20',
  gold: 'bg-brand-accent3/15 text-brand-accent3 border-brand-accent3/30',
}

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
  'bg-brand-accent2/20 text-brand-accent2',
  'bg-brand-accent3/20 text-brand-accent3',
  'bg-brand-background/10 text-brand-background',
  'bg-brand-accent1/15 text-brand-accent1',
]

type GameScore = { game_key: string; best: number; plays: number; last_played_at?: string | null }

const gameLabels: Record<string, string> = {
  '2048': '2048',
  snake: 'Snake',
  tetris: 'Tetris',
  simon: 'Simon',
  lightsout: 'Lights Out',
  wordsearch: 'Word Search',
}

function gameLabel(key: string): string {
  return gameLabels[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
}

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
  const [strandCount, setStrandCount] = useState(0)
  const [gameScores, setGameScores] = useState<GameScore[]>([])
  const [achievements, setAchievements] = useState<Achievements | null>(null)
  const [following, setFollowing] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'activity'>('overview')
  const [connectionState, setConnectionState] = useState<'idle' | 'sent' | 'received' | 'accepted'>('idle')
  const [connectionRequestId, setConnectionRequestId] = useState<string | null>(null)
  const [verificationBusy, setVerificationBusy] = useState(false)

  // Post creation
  const [newPostContent, setNewPostContent] = useState('')
  const [posting, setPosting] = useState(false)

  // Cover photo upload
  const [uploadingCover, setUploadingCover] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const isOwnProfile = user?.userId === userId
  const [blocked, setBlocked] = useState(false)
  const [blockBusy, setBlockBusy] = useState(false)

  useEffect(() => {
    if (!user || isOwnProfile) {
      setBlocked(false)
      return
    }
    let cancelled = false
    DatabaseService.isUserBlocked(userId)
      .then((v) => {
        if (!cancelled) setBlocked(Boolean(v))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [user, isOwnProfile, userId])

  const toggleBlock = async () => {
    if (!user || isOwnProfile || blockBusy) return
    setBlockBusy(true)
    try {
      if (blocked) {
        await DatabaseService.unblockUser(userId)
        setBlocked(false)
      } else {
        await DatabaseService.blockUser(userId)
        setBlocked(true)
      }
    } catch {
      // best effort
    } finally {
      setBlockBusy(false)
    }
  }

  const resendVerificationEmail = async () => {
    if (!isOwnProfile || user?.emailVerified || verificationBusy) return
    setVerificationBusy(true)
    try {
      const result = await resendVerificationAction()
      if (result.ok) toast('Verification email sent. Check your inbox.', 'success')
      else toast(result.error, 'error')
    } catch {
      toast('Could not send verification email. Please try again.', 'error')
    } finally {
      setVerificationBusy(false)
    }
  }

  useEffect(() => {
    async function fetchProfile() {
      try {
        const [
          profileData,
          userPosts,
          memberships,
          sentRequests,
          receivedRequests,
          gameScoresData,
          achievementsData,
          followData,
          strandData,
        ] = await Promise.all([
            DatabaseService.getProfile(userId),
            DatabaseService.getCommunityPosts(20, { userId }),
            DatabaseService.getUserGroupMemberships(userId),
            user && user.userId !== userId
              ? DatabaseService.getSentConnectionRequests(user.userId)
              : Promise.resolve([]),
            user && user.userId !== userId
              ? DatabaseService.getReceivedConnectionRequests(user.userId)
              : Promise.resolve([]),
            user ? DatabaseService.getUserGameScores(userId) : Promise.resolve([]),
            user ? DatabaseService.getAchievements(userId) : Promise.resolve(null),
            user && user.userId !== userId
              ? DatabaseService.isFollowing(userId)
              : Promise.resolve({ following: false }),
            DatabaseService.getStrandCountForUser(userId),
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
        setGameScores((gameScoresData as GameScore[]) || [])
        setAchievements((achievementsData as Achievements | null) ?? null)
        setFollowing(Boolean((followData as { following?: boolean } | null)?.following))
        setStrandCount(Number(strandData) || 0)

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
      <main className="page-shell min-h-screen">
        <div className="mx-auto w-full max-w-5xl">
          {/* Skeleton cover */}
          <Skeleton className="h-36 rounded-none" />
          <div className="-mt-12 px-4">
            <Skeleton className="h-24 w-24 rounded-full border-4 border-brand-primary" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-6 w-40 rounded" />
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="mt-3 h-4 w-full rounded" />
            </div>
          </div>
        </div>
        <BottomNav />
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="page-shell flex min-h-screen flex-col items-center justify-center px-4">
        <EmptyState
          icon={<i className="ri-user-unfollow-line text-5xl" />}
          title="Profile not found"
          description="This person doesn't exist, or their profile has been removed."
          action={<LinkButton href="/dashboard" leadingIcon={<i className="ri-home-4-line" />}>Go to dashboard</LinkButton>}
        />
        <BottomNav />
      </main>
    )
  }

  const displayName = profile.full_name || profile.username || 'User'
  const visibleConditions = (profile.hide_conditions_on_profile ? [] : profile.conditions || []).filter(
    (condition) => condition !== 'Private',
  )

  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: 'ri-user-line' },
    { key: 'groups' as const, label: 'Groups', icon: 'ri-group-line' },
    { key: 'activity' as const, label: 'Activity', icon: 'ri-time-line' },
  ]

  async function toggleFollow() {
    if (!user || isOwnProfile || followBusy) return
    const next = !following
    setFollowBusy(true)
    setFollowing(next) // optimistic
    try {
      if (next) await DatabaseService.followUser(userId)
      else await DatabaseService.unfollowUser(userId)
    } catch {
      setFollowing(!next) // rollback
    } finally {
      setFollowBusy(false)
    }
  }

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
    <main className="page-shell min-h-screen">
      <div className="mx-auto w-full max-w-5xl">
        {/* Cover Area */}
        <div className="relative h-36 overflow-hidden bg-gradient-to-br from-brand-accent3/40 via-brand-primary to-brand-accent1/20 sm:h-44">
          {profile?.cover_image_url ? (
            <img
              src={profile.cover_image_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          )}
          <div className="absolute left-4 top-4">
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary/60 text-brand-background backdrop-blur-sm transition-colors hover:bg-brand-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/60"
            >
              <i className="ri-arrow-left-line text-lg" />
            </button>
          </div>
          <div className="absolute right-4 top-4 flex items-center gap-2">
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
                  className="flex items-center gap-1.5 rounded-full bg-brand-primary/60 px-3 py-1.5 text-xs font-medium text-brand-background backdrop-blur-sm transition-colors hover:bg-brand-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/60 disabled:opacity-50"
                >
                  <i className={uploadingCover ? 'ri-loader-4-line animate-spin text-sm' : 'ri-camera-line text-sm'} />
                  {uploadingCover ? 'Uploading…' : 'Cover photo'}
                </button>
                {!user?.emailVerified && (
                  <button
                    type="button"
                    onClick={resendVerificationEmail}
                    disabled={verificationBusy}
                    className="flex items-center gap-1.5 rounded-full bg-brand-accent2 px-3 py-1.5 text-xs font-semibold text-brand-ink shadow-sm transition-colors hover:bg-brand-accent2/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/60 disabled:opacity-60"
                  >
                    <i className={verificationBusy ? 'ri-loader-4-line animate-spin text-sm' : 'ri-mail-check-line text-sm'} />
                    {verificationBusy ? 'Sending...' : 'Verify email'}
                  </button>
                )}
                <Link
                  href="/settings"
                  className="flex items-center gap-1.5 rounded-full bg-brand-primary/60 px-3 py-1.5 text-xs font-medium text-brand-background backdrop-blur-sm transition-colors hover:bg-brand-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/60"
                >
                  <i className="ri-edit-line text-sm" />
                  Edit profile
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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-brand-background">{displayName}</h1>
            {profile.status && (
              <Badge className="bg-brand-accent3/20 text-brand-accent3">
                {profile.status}
              </Badge>
            )}
          </div>
          {profile.username && (
            <p className="text-sm text-brand-background/50">@{profile.username}</p>
          )}
        </div>

        {/* Bio - thought bubble */}
        {profile.bio && (
          <div className="relative mb-3">
            <div className="relative rounded-2xl border border-brand-background/10 bg-brand-background/[0.06] px-4 py-2.5">
              <p className="text-sm italic leading-relaxed text-brand-background/75">&ldquo;{profile.bio}&rdquo;</p>
            </div>
            <div className="absolute -bottom-1.5 left-5 h-3 w-3 rounded-full border border-brand-background/10 bg-brand-background/[0.06]" />
            <div className="absolute -bottom-3.5 left-3 h-1.5 w-1.5 rounded-full border border-brand-background/10 bg-brand-background/[0.06]" />
          </div>
        )}

        {/* Location & Pronouns */}
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-brand-background/50">
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
          {toDate(profile.created_at) && (
            <span className="flex items-center gap-1">
              <i className="ri-calendar-line" /> Joined{' '}
              {toDate(profile.created_at)!.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>

        {/* Conditions Badges */}
        {visibleConditions.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {visibleConditions.map((condition, idx) => {
              const slug = condition
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
              return (
                <Link
                  key={condition}
                  href={`/conditions/${slug}`}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 ${conditionColors[idx % conditionColors.length]}`}
                  title={`See what helps with ${condition}`}
                >
                  {condition}
                </Link>
              )
            })}
          </div>
        )}

        {/* Stats Row */}
        <div className="mb-5 flex items-center gap-6">
          <div className="text-center">
            <p className="text-lg font-bold text-brand-background">{groups.length}</p>
            <p className="text-xs text-brand-background/45">Groups</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-brand-background">{posts.length}</p>
            <p className="text-xs text-brand-background/45">Posts</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-brand-background">{profile.interests?.length ?? 0}</p>
            <p className="text-xs text-brand-background/45">Interests</p>
          </div>
          <Link href="/strands" className="text-center transition-opacity hover:opacity-80">
            <p className="text-lg font-bold text-brand-background">{strandCount}</p>
            <p className="text-xs text-brand-background/45">Strands</p>
          </Link>
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
              <Button
                variant="secondary"
                onClick={() => router.push(`/messages?to=${userId}`)}
                className="flex-1"
                leadingIcon={<i className="ri-mail-line" />}
              >
                Message
              </Button>
              <Button
                variant={following ? 'ghost' : 'secondary'}
                onClick={toggleFollow}
                disabled={followBusy}
                className="flex-1"
                leadingIcon={<i className={following ? 'ri-eye-fill' : 'ri-eye-line'} />}
              >
                {following ? 'Following' : 'Keep an eye on'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setActiveTab('groups')}
                className="flex-1"
                leadingIcon={<i className="ri-group-line" />}
              >
                See groups
              </Button>
              <Button
                variant="ghost"
                onClick={toggleBlock}
                disabled={blockBusy}
                className="flex-1"
                leadingIcon={<i className={blocked ? 'ri-user-follow-line' : 'ri-forbid-2-line'} />}
              >
                {blocked ? 'Unblock' : 'Block'}
              </Button>
              <ReportDialog
                targetType="user"
                targetId={userId}
                targetOwnerId={userId}
                className="flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-brand-background/70 transition-colors hover:bg-brand-accent1/10 hover:text-brand-accent1"
              />
            </div>
            {blocked && (
              <p className="text-xs text-brand-crisis/80">
                You&rsquo;ve blocked this person. You won&rsquo;t see their posts and they can&rsquo;t message you.
              </p>
            )}
            <p className="text-xs text-brand-background/45">
              {connectionState === 'received'
                ? '🧬 They sent you a strand. Accept to connect.'
                : connectionState === 'sent'
                  ? 'Strand pending - tap to withdraw.'
                  : connectionState === 'accepted'
                    ? '🧬 You are stranded with this member.'
                    : 'A strand is how KinSpace friends say hi - no algorithms, just you reaching out.'}
            </p>
          </div>
        )}

        {!isOwnProfile && !user && (
          <div className="mb-5 flex gap-3">
            <LinkButton href="/login" className="flex-1" leadingIcon={<i className="ri-login-circle-line" />}>
              Sign in to connect
            </LinkButton>
            <Button
              variant="secondary"
              onClick={() => setActiveTab('groups')}
              className="flex-1"
              leadingIcon={<i className="ri-group-line" />}
            >
              See groups
            </Button>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-5 flex rounded-full border border-brand-background/10 bg-brand-background/5 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              aria-pressed={activeTab === tab.key}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 ${
                activeTab === tab.key
                  ? 'bg-brand-background/20 font-semibold text-brand-background shadow-sm'
                  : 'text-brand-background/60 hover:text-brand-background/90'
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
            {profile.restricted === true && !isOwnProfile && (
              <Card>
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <i className="ri-lock-2-line text-2xl text-brand-background/40" aria-hidden="true" />
                  <p className="text-sm font-semibold text-brand-background">This profile is private</p>
                  <p className="max-w-sm text-xs text-brand-background/55">
                    {profile.username || 'This member'} keeps their profile to themselves. You can still see their
                    posts and comments around the community.
                  </p>
                </div>
              </Card>
            )}
            {achievements && profile.restricted !== true && (
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-background">
                    <i className="ri-medal-line text-brand-accent3" aria-hidden="true" /> Achievements
                  </h3>
                  <div className="flex items-center gap-2">
                    {achievements.checkin_streak > 0 && (
                      <Badge className="bg-brand-accent2/15 text-brand-accent2">
                        <i className="ri-fire-line" aria-hidden="true" /> {achievements.checkin_streak}-day streak
                      </Badge>
                    )}
                    <Badge className="bg-brand-accent3/15 text-brand-accent3">
                      Lv {achievements.level} · {achievements.level_title}
                    </Badge>
                  </div>
                </div>

                {achievements.is_owner && achievements.next_level_points && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-brand-background/55">
                      <span>{achievements.points} pts</span>
                      <span>{achievements.next_level_points} to next level</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-background/10">
                      <div
                        className="h-full rounded-full bg-brand-accent3"
                        style={{
                          width: `${Math.round(
                            ((achievements.points - achievements.level_floor) /
                              Math.max(1, achievements.next_level_points - achievements.level_floor)) *
                              100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {achievements.badges.map((badge) => (
                    <div
                      key={badge.id}
                      title={badge.description}
                      className={`rounded-xl border p-2.5 text-center ${
                        badge.earned
                          ? tierStyles[badge.tier]
                          : 'border-brand-background/10 bg-brand-background/[0.03] text-brand-background/35'
                      }`}
                    >
                      <i className={`${badge.icon} text-lg ${badge.earned ? '' : 'opacity-50'}`} aria-hidden="true" />
                      <p className="mt-1 text-[11px] font-semibold leading-tight">{badge.name}</p>
                      {!badge.earned && badge.goal > 1 && (
                        <p className="mt-0.5 text-[10px] opacity-70">
                          {badge.current}/{badge.goal}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-brand-background/40">
                  {achievements.earned_count} of {achievements.total_count} earned · badges reward care and showing up,
                  never popularity.
                </p>
              </Card>
            )}

            {/* Create Post (own profile only) */}
            {isOwnProfile && (
              <Card>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-background">
                  <i className="ri-quill-pen-line text-brand-accent2" /> Share an update
                </h3>
                <Textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  rows={3}
                  aria-label="Write a post"
                  placeholder="What's on your mind today?"
                  className="resize-none"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-brand-background/45">Posts appear in Community and on your Activity tab.</p>
                  <Button
                    onClick={handleCreatePost}
                    disabled={posting || !newPostContent.trim()}
                    size="sm"
                  >
                    {posting ? 'Posting…' : 'Post'}
                  </Button>
                </div>
              </Card>
            )}

            {/* Crowd-source actions (own profile only) */}
            {isOwnProfile && (
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/groups?create=1"
                  className="flex flex-col items-center gap-2 rounded-2xl border border-brand-background/10 bg-brand-background/[0.08] py-4 text-center backdrop-blur-sm transition-colors hover:bg-brand-background/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent2/15">
                    <i className="ri-group-line text-lg text-brand-accent2" />
                  </div>
                  <span className="text-xs font-semibold text-brand-background">Create a group</span>
                </Link>
                <Link
                  href="/resources?submit=1"
                  className="flex flex-col items-center gap-2 rounded-2xl border border-brand-background/10 bg-brand-background/[0.08] py-4 text-center backdrop-blur-sm transition-colors hover:bg-brand-background/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent3/15">
                    <i className="ri-book-open-line text-lg text-brand-accent3" />
                  </div>
                  <span className="text-xs font-semibold text-brand-background">Add a resource</span>
                </Link>
              </div>
            )}

            {/* About - only the owner sees this nudge when bio is empty */}
            {!profile.bio && isOwnProfile && (
              <Card>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-background">
                  <i className="ri-information-line text-brand-accent2" /> About you
                </h3>
                <p className="text-sm text-brand-background/60">
                  Add a short bio so the community gets a sense of who you are. A sentence or two is plenty.
                </p>
                <LinkButton href="/settings" size="sm" className="mt-3" leadingIcon={<i className="ri-edit-line" />}>
                  Write your bio
                </LinkButton>
              </Card>
            )}

            {/* Conditions */}
            {visibleConditions.length > 0 && (
              <Card>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-background">
                  <i className="ri-heart-pulse-line text-brand-accent1" /> {isOwnProfile ? 'What you’re living with' : 'What they’re living with'}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {visibleConditions.map((condition, idx) => (
                    <span
                      key={condition}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${conditionColors[idx % conditionColors.length]}`}
                    >
                      {condition}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Recent Activity Preview */}
            {posts.length > 0 && (
              <Card>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-background">
                  <i className="ri-time-line text-brand-accent3" /> Recent activity
                </h3>
                <div className="space-y-3">
                  {posts.slice(0, 3).map((post) => (
                    <div key={post.id} className="border-b border-brand-background/5 py-2 last:border-0">
                      <p className="line-clamp-2 text-sm text-brand-background/70">{post.content}</p>
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-brand-background/45">
                        <span><i className="ri-heart-line mr-1" />{post.likes_count || 0}</span>
                        <span><i className="ri-chat-1-line mr-1" />{post.comments_count || 0}</span>
                        {post.created_at?.seconds && (
                          <span className="ml-auto">{timeAgo(post.created_at.seconds)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Interests */}
            {profile.interests && profile.interests.length > 0 && (
              <Card>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-background">
                  <i className="ri-star-line text-brand-accent2" /> Interests
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((interest) => (
                    <Badge key={interest} className="bg-brand-background/10 text-brand-background/70">
                      {interest}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}
            {gameScores.length > 0 && profile.restricted !== true && (
              <Card>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-background">
                  <i className="ri-gamepad-line text-brand-accent3" /> Game scores
                </h3>
                <div className="space-y-2">
                  {gameScores.map((score) => (
                    <div
                      key={score.game_key}
                      className="flex items-center justify-between gap-3 rounded-xl bg-brand-background/[0.04] px-3 py-2"
                    >
                      <span className="text-sm font-medium text-brand-background">{gameLabel(score.game_key)}</span>
                      <span className="flex items-center gap-3 text-xs text-brand-background/55">
                        <span className="font-bold text-brand-background">{score.best.toLocaleString()}</span>
                        <span>
                          {score.plays} play{score.plays === 1 ? '' : 's'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'groups' && (
          <div className="space-y-3">
            {groups.length > 0 ? (
              groups.map((group) => (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-brand-background/10 bg-brand-background/[0.08] p-4 backdrop-blur-sm transition-colors hover:bg-brand-background/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-accent1/20">
                    <i className={`${group.icon || 'ri-group-line'} text-lg text-brand-accent1`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-background">{group.name || 'Group'}</p>
                    <p className="text-xs text-brand-background/45">{group.members_count || 0} members</p>
                  </div>
                  <i className="ri-arrow-right-s-line text-brand-background/30" />
                </Link>
              ))
            ) : (
              <EmptyState
                icon={<i className="ri-group-line text-4xl" />}
                title={isOwnProfile ? 'No groups yet' : 'Not in any groups yet'}
                description={isOwnProfile ? 'Groups are a gentler way to find your people. Join one when you feel ready.' : 'When they join groups, you’ll see them here.'}
                action={isOwnProfile ? <LinkButton href="/groups" size="sm" leadingIcon={<i className="ri-compass-3-line" />}>Explore groups</LinkButton> : undefined}
              />
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-3">
            {posts.length > 0 ? (
              posts.map((post) => (
                <Card key={post.id} variant="light">
                  <div className="mb-2 flex items-center gap-2">
                    <ProfileAvatar
                      alt={displayName}
                      avatarUrl={profile.avatar_url}
                      className="h-7 w-7 rounded-full object-cover"
                      fullName={profile.full_name}
                      userId={profile.id}
                      username={profile.username}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-brand-background">{displayName}</p>
                      <p className="text-xs text-brand-background/45">
                        {post.created_at?.seconds ? timeAgo(post.created_at.seconds) : 'recently'}
                      </p>
                    </div>
                    {post.type && <Badge>{post.type}</Badge>}
                  </div>
                  <p className="text-sm text-brand-background/80">{post.content}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-brand-background/45">
                    <span className="flex items-center gap-1">
                      <i className="ri-heart-line" /> {post.likes_count || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="ri-chat-1-line" /> {post.comments_count || 0}
                    </span>
                  </div>
                </Card>
              ))
            ) : (
              <EmptyState
                icon={<i className="ri-chat-smile-3-line text-4xl" />}
                title={isOwnProfile ? 'Nothing here yet' : 'No activity yet'}
                description={isOwnProfile ? 'Anything you post will show up here. Share whenever you’re ready - no pressure.' : 'When they share something, you’ll see it here.'}
                action={isOwnProfile ? <Button size="sm" onClick={() => setActiveTab('overview')} leadingIcon={<i className="ri-quill-pen-line" />}>Write your first post</Button> : undefined}
              />
            )}
          </div>
        )}
        </div>
      </div>

      <BottomNav />
    </main>
  )
}
