'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import ProfileAvatar from '@/components/ProfileAvatar'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { StorageService, detectMediaType } from '@/lib/storage'
import { formatCompactNumber, formatRelativeTime } from '@/lib/platform'
import { getTopReactions, isEmoji, applyReactionMutation } from '@/lib/social'

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
  const { push: toast } = useToast()

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
  const [userReactions, setUserReactions] = useState<Set<string>>(new Set())
  const [emojiInputPostId, setEmojiInputPostId] = useState<string | null>(null)
  const emojiInputRef = useRef<HTMLInputElement>(null)

  // Media attachments for new post
  const [pendingMedia, setPendingMedia] = useState<Array<{ file: File; preview: string; type: 'image' | 'video' | 'audio' }>>([])
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Editing
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  // Rekindle
  const [rekindlingPostId, setRekindlingPostId] = useState<string | null>(null)
  const [rekindleComment, setRekindleComment] = useState('')
  const [rekindling, setRekindling] = useState(false)

  // Comments
  type CommentEntry = Record<string, unknown> & { id: string; profile: Record<string, unknown> | null }
  const [openCommentsFor, setOpenCommentsFor] = useState<Set<string>>(new Set())
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommentEntry[]>>({})
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null)
  const [loadingCommentsFor, setLoadingCommentsFor] = useState<Set<string>>(new Set())

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
        const [profileData, communityPosts, likedIds, reactionKeys, availableAngels, availableMentors, upcomingActivities] = await Promise.all([
          DatabaseService.getProfile(user.userId),
          DatabaseService.getCommunityPosts(24),
          DatabaseService.getUserLikedPostIds(user.userId),
          DatabaseService.getUserPostReactions(user.userId),
          DatabaseService.getAvailableAngels(user.userId),
          DatabaseService.getMentors(),
          DatabaseService.getCommunityActivities(10),
        ])

        setProfile(profileData as Record<string, unknown> | null)
        setPosts(communityPosts as Post[])
        setLikedPostIds(likedIds)
        setUserReactions(reactionKeys)
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

  const [postSearch, setPostSearch] = useState('')
  const filteredPosts = useMemo(() => {
    if (!postSearch.trim()) return posts
    const needle = postSearch.trim().toLowerCase()
    return posts.filter((post) => {
      const content = String(post.content ?? '').toLowerCase()
      const tags = (post.tags as string[] | undefined)?.join(' ').toLowerCase() ?? ''
      const profileName = String(
        (post.profile as Record<string, unknown> | null)?.full_name ??
          (post.profile as Record<string, unknown> | null)?.username ??
          '',
      ).toLowerCase()
      return content.includes(needle) || tags.includes(needle) || profileName.includes(needle)
    })
  }, [posts, postSearch])
  const featuredPosts = useMemo(() => filteredPosts.slice(0, 24), [filteredPosts])

  async function handleCreatePost() {
    if (!user || (!newPostContent.trim() && pendingMedia.length === 0)) return

    setPosting(true)
    try {
      // Upload media files
      const uploadedMedia: Array<{ url: string; type: 'image' | 'video' | 'audio' }> = []
      for (const item of pendingMedia) {
        const { url, mediaType } = await StorageService.uploadPostMedia(user.userId, item.file)
        uploadedMedia.push({ url, type: mediaType })
      }

      await DatabaseService.createPost(
        user.userId,
        newPostContent.trim(),
        'discussion',
        [],
        Boolean(profile?.is_anonymous),
        uploadedMedia.length > 0 ? uploadedMedia : undefined,
      )
      const refreshedPosts = await DatabaseService.getCommunityPosts(24)
      setPosts(refreshedPosts as Post[])
      setNewPostContent('')
      // Clean up previews
      pendingMedia.forEach((item) => URL.revokeObjectURL(item.preview))
      setPendingMedia([])
      toast('Post shared with the community', 'success')
    } catch (error) {
      console.error('Failed to create post:', error)
      toast('Could not share post, please try again', 'error')
    } finally {
      setPosting(false)
    }
  }

  function handleMediaSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files) return

    const newItems: typeof pendingMedia = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const mt = detectMediaType(file.type)
      if (!mt) continue
      const validation = StorageService.validatePostMedia(file)
      if (!validation.valid) continue
      newItems.push({ file, preview: URL.createObjectURL(file), type: mt })
    }
    setPendingMedia((prev) => [...prev, ...newItems])
    if (mediaInputRef.current) mediaInputRef.current.value = ''
  }

  function removePendingMedia(index: number) {
    setPendingMedia((prev) => {
      const next = [...prev]
      URL.revokeObjectURL(next[index].preview)
      next.splice(index, 1)
      return next
    })
  }

  const toggleVoiceRecording = useCallback(async () => {
    if (recording) {
      mediaRecorderRef.current?.stop()
      setRecording(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' })
        setPendingMedia((prev) => [...prev, { file, preview: URL.createObjectURL(blob), type: 'audio' }])
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      console.error('Microphone access denied')
    }
  }, [recording])

  async function handleEditPost(postId: string) {
    if (!user || !editContent.trim()) return
    setSaving(true)
    try {
      await DatabaseService.updatePost(postId, user.userId, { content: editContent.trim() })
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, content: editContent.trim(), edited: true } : p))
      setEditingPostId(null)
      setEditContent('')
      toast('Post updated', 'success')
    } catch (error) {
      console.error('Failed to edit post:', error)
      toast('Could not save edit', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleComments(postId: string) {
    const isOpen = openCommentsFor.has(postId)
    setOpenCommentsFor((current) => {
      const next = new Set(current)
      if (isOpen) next.delete(postId)
      else next.add(postId)
      return next
    })
    if (!isOpen && !commentsByPost[postId]) {
      setLoadingCommentsFor((current) => new Set(current).add(postId))
      try {
        const grouped = await DatabaseService.getCommentsForPosts([postId], 50)
        setCommentsByPost((current) => ({
          ...current,
          [postId]: (grouped.get(postId) as CommentEntry[] | undefined) ?? [],
        }))
      } catch (error) {
        console.error('Failed to load comments:', error)
      } finally {
        setLoadingCommentsFor((current) => {
          const next = new Set(current)
          next.delete(postId)
          return next
        })
      }
    }
  }

  async function submitComment(postId: string) {
    if (!user) return
    const draft = (commentDrafts[postId] ?? '').trim()
    if (!draft) return
    setCommentingPostId(postId)
    try {
      await DatabaseService.addPostComment(postId, user.userId, draft, Boolean(profile?.is_anonymous))
      // refresh comments for this post
      const grouped = await DatabaseService.getCommentsForPosts([postId], 50)
      setCommentsByPost((current) => ({
        ...current,
        [postId]: (grouped.get(postId) as CommentEntry[] | undefined) ?? [],
      }))
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, comments_count: ((post.comments_count as number | undefined) ?? 0) + 1 }
            : post,
        ),
      )
      setCommentDrafts((current) => ({ ...current, [postId]: '' }))
      setOpenCommentsFor((current) => new Set(current).add(postId))
      toast('Comment added', 'success')
    } catch (error) {
      console.error('Failed to comment:', error)
      toast('Could not add comment', 'error')
    } finally {
      setCommentingPostId(null)
    }
  }

  async function handleRekindle(postId: string) {
    if (!user) return
    setRekindling(true)
    try {
      await DatabaseService.rekindlePost(postId, user.userId, rekindleComment.trim() || undefined)
      const refreshedPosts = await DatabaseService.getCommunityPosts(24)
      setPosts(refreshedPosts as Post[])
      setRekindlingPostId(null)
      setRekindleComment('')
      toast('Rekindled to your circle', 'success')
    } catch (error) {
      console.error('Failed to rekindle:', error)
      toast('Rekindle failed', 'error')
    } finally {
      setRekindling(false)
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

  async function handleEmojiReaction(postId: string, emoji: string) {
    if (!user || !isEmoji(emoji)) return

    const key = `${postId}:${emoji}`
    const wasActive = userReactions.has(key)

    setUserReactions((current) => {
      const next = new Set(current)
      if (wasActive) next.delete(key)
      else next.add(key)
      return next
    })

    setPosts((current) =>
      current.map((post) =>
        post.id === postId ? applyReactionMutation(post, emoji, !wasActive) : post,
      ),
    )

    setEmojiInputPostId(null)

    try {
      await DatabaseService.togglePostReaction(postId, user.userId, emoji)
    } catch (error) {
      console.error('Failed to toggle reaction:', error)
    }
  }

  function handleEmojiInput(postId: string, value: string) {
    const emoji = value.trim()
    if (emoji && isEmoji(emoji)) {
      handleEmojiReaction(postId, emoji)
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
      <div className="page-grid overflow-x-hidden">
        <section className="card overflow-hidden">
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

          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex gap-2 overflow-x-auto rounded-2xl bg-[#eedfc8]/5 p-1.5">
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
            {activeTab === 'discussions' && (
              <div className="relative flex-1 md:max-w-sm">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[#eedfc8]/40" />
                <input
                  value={postSearch}
                  onChange={(event) => setPostSearch(event.target.value)}
                  placeholder="Search posts, tags, authors"
                  className="input-field !pl-10"
                />
                {postSearch && (
                  <button
                    onClick={() => setPostSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#eedfc8]/45 hover:text-[#eedfc8]"
                    aria-label="Clear search"
                  >
                    <i className="ri-close-line" />
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {activeTab === 'discussions' && (
          <div className="page-grid lg:grid-cols-[minmax(0,1.2fr)_20rem] lg:items-start overflow-hidden">
            <div className="space-y-4">
              <section className="card">
                <div className="flex items-start gap-3">
                  <ProfileAvatar
                    alt="Your profile"
                    avatarUrl={profile?.avatar_url as string | undefined}
                    className="h-12 w-12 rounded-2xl object-cover"
                    fullName={(profile?.full_name as string | undefined) || user?.displayName || undefined}
                    userId={(profile?.id as string | undefined) || user?.userId}
                    username={profile?.username as string | undefined}
                  />
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
                  rows={3}
                  placeholder="What is on your mind today?"
                  className="input-field mt-4 resize-none"
                />

                {/* Pending media previews */}
                {pendingMedia.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pendingMedia.map((item, idx) => (
                      <div key={idx} className="relative group">
                        {item.type === 'image' && (
                          <img src={item.preview} alt="" className="h-20 w-20 rounded-xl object-cover border border-[#eedfc8]/10" />
                        )}
                        {item.type === 'video' && (
                          <div className="h-20 w-20 rounded-xl border border-[#eedfc8]/10 bg-[#eedfc8]/5 flex items-center justify-center">
                            <i className="ri-video-line text-xl text-[#D19A58]" />
                          </div>
                        )}
                        {item.type === 'audio' && (
                          <div className="h-20 w-20 rounded-xl border border-[#eedfc8]/10 bg-[#eedfc8]/5 flex items-center justify-center">
                            <i className="ri-mic-line text-xl text-[#6B8A83]" />
                          </div>
                        )}
                        <button
                          onClick={() => removePendingMedia(idx)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#B85C3A] text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <i className="ri-close-line" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      ref={mediaInputRef}
                      type="file"
                      accept="image/*,video/*,audio/*"
                      multiple
                      className="hidden"
                      onChange={handleMediaSelect}
                    />
                    <button
                      onClick={() => mediaInputRef.current?.click()}
                      className="flex items-center gap-1 rounded-xl bg-[#eedfc8]/8 px-2.5 py-1.5 text-xs text-[#eedfc8]/60 hover:text-[#D19A58] hover:bg-[#D19A58]/10 transition-colors"
                      title="Attach image or video"
                    >
                      <i className="ri-image-line text-sm" />
                    </button>
                    <button
                      onClick={toggleVoiceRecording}
                      className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs transition-colors ${
                        recording
                          ? 'bg-[#B85C3A]/20 text-[#B85C3A] animate-pulse'
                          : 'bg-[#eedfc8]/8 text-[#eedfc8]/60 hover:text-[#6B8A83] hover:bg-[#6B8A83]/10'
                      }`}
                      title={recording ? 'Stop recording' : 'Record voice'}
                    >
                      <i className={recording ? 'ri-stop-circle-line text-sm' : 'ri-mic-line text-sm'} />
                    </button>
                    <span className="text-[10px] text-[#eedfc8]/30 hidden sm:inline">
                      {profile?.is_anonymous ? 'anonymous' : 'as you'}
                    </span>
                  </div>
                  <button
                    onClick={handleCreatePost}
                    disabled={posting || (!newPostContent.trim() && pendingMedia.length === 0)}
                    className="btn-primary !py-2.5 !px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {posting ? 'Posting...' : 'Post'}
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
                    const isOwner = user && (post.user_id as string) === user.userId
                    const postMedia = (post.media as Array<{ url: string; type: string }> | undefined) || []
                    const rekindleOriginal = post.rekindle_original as Record<string, unknown> | undefined
                    const isEditing = editingPostId === post.id

                    return (
                      <article key={post.id} className="card">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-[#eedfc8]/10 text-sm font-bold text-[#D19A58]">
                            {post.is_anonymous ? (
                              <i className="ri-spy-line text-base" />
                            ) : (
                              <ProfileAvatar
                                alt={author}
                                avatarUrl={post.profile?.avatar_url as string | undefined}
                                className="h-11 w-11 rounded-2xl object-cover"
                                fullName={post.profile?.full_name as string | undefined}
                                userId={post.profile?.id as string | undefined}
                                username={post.profile?.username as string | undefined}
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-semibold text-[#eedfc8]">{author}</p>
                              {post.type === 'rekindle' && (
                                <span className="badge text-[10px] bg-[#D19A58]/15 text-[#D19A58]">
                                  <i className="ri-loop-left-line mr-0.5" /> rekindled
                                </span>
                              )}
                              {typeof post.type === 'string' && post.type !== 'rekindle' && (
                                <span className="badge text-[10px]">{post.type}</span>
                              )}
                              {!!post.edited && (
                                <span className="text-[10px] text-[#eedfc8]/30 italic">edited</span>
                              )}
                            </div>
                            <p className="text-xs text-[#eedfc8]/40">{formatRelativeTime(post.created_at)}</p>
                          </div>
                          {isOwner && !isEditing && (
                            <button
                              onClick={() => { setEditingPostId(post.id); setEditContent(post.content as string || '') }}
                              className="flex h-8 w-8 items-center justify-center rounded-xl text-[#eedfc8]/30 hover:text-[#eedfc8]/60 hover:bg-[#eedfc8]/8 transition-colors"
                              title="Edit post"
                            >
                              <i className="ri-pencil-line text-sm" />
                            </button>
                          )}
                        </div>

                        {/* Post content or edit mode */}
                        {isEditing ? (
                          <div className="mt-3">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              rows={3}
                              className="input-field resize-none w-full"
                            />
                            <div className="mt-2 flex items-center gap-2 justify-end">
                              <button onClick={() => { setEditingPostId(null); setEditContent('') }} className="text-xs text-[#eedfc8]/50 px-3 py-1.5 rounded-xl hover:bg-[#eedfc8]/8">
                                Cancel
                              </button>
                              <button
                                onClick={() => handleEditPost(post.id)}
                                disabled={saving || !editContent.trim()}
                                className="btn-primary !py-1.5 !px-3 text-xs disabled:opacity-50"
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {(post.content as string)?.trim() && (
                              <p className="mt-4 text-sm leading-relaxed text-[#eedfc8]/75">
                                {post.content as string}
                              </p>
                            )}
                          </>
                        )}

                        {/* Rekindle embed (original post) */}
                        {rekindleOriginal && (
                          <div className="mt-3 rounded-2xl border border-[#eedfc8]/10 bg-[#eedfc8]/4 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <i className="ri-loop-left-line text-xs text-[#D19A58]" />
                              <span className="text-xs font-medium text-[#eedfc8]/60">
                                {rekindleOriginal.author_name as string || 'Someone'}
                              </span>
                            </div>
                            {(rekindleOriginal.content as string)?.trim() && (
                              <p className="text-sm leading-relaxed text-[#eedfc8]/60">
                                {rekindleOriginal.content as string}
                              </p>
                            )}
                            {/* Original post media */}
                            {Array.isArray(rekindleOriginal.media) && (rekindleOriginal.media as Array<{ url: string; type: string }>).length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(rekindleOriginal.media as Array<{ url: string; type: string }>).map((m, i) => (
                                  <div key={i}>
                                    {m.type === 'image' && (
                                      <img src={m.url} alt="" className="max-h-32 rounded-xl object-cover" />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Post media */}
                        {postMedia.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {postMedia.map((media, idx) => (
                              <div key={idx}>
                                {media.type === 'image' && (
                                  <img
                                    src={media.url}
                                    alt=""
                                    className="w-full max-h-80 rounded-2xl object-cover border border-[#eedfc8]/10"
                                  />
                                )}
                                {media.type === 'video' && (
                                  <video
                                    src={media.url}
                                    controls
                                    className="w-full max-h-80 rounded-2xl border border-[#eedfc8]/10 bg-black"
                                  />
                                )}
                                {media.type === 'audio' && (
                                  <div className="flex items-center gap-3 rounded-2xl border border-[#eedfc8]/10 bg-[#eedfc8]/4 p-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6B8A83]/16">
                                      <i className="ri-mic-line text-lg text-[#6B8A83]" />
                                    </div>
                                    <audio src={media.url} controls className="flex-1 h-8" style={{ minWidth: 0 }} />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Emoji reactions display */}
                        {getTopReactions(post).length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {getTopReactions(post).map(({ emoji, count }) => {
                              const reacted = userReactions.has(`${post.id}:${emoji}`)
                              return (
                                <button
                                  key={emoji}
                                  onClick={() => handleEmojiReaction(post.id, emoji)}
                                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-all ${
                                    reacted
                                      ? 'bg-[#D19A58]/20 border border-[#D19A58]/40'
                                      : 'bg-[#eedfc8]/8 border border-[#eedfc8]/10 hover:bg-[#eedfc8]/14'
                                  }`}
                                >
                                  <span className="text-sm">{emoji}</span>
                                  <span className={reacted ? 'text-[#D19A58] font-semibold' : 'text-[#eedfc8]/60'}>
                                    {count}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        )}

                        {/* Rekindle modal inline */}
                        {rekindlingPostId === post.id && (
                          <div className="mt-3 rounded-2xl border border-[#D19A58]/20 bg-[#D19A58]/5 p-3">
                            <p className="text-xs font-semibold text-[#D19A58] mb-2">
                              <i className="ri-loop-left-line mr-1" /> Rekindle this post
                            </p>
                            <textarea
                              value={rekindleComment}
                              onChange={(e) => setRekindleComment(e.target.value)}
                              rows={2}
                              placeholder="Add a thought (optional)..."
                              className="input-field resize-none w-full text-xs"
                            />
                            <div className="mt-2 flex items-center gap-2 justify-end">
                              <button onClick={() => { setRekindlingPostId(null); setRekindleComment('') }} className="text-xs text-[#eedfc8]/50 px-3 py-1.5 rounded-xl hover:bg-[#eedfc8]/8">
                                Cancel
                              </button>
                              <button
                                onClick={() => handleRekindle(post.id)}
                                disabled={rekindling}
                                className="btn-primary !py-1.5 !px-3 text-xs disabled:opacity-50"
                              >
                                {rekindling ? 'Rekindling...' : 'Rekindle'}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="mt-3 flex items-center gap-3 border-t border-[#eedfc8]/8 pt-3 text-sm">
                          <button
                            onClick={() => handleToggleLike(post.id)}
                            className={`flex items-center gap-1.5 transition-colors ${
                              liked ? 'text-[#B85C3A]' : 'text-[#eedfc8]/45'
                            }`}
                          >
                            <i className={liked ? 'ri-heart-fill' : 'ri-heart-line'} />
                            {formatCompactNumber(post.likes_count as number | undefined)}
                          </button>
                          <button
                            onClick={() => toggleComments(post.id)}
                            className={`flex items-center gap-1.5 transition-colors ${
                              openCommentsFor.has(post.id) ? 'text-[#D19A58]' : 'text-[#eedfc8]/45 hover:text-[#D19A58]'
                            }`}
                            title="Comments"
                          >
                            <i className="ri-chat-1-line" />
                            {formatCompactNumber(post.comments_count as number | undefined)}
                          </button>

                          {/* Rekindle button */}
                          <button
                            onClick={() => setRekindlingPostId(rekindlingPostId === post.id ? null : post.id)}
                            className={`flex items-center gap-1.5 transition-colors ${
                              rekindlingPostId === post.id ? 'text-[#D19A58]' : 'text-[#eedfc8]/45 hover:text-[#D19A58]'
                            }`}
                            title="Rekindle"
                          >
                            <i className="ri-loop-left-line" />
                            {formatCompactNumber(post.rekindle_count as number | undefined)}
                          </button>

                          {/* Emoji react button */}
                          <div className="relative ml-auto">
                            {emojiInputPostId === post.id ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  ref={emojiInputRef}
                                  type="text"
                                  inputMode="text"
                                  autoFocus
                                  className="w-12 rounded-full bg-[#eedfc8]/10 border border-[#eedfc8]/20 px-2 py-1 text-center text-base text-[#eedfc8] outline-none focus:border-[#D19A58]/50"
                                  placeholder="?"
                                  onInput={(e) => {
                                    const val = (e.target as HTMLInputElement).value
                                    if (val) handleEmojiInput(post.id, val)
                                  }}
                                  onBlur={() => setTimeout(() => setEmojiInputPostId(null), 200)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') setEmojiInputPostId(null)
                                  }}
                                />
                                <button
                                  onClick={() => setEmojiInputPostId(null)}
                                  className="text-[#eedfc8]/40 text-xs"
                                >
                                  <i className="ri-close-line" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEmojiInputPostId(post.id)
                                  setTimeout(() => emojiInputRef.current?.focus(), 50)
                                }}
                                className="flex items-center gap-1.5 text-[#eedfc8]/45 hover:text-[#D19A58] transition-colors"
                                title="React with emoji"
                              >
                                <i className="ri-emotion-happy-line" />
                              </button>
                            )}
                          </div>
                        </div>

                        {openCommentsFor.has(post.id) && (
                          <div className="mt-3 space-y-3 border-t border-[#eedfc8]/8 pt-3">
                            {loadingCommentsFor.has(post.id) ? (
                              <p className="text-xs text-[#eedfc8]/45">Loading comments…</p>
                            ) : (commentsByPost[post.id] ?? []).length === 0 ? (
                              <p className="text-xs text-[#eedfc8]/45">Be the first to reply.</p>
                            ) : (
                              <ul className="space-y-3">
                                {(commentsByPost[post.id] ?? []).map((comment) => {
                                  const authorProfile = comment.profile
                                  const commentAuthorName = comment.is_anonymous
                                    ? 'Anonymous'
                                    : ((authorProfile?.full_name as string | undefined) ||
                                        (authorProfile?.username as string | undefined) ||
                                        'Community member')
                                  return (
                                    <li key={comment.id} className="flex gap-3">
                                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#6B8A83]/25 text-xs font-bold text-[#6B8A83]">
                                        {comment.is_anonymous ? (
                                          <i className="ri-spy-line text-sm" />
                                        ) : (
                                          <ProfileAvatar
                                            alt={commentAuthorName}
                                            avatarUrl={authorProfile?.avatar_url as string | undefined}
                                            className="h-8 w-8 rounded-full object-cover"
                                            fullName={authorProfile?.full_name as string | undefined}
                                            userId={authorProfile?.id as string | undefined}
                                            username={authorProfile?.username as string | undefined}
                                          />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1 rounded-2xl bg-[#eedfc8]/6 px-3 py-2">
                                        <div className="flex items-center gap-2 text-xs text-[#eedfc8]/50">
                                          <span className="font-semibold text-[#eedfc8]/80">{commentAuthorName}</span>
                                          <span>·</span>
                                          <span>{formatRelativeTime(comment.created_at)}</span>
                                        </div>
                                        <p className="mt-1 whitespace-pre-wrap text-sm text-[#eedfc8]/80">
                                          {comment.content as string}
                                        </p>
                                      </div>
                                    </li>
                                  )
                                })}
                              </ul>
                            )}

                            <div className="flex items-start gap-2">
                              <textarea
                                value={commentDrafts[post.id] ?? ''}
                                onChange={(event) =>
                                  setCommentDrafts((current) => ({
                                    ...current,
                                    [post.id]: event.target.value,
                                  }))
                                }
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault()
                                    void submitComment(post.id)
                                  }
                                }}
                                placeholder="Write a supportive reply…"
                                rows={1}
                                className="input-field flex-1 !py-2 text-sm"
                              />
                              <button
                                onClick={() => void submitComment(post.id)}
                                disabled={commentingPostId === post.id || !(commentDrafts[post.id] ?? '').trim()}
                                className="btn-primary !rounded-2xl !px-4 !py-2 text-sm disabled:opacity-50"
                              >
                                {commentingPostId === post.id ? 'Sending…' : 'Reply'}
                              </button>
                            </div>
                          </div>
                        )}
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
                      <ProfileAvatar
                        alt={name}
                        avatarUrl={profileData.avatar_url as string | undefined}
                        className="h-12 w-12 rounded-2xl object-cover"
                        fullName={profileData.full_name as string | undefined}
                        userId={profileData.id as string | undefined}
                        username={profileData.username as string | undefined}
                      />
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
                      <ProfileAvatar
                        alt={name}
                        avatarUrl={profileData.avatar_url as string | undefined}
                        className="h-12 w-12 rounded-2xl object-cover"
                        fullName={profileData.full_name as string | undefined}
                        userId={profileData.id as string | undefined}
                        username={profileData.username as string | undefined}
                      />
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
