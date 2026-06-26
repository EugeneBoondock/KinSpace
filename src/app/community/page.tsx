'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import ProfileAvatar from '@/components/ProfileAvatar'
import ReportDialog from '@/components/ReportDialog'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { StorageService, detectMediaType } from '@/lib/storage'
import { formatCompactNumber, formatRelativeTime } from '@/lib/platform'
import { getTopReactions, isEmoji, applyReactionMutation } from '@/lib/social'
import { Card, Button, LinkButton, Textarea, Input, Badge, Skeleton, EmptyState } from '@/components/ui'
import { cn } from '@/lib/cn'
import { renderWithMentions } from '@/components/community/renderMentions'
import CommentReactions from '@/components/community/CommentReactions'
import ReactionSummaryButton from '@/components/community/ReactionSummaryButton'
import { MemberAvatar, MemberName } from '@/components/MemberIdentity'

type Tab = 'discussions' | 'angels' | 'mentors' | 'activities'

type Post = Record<string, unknown> & {
  id: string
  profile?: Record<string, unknown> | null
}

type PollDto = {
  id: string
  question: string
  allow_multiple: boolean
  total_votes: number
  closed: boolean
  options: Array<{ id: string; label: string; votes_count: number }>
  my_option_ids: string[]
}

type ReplyQueueItem = {
  id: string
  content: string
  type?: string
  created_at?: string
  createdAt?: string
  comments_count?: number
  commentsCount?: number
  urgency?: string
  reasons?: string[]
  author?: {
    id?: string
    user_id?: string
    userId?: string
    username?: string | null
    full_name?: string | null
    fullName?: string | null
    is_anonymous?: boolean
    isAnonymous?: boolean
    avatar_url?: string | null
    avatarUrl?: string | null
  } | null
  group?: { id: string; name: string } | null
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
  const [replyQueue, setReplyQueue] = useState<ReplyQueueItem[]>([])
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set())
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set())
  // Per-user pins: these post ids float to the top of THIS viewer's feed only.
  const [pinnedPostIds, setPinnedPostIds] = useState<Set<string>>(new Set())
  const [pinningPostId, setPinningPostId] = useState<string | null>(null)
  const [pollsByPost, setPollsByPost] = useState<Record<string, PollDto>>({})
  const [pollMode, setPollMode] = useState(false)
  const [pollDraftOptions, setPollDraftOptions] = useState<string[]>(['', ''])
  const [pollMultiple, setPollMultiple] = useState(false)
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

  // Become an angel / mentor / host an activity
  const [creator, setCreator] = useState<null | 'angel' | 'mentor' | 'activity'>(null)
  const [creatorSubmitting, setCreatorSubmitting] = useState(false)
  const [creatorForm, setCreatorForm] = useState<Record<string, string>>({})
  const setField = (key: string, value: string) => setCreatorForm((prev) => ({ ...prev, [key]: value }))
  const closeCreator = () => {
    setCreator(null)
    setCreatorForm({})
  }

  async function handleBecomeAngel() {
    if (!user) return
    setCreatorSubmitting(true)
    try {
      await DatabaseService.becomeAngel(user.userId, {
        specialty: String(creatorForm.specialty ?? ''),
        supportStyle: String(creatorForm.supportStyle ?? ''),
        bio: String(creatorForm.bio ?? ''),
        maxSouls: Number(creatorForm.maxSouls) || 3,
      })
      setAngels((await DatabaseService.getAvailableAngels(user.userId)) as Record<string, unknown>[])
      closeCreator()
      toast("You’re now listed as an angel - thank you 💚", 'success')
    } catch (error) {
      console.error('becomeAngel failed:', error)
      toast('Could not save - please try again', 'error')
    } finally {
      setCreatorSubmitting(false)
    }
  }

  async function handleBecomeMentor() {
    if (!user) return
    setCreatorSubmitting(true)
    try {
      await DatabaseService.becomeMentor(user.userId, {
        expertise: String(creatorForm.expertise ?? '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        bio: String(creatorForm.bio ?? ''),
        experienceYears: Number(creatorForm.experienceYears) || 0,
      })
      setMentors((await DatabaseService.getMentors()) as Record<string, unknown>[])
      closeCreator()
      toast("You’re now listed as a mentor", 'success')
    } catch (error) {
      console.error('becomeMentor failed:', error)
      toast('Could not save - please try again', 'error')
    } finally {
      setCreatorSubmitting(false)
    }
  }

  async function handleCreateActivity() {
    if (!user) return
    const title = String(creatorForm.title ?? '').trim()
    if (!title) {
      toast('Give your activity a title', 'error')
      return
    }
    setCreatorSubmitting(true)
    try {
      await DatabaseService.createActivity(user.userId, {
        title,
        description: String(creatorForm.description ?? ''),
        activityType: String(creatorForm.activityType ?? ''),
        isVirtual: creatorForm.isVirtual === 'virtual',
        location: String(creatorForm.location ?? ''),
        scheduledAt: creatorForm.scheduledAt ? String(creatorForm.scheduledAt) : null,
        maxParticipants: creatorForm.maxParticipants ? Number(creatorForm.maxParticipants) : null,
      })
      setActivities((await DatabaseService.getCommunityActivities(10)) as Record<string, unknown>[])
      closeCreator()
      toast('Activity scheduled', 'success')
    } catch (error) {
      console.error('createActivity failed:', error)
      toast('Could not create activity - please try again', 'error')
    } finally {
      setCreatorSubmitting(false)
    }
  }

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
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null)
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
        const [
          profileData,
          communityPosts,
          likedIds,
          reactionKeys,
          savedIds,
          pinnedIds,
          availableAngels,
          availableMentors,
          upcomingActivities,
          replyQueueItems,
        ] = await Promise.all([
          DatabaseService.getProfile(user.userId),
          DatabaseService.getCommunityPosts(24),
          DatabaseService.getUserLikedPostIds(user.userId),
          DatabaseService.getUserPostReactions(user.userId),
          DatabaseService.getBookmarkedPostIds(),
          DatabaseService.getMyPinnedPostIds(),
          DatabaseService.getAvailableAngels(user.userId),
          DatabaseService.getMentors(),
          DatabaseService.getCommunityActivities(10),
          DatabaseService.getCommunityReplyQueue(user.userId, { limit: 4 }),
        ])

        setProfile(profileData as Record<string, unknown> | null)
        setPosts(communityPosts as Post[])
        setLikedPostIds(new Set(likedIds as string[]))
        setSavedPostIds(new Set(savedIds as string[]))
        setPinnedPostIds(new Set(pinnedIds as string[]))
        void loadPollsFor(communityPosts as Post[])
        setUserReactions(new Set(reactionKeys as string[]))
        setAngels(availableAngels as Record<string, unknown>[])
        setMentors(availableMentors as Record<string, unknown>[])
        setActivities(upcomingActivities as Record<string, unknown>[])
        setReplyQueue(replyQueueItems as ReplyQueueItem[])
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
  const featuredPosts = useMemo(() => {
    // Personally-pinned posts float to the very top of the viewer's feed; the
    // rest keep their existing order (sort is stable).
    const ordered = filteredPosts
      .slice()
      .sort((a, b) => (pinnedPostIds.has(b.id) ? 1 : 0) - (pinnedPostIds.has(a.id) ? 1 : 0))
    return ordered.slice(0, 36)
  }, [filteredPosts, pinnedPostIds])

  async function refreshReplyQueue() {
    if (!user) return
    try {
      const items = await DatabaseService.getCommunityReplyQueue(user.userId, { limit: 4 })
      setReplyQueue(items as ReplyQueueItem[])
    } catch (error) {
      console.error('Failed to load reply queue:', error)
    }
  }

  async function openReplyTarget(postId: string) {
    if (!user) return
    setActiveTab('discussions')
    setPostSearch('')

    if (!posts.some((post) => post.id === postId)) {
      try {
        const refreshedPosts = await DatabaseService.getCommunityPosts(48)
        setPosts(refreshedPosts as Post[])
        void loadPollsFor(refreshedPosts as Post[])
      } catch (error) {
        console.error('Failed to refresh posts:', error)
      }
    }

    setOpenCommentsFor((current) => new Set(current).add(postId))
    if (!commentsByPost[postId]) {
      setLoadingCommentsFor((current) => new Set(current).add(postId))
      try {
        const grouped = await DatabaseService.getCommentsForPosts([postId], 50)
        setCommentsByPost((current) => ({
          ...current,
          [postId]: ((grouped as Record<string, CommentEntry[]>)[postId]) ?? [],
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

    window.setTimeout(() => {
      document.getElementById(`community-post-${postId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }

  async function loadPollsFor(list: Post[]) {
    const ids = list.filter((post) => (post.type as string | undefined) === 'poll').map((post) => post.id)
    if (ids.length === 0) {
      setPollsByPost({})
      return
    }
    try {
      const map = await DatabaseService.getPollsForPosts(ids)
      setPollsByPost((map ?? {}) as Record<string, PollDto>)
    } catch (error) {
      console.error('Failed to load polls:', error)
    }
  }

  async function handleVote(pollId: string, optionId: string, postId: string) {
    if (!user) return
    const current = pollsByPost[postId]
    if (current?.closed) return
    try {
      const updated = (await DatabaseService.votePoll(pollId, optionId)) as PollDto | null
      if (updated) setPollsByPost((map) => ({ ...map, [postId]: updated }))
    } catch (error) {
      console.error('Failed to vote:', error)
      toast('Could not record your vote', 'error')
    }
  }

  function handleCreatePoll() {
    setPollMode(true)
  }

  async function handleCreatePost() {
    if (!user) return

    // Poll mode: question (the text box) + at least two options.
    if (pollMode) {
      const question = newPostContent.trim()
      const options = pollDraftOptions.map((option) => option.trim()).filter(Boolean)
      if (!question) {
        toast('Add a question for your poll', 'error')
        return
      }
      if (options.length < 2) {
        toast('A poll needs at least two options', 'error')
        return
      }
      setPosting(true)
      try {
        await DatabaseService.createPollPost({
          question,
          options,
          allowMultiple: pollMultiple,
          isAnonymous: Boolean(profile?.is_anonymous),
        })
        const refreshedPosts = await DatabaseService.getCommunityPosts(24)
        setPosts(refreshedPosts as Post[])
        await loadPollsFor(refreshedPosts as Post[])
        await refreshReplyQueue()
        setNewPostContent('')
        setPollDraftOptions(['', ''])
        setPollMultiple(false)
        setPollMode(false)
        toast('Poll posted', 'success')
      } catch (error) {
        console.error('Failed to create poll:', error)
        toast('Could not post your poll', 'error')
      } finally {
        setPosting(false)
      }
      return
    }

    if (!newPostContent.trim() && pendingMedia.length === 0) return

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
      await refreshReplyQueue()
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
          [postId]: ((grouped as Record<string, CommentEntry[]>)[postId]) ?? [],
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
        [postId]: (grouped as Record<string, CommentEntry[]>)[postId] ?? [],
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
      void refreshReplyQueue()
      toast('Comment added', 'success')
    } catch (error) {
      console.error('Failed to comment:', error)
      toast('Could not add comment', 'error')
    } finally {
      setCommentingPostId(null)
    }
  }

  async function submitCommentReply(postId: string, parentId: string) {
    if (!user) return
    const draft = (replyDrafts[parentId] ?? '').trim()
    if (!draft) return
    setReplyingToCommentId(parentId)
    try {
      await DatabaseService.addPostComment(postId, user.userId, draft, Boolean(profile?.is_anonymous), parentId)
      const grouped = await DatabaseService.getCommentsForPosts([postId], 50)
      setCommentsByPost((current) => ({
        ...current,
        [postId]: (grouped as Record<string, CommentEntry[]>)[postId] ?? [],
      }))
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, comments_count: ((post.comments_count as number | undefined) ?? 0) + 1 }
            : post,
        ),
      )
      setReplyDrafts((current) => ({ ...current, [parentId]: '' }))
      setReplyToCommentId(null)
      void refreshReplyQueue()
      toast('Reply added', 'success')
    } catch (error) {
      console.error('Failed to reply:', error)
      toast('Could not add reply', 'error')
    } finally {
      setReplyingToCommentId(null)
    }
  }

  async function handleDeletePost(postId: string) {
    if (!user) return
    if (typeof window !== 'undefined' && !window.confirm('Delete this post? This cannot be undone.')) return
    try {
      await DatabaseService.deletePost(postId, user.userId)
      setPosts((current) => current.filter((post) => post.id !== postId))
      void refreshReplyQueue()
      toast('Post deleted', 'success')
    } catch (error) {
      console.error('Failed to delete post:', error)
      toast('Could not delete post', 'error')
    }
  }

  async function handleRekindle(postId: string) {
    if (!user) return
    setRekindling(true)
    try {
      await DatabaseService.rekindlePost(postId, user.userId, rekindleComment.trim() || undefined)
      const refreshedPosts = await DatabaseService.getCommunityPosts(24)
      setPosts(refreshedPosts as Post[])
      await refreshReplyQueue()
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

  async function handleToggleSave(postId: string) {
    if (!user) return

    const wasSaved = savedPostIds.has(postId)
    setSavedPostIds((current) => {
      const next = new Set(current)
      if (wasSaved) next.delete(postId)
      else next.add(postId)
      return next
    })

    try {
      const result = (await DatabaseService.toggleBookmark(postId)) as { saved: boolean }
      // Reconcile with the server’s truth in case of a race.
      setSavedPostIds((current) => {
        const next = new Set(current)
        if (result.saved) next.add(postId)
        else next.delete(postId)
        return next
      })
      toast(result.saved ? 'Saved to your collection' : 'Removed from saved', 'success')
    } catch (error) {
      console.error('Failed to toggle bookmark:', error)
      // Roll back the optimistic change.
      setSavedPostIds((current) => {
        const next = new Set(current)
        if (wasSaved) next.add(postId)
        else next.delete(postId)
        return next
      })
      toast('Could not update saved', 'error')
    }
  }

  async function handleTogglePinForMe(postId: string) {
    if (!user) return
    const wasPinned = pinnedPostIds.has(postId)
    setPinningPostId(postId)
    // Optimistic toggle; reconcile/rollback on the server's response.
    setPinnedPostIds((current) => {
      const next = new Set(current)
      if (wasPinned) next.delete(postId)
      else next.add(postId)
      return next
    })
    try {
      if (wasPinned) {
        await DatabaseService.unpinPostForMe(postId)
        toast('Unpinned from your feed', 'success')
      } else {
        await DatabaseService.pinPostForMe(postId)
        toast('Pinned to the top of your feed', 'success')
      }
    } catch (error) {
      console.error('Failed to toggle personal pin:', error)
      setPinnedPostIds((current) => {
        const next = new Set(current)
        if (wasPinned) next.add(postId)
        else next.delete(postId)
        return next
      })
      toast('Could not update pin', 'error')
    } finally {
      setPinningPostId(null)
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
        <div className="space-y-5">
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
          <Skeleton className="h-12 w-full rounded-full" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-40 rounded-2xl" />
            ))}
          </div>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  return (
    <PageFrame>
      <div className="page-grid space-y-6 overflow-x-hidden">
        <header className="space-y-5">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent2">
                Community
              </p>
              <h1 className="text-2xl font-bold text-brand-background sm:text-3xl">
                People who get it
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-brand-background/60">
                Real conversations, peer support, professional guidance, and shared activities - all in one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>Posts {formatCompactNumber(posts.length)}</Badge>
              <Badge>Angels {formatCompactNumber(angels.length)}</Badge>
              <Badge>Mentors {formatCompactNumber(mentors.length)}</Badge>
              <Badge>Activities {formatCompactNumber(activities.length)}</Badge>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center">
            <div
              role="tablist"
              aria-label="Community sections"
              className="flex min-w-0 gap-1 overflow-x-auto rounded-full bg-brand-background/5 p-1.5"
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex min-w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                      isActive
                        ? 'bg-brand-background/20 text-brand-background shadow-sm'
                        : 'text-brand-background/60 hover:text-brand-background/90',
                    )}
                  >
                    <i className={tab.icon} aria-hidden="true" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
            {activeTab === 'discussions' && (
              <div className="relative flex-1 md:max-w-sm">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-brand-background/40" aria-hidden="true" />
                <Input
                  type="search"
                  value={postSearch}
                  onChange={(event) => setPostSearch(event.target.value)}
                  placeholder="Search posts, tags, authors"
                  aria-label="Search posts"
                  className="h-11 pl-10"
                />
                {postSearch && (
                  <button
                    type="button"
                    onClick={() => setPostSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-background/45 transition-colors hover:text-brand-background"
                    aria-label="Clear search"
                  >
                    <i className="ri-close-line" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {activeTab === 'discussions' && (
          <div className="page-grid gap-6 overflow-hidden lg:grid-cols-[minmax(0,1.2fr)_20rem] lg:items-start">
            <div className="space-y-4">
              <Card>
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
                    <p className="text-sm font-semibold text-brand-background">Start a discussion</p>
                    <p className="text-xs text-brand-background/50">
                      Share an update, ask for support, or celebrate a win.
                    </p>
                  </div>
                </div>

                <Textarea
                  value={newPostContent}
                  onChange={(event) => setNewPostContent(event.target.value)}
                  rows={pollMode ? 2 : 3}
                  placeholder={pollMode ? 'Ask the community a question…' : "What’s on your mind today?"}
                  aria-label={pollMode ? 'Poll question' : 'Write a post'}
                  className="mt-4 resize-none"
                />

                {pollMode && (
                  <div className="mt-3 space-y-2 rounded-2xl border border-brand-accent2/25 bg-brand-accent2/[0.05] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent2">Poll options</p>
                      <button
                        type="button"
                        onClick={() => {
                          setPollMode(false)
                          setPollDraftOptions(['', ''])
                          setPollMultiple(false)
                        }}
                        className="text-xs text-brand-background/50 transition-colors hover:text-brand-background"
                      >
                        Remove poll
                      </button>
                    </div>
                    {pollDraftOptions.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={option}
                          onChange={(event) =>
                            setPollDraftOptions((prev) => prev.map((value, idx) => (idx === index ? event.target.value : value)))
                          }
                          placeholder={`Option ${index + 1}`}
                          aria-label={`Poll option ${index + 1}`}
                          maxLength={80}
                        />
                        {pollDraftOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setPollDraftOptions((prev) => prev.filter((_, idx) => idx !== index))}
                            aria-label={`Remove option ${index + 1}`}
                            className="shrink-0 rounded-lg p-2 text-brand-background/40 transition-colors hover:text-brand-accent1"
                          >
                            <i className="ri-close-line" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      {pollDraftOptions.length < 6 ? (
                        <button
                          type="button"
                          onClick={() => setPollDraftOptions((prev) => [...prev, ''])}
                          className="text-xs font-medium text-brand-accent2 transition-colors hover:text-brand-accent2/80"
                        >
                          <i className="ri-add-line mr-1" aria-hidden="true" />
                          Add option
                        </button>
                      ) : (
                        <span />
                      )}
                      <label className="flex items-center gap-2 text-xs text-brand-background/60">
                        <input
                          type="checkbox"
                          checked={pollMultiple}
                          onChange={(event) => setPollMultiple(event.target.checked)}
                          className="accent-brand-accent2"
                        />
                        Allow multiple choices
                      </label>
                    </div>
                  </div>
                )}

                {/* Pending media previews */}
                {pendingMedia.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pendingMedia.map((item, idx) => (
                      <div key={idx} className="group relative">
                        {item.type === 'image' && (
                          <img src={item.preview} alt="Attachment preview" className="h-20 w-20 rounded-xl border border-brand-background/10 object-cover" />
                        )}
                        {item.type === 'video' && (
                          <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-brand-background/10 bg-brand-background/5">
                            <i className="ri-video-line text-xl text-brand-accent2" aria-hidden="true" />
                          </div>
                        )}
                        {item.type === 'audio' && (
                          <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-brand-background/10 bg-brand-background/5">
                            <i className="ri-mic-line text-xl text-brand-accent3" aria-hidden="true" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removePendingMedia(idx)}
                          aria-label="Remove attachment"
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-accent1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <i className="ri-close-line" aria-hidden="true" />
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
                      type="button"
                      onClick={() => mediaInputRef.current?.click()}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-background/8 text-brand-background/60 transition-colors hover:bg-brand-accent2/10 hover:text-brand-accent2"
                      aria-label="Attach image or video"
                      title="Attach image or video"
                    >
                      <i className="ri-image-line text-base" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={toggleVoiceRecording}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-xl text-base transition-colors',
                        recording
                          ? 'animate-pulse bg-brand-accent1/20 text-brand-accent1'
                          : 'bg-brand-background/8 text-brand-background/60 hover:bg-brand-accent3/10 hover:text-brand-accent3',
                      )}
                      aria-label={recording ? 'Stop recording' : 'Record voice'}
                      title={recording ? 'Stop recording' : 'Record voice'}
                    >
                      <i className={recording ? 'ri-stop-circle-line' : 'ri-mic-line'} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => (pollMode ? setPollMode(false) : handleCreatePoll())}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-xl text-base transition-colors',
                        pollMode
                          ? 'bg-brand-accent2/20 text-brand-accent2'
                          : 'bg-brand-background/8 text-brand-background/60 hover:bg-brand-accent2/10 hover:text-brand-accent2',
                      )}
                      aria-label="Create a poll"
                      aria-pressed={pollMode}
                      title="Create a poll"
                    >
                      <i className="ri-bar-chart-2-line" aria-hidden="true" />
                    </button>
                    <span className="hidden text-[11px] text-brand-background/35 sm:inline">
                      {profile?.is_anonymous ? 'Posting anonymously' : 'Posting as you'}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleCreatePost}
                    disabled={
                      posting ||
                      (pollMode
                        ? !newPostContent.trim() || pollDraftOptions.filter((option) => option.trim()).length < 2
                        : !newPostContent.trim() && pendingMedia.length === 0)
                    }
                    isLoading={posting}
                  >
                    {posting ? 'Posting…' : pollMode ? 'Post poll' : 'Post'}
                  </Button>
                </div>
              </Card>

              <section className="space-y-4">
                {featuredPosts.length > 0 ? (
                  featuredPosts.map((post) => {
                    const author = post.is_anonymous
                      ? 'Anonymous'
                      : ((post.profile?.full_name as string | undefined) ||
                        (post.profile?.username as string | undefined) ||
                        'Community member')

                    const liked = likedPostIds.has(post.id)
                    const saved = savedPostIds.has(post.id)
                    const pinnedForMe = pinnedPostIds.has(post.id)
                    const isOwner = user && (post.user_id as string) === user.userId
                    const postMedia = (post.media as Array<{ url: string; type: string }> | undefined) || []
                    const rekindleOriginal = post.rekindle_original as Record<string, unknown> | undefined
                    const isEditing = editingPostId === post.id

                    return (
                      <Card key={post.id} id={`community-post-${post.id}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-brand-background/10 text-sm font-bold text-brand-accent2">
                            {post.is_anonymous ? (
                              <i className="ri-spy-line text-base" aria-hidden="true" />
                            ) : (
                              <MemberAvatar
                                profile={post.profile}
                                alt={author}
                                avatarUrl={post.profile?.avatar_url as string | undefined}
                                className="h-11 w-11 rounded-2xl object-cover"
                                fullName={post.profile?.full_name as string | undefined}
                                isAnonymous={Boolean(post.is_anonymous)}
                                userId={post.profile?.id as string | undefined}
                                username={post.profile?.username as string | undefined}
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="min-w-0 max-w-full truncate font-semibold text-brand-background">
                                <MemberName
                                  profile={post.profile}
                                  name={author}
                                  isAnonymous={Boolean(post.is_anonymous)}
                                  showQuickAction={!isOwner}
                                />
                              </p>
                              {pinnedForMe && (
                                <Badge tone="accent" className="text-[10px]">
                                  <i className="ri-pushpin-fill" aria-hidden="true" /> Pinned
                                </Badge>
                              )}
                              {post.type === 'rekindle' && (
                                <Badge tone="accent" className="text-[10px]">
                                  <i className="ri-loop-left-line" aria-hidden="true" /> rekindled
                                </Badge>
                              )}
                              {typeof post.type === 'string' && post.type !== 'rekindle' && (
                                <Badge className="text-[10px] capitalize">{post.type}</Badge>
                              )}
                              {(post.group as { id: string; name: string } | null) && (
                                <Link
                                  href={`/groups/${(post.group as { id: string; name: string }).id}`}
                                  className="inline-flex items-center gap-1 rounded-full bg-brand-accent3/15 px-2 py-0.5 text-[10px] font-medium text-brand-accent3 transition-colors hover:bg-brand-accent3/25"
                                >
                                  <i className="ri-group-line" aria-hidden="true" />
                                  {(post.group as { id: string; name: string }).name}
                                </Link>
                              )}
                              {!!post.edited && (
                                <span className="text-[10px] italic text-brand-background/35">edited</span>
                              )}
                            </div>
                            <p className="text-xs text-brand-background/40">{formatRelativeTime(post.created_at)}</p>
                          </div>
                          {!isEditing && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleTogglePinForMe(post.id)}
                                disabled={pinningPostId === post.id}
                                className={cn(
                                  'flex h-9 w-9 items-center justify-center rounded-xl transition-colors disabled:opacity-50',
                                  pinnedForMe
                                    ? 'text-brand-accent2 hover:bg-brand-accent2/10'
                                    : 'text-brand-background/35 hover:bg-brand-background/8 hover:text-brand-accent2',
                                )}
                                aria-label={pinnedForMe ? 'Unpin from your feed' : 'Pin to top of your feed'}
                                aria-pressed={pinnedForMe}
                                title={pinnedForMe ? 'Unpin from your feed' : 'Pin to top of your feed'}
                              >
                                <i className={pinnedForMe ? 'ri-pushpin-fill text-sm' : 'ri-pushpin-line text-sm'} aria-hidden="true" />
                              </button>
                              {isOwner && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => { setEditingPostId(post.id); setEditContent(post.content as string || '') }}
                                    className="flex h-9 w-9 items-center justify-center rounded-xl text-brand-background/35 transition-colors hover:bg-brand-background/8 hover:text-brand-background/60"
                                    aria-label="Edit post"
                                    title="Edit post"
                                  >
                                    <i className="ri-pencil-line text-sm" aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePost(post.id)}
                                    className="flex h-9 w-9 items-center justify-center rounded-xl text-brand-background/35 transition-colors hover:bg-brand-accent1/10 hover:text-brand-accent1"
                                    aria-label="Delete post"
                                    title="Delete post"
                                  >
                                    <i className="ri-delete-bin-line text-sm" aria-hidden="true" />
                                  </button>
                                </>
                              )}
                              {user && !isOwner && (
                                <ReportDialog
                                  targetType="post"
                                  targetId={post.id}
                                  targetOwnerId={post.user_id as string | undefined}
                                  compact
                                  className="flex h-9 w-9 items-center justify-center rounded-xl text-brand-background/35 transition-colors hover:bg-brand-accent1/10 hover:text-brand-accent1"
                                />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Post content or edit mode */}
                        {isEditing ? (
                          <div className="mt-3">
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              rows={3}
                              aria-label="Edit post content"
                              className="resize-none"
                            />
                            <div className="mt-2 flex items-center justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => { setEditingPostId(null); setEditContent('') }}>
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleEditPost(post.id)}
                                disabled={saving || !editContent.trim()}
                                isLoading={saving}
                              >
                                {saving ? 'Saving…' : 'Save'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {(post.content as string)?.trim() && (
                              <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-brand-background/75">
                                {renderWithMentions(post.content as string)}
                              </p>
                            )}
                          </>
                        )}

                        {/* Poll */}
                        {(() => {
                          const poll = pollsByPost[post.id]
                          if (!poll) return null
                          const total = poll.total_votes
                          const hasVoted = poll.my_option_ids.length > 0
                          return (
                            <div className="mt-4 space-y-2">
                              {poll.question && (
                                <p className="text-sm font-semibold text-brand-background">{poll.question}</p>
                              )}
                              {poll.options.map((option) => {
                                const pct = total > 0 ? Math.round((option.votes_count / total) * 100) : 0
                                const mine = poll.my_option_ids.includes(option.id)
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => handleVote(poll.id, option.id, post.id)}
                                    disabled={poll.closed}
                                    aria-pressed={mine}
                                    className={cn(
                                      'relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors',
                                      mine ? 'border-brand-accent2/50' : 'border-brand-background/12 hover:border-brand-accent2/30',
                                      poll.closed && 'cursor-default',
                                    )}
                                  >
                                    <span
                                      className="absolute inset-y-0 left-0 bg-brand-accent2/15 transition-all"
                                      style={{ width: `${pct}%` }}
                                      aria-hidden="true"
                                    />
                                    <span className="relative flex items-center justify-between gap-2 text-sm">
                                      <span className="flex items-center gap-1.5 font-medium text-brand-background">
                                        {mine && <i className="ri-checkbox-circle-fill text-brand-accent2" aria-hidden="true" />}
                                        {option.label}
                                      </span>
                                      <span className="shrink-0 text-xs text-brand-background/55">{pct}%</span>
                                    </span>
                                  </button>
                                )
                              })}
                              <p className="text-xs text-brand-background/45">
                                {total} {total === 1 ? 'vote' : 'votes'}
                                {poll.allow_multiple ? ' · pick as many as you like' : ''}
                                {poll.closed ? ' · closed' : hasVoted ? ' · tap to change' : ''}
                              </p>
                            </div>
                          )
                        })()}

                        {/* Rekindle embed (original post) */}
                        {rekindleOriginal && (
                          <div className="mt-3 rounded-2xl border border-brand-background/10 bg-brand-background/[0.04] p-4">
                            <div className="mb-2 flex items-center gap-2">
                              <i className="ri-loop-left-line shrink-0 text-xs text-brand-accent2" aria-hidden="true" />
                              <span className="min-w-0 truncate text-xs font-medium text-brand-background/60">
                                {rekindleOriginal.author_name as string || 'Someone'}
                              </span>
                            </div>
                            {(rekindleOriginal.content as string)?.trim() && (
                              <p className="break-words text-sm leading-relaxed text-brand-background/60">
                                {rekindleOriginal.content as string}
                              </p>
                            )}
                            {/* Original post media */}
                            {Array.isArray(rekindleOriginal.media) && (rekindleOriginal.media as Array<{ url: string; type: string }>).length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(rekindleOriginal.media as Array<{ url: string; type: string }>).map((m, i) => (
                                  <div key={i}>
                                    {m.type === 'image' && (
                                      <img src={m.url} alt="" className="max-h-32 max-w-full rounded-xl object-cover" />
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
                                    className="mx-auto max-h-[34rem] w-auto max-w-full rounded-2xl border border-brand-background/10 bg-black/20 object-contain"
                                  />
                                )}
                                {media.type === 'video' && (
                                  <video
                                    src={media.url}
                                    controls
                                    className="max-h-80 w-full rounded-2xl border border-brand-background/10 bg-black"
                                  />
                                )}
                                {media.type === 'audio' && (
                                  <div className="flex items-center gap-3 rounded-2xl border border-brand-background/10 bg-brand-background/[0.04] p-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent3/16">
                                      <i className="ri-mic-line text-lg text-brand-accent3" aria-hidden="true" />
                                    </div>
                                    <audio src={media.url} controls className="h-8 flex-1" style={{ minWidth: 0 }} />
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
                                <ReactionSummaryButton
                                  key={emoji}
                                  emoji={emoji}
                                  count={count}
                                  active={reacted}
                                  actors={(post.reactors as Record<string, string[]> | undefined)?.[emoji] ?? []}
                                  onClick={() => handleEmojiReaction(post.id, emoji)}
                                />
                              )
                            })}
                          </div>
                        )}

                        {/* Rekindle composer inline */}
                        {rekindlingPostId === post.id && (
                          <div className="mt-3 rounded-2xl border border-brand-accent2/20 bg-brand-accent2/5 p-3">
                            <p className="mb-2 text-xs font-semibold text-brand-accent2">
                              <i className="ri-loop-left-line mr-1" aria-hidden="true" /> Rekindle this post
                            </p>
                            <Textarea
                              value={rekindleComment}
                              onChange={(e) => setRekindleComment(e.target.value)}
                              rows={2}
                              placeholder="Add a thought (optional)…"
                              aria-label="Rekindle comment"
                              className="resize-none text-xs"
                            />
                            <div className="mt-2 flex items-center justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => { setRekindlingPostId(null); setRekindleComment('') }}>
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleRekindle(post.id)}
                                disabled={rekindling}
                                isLoading={rekindling}
                              >
                                {rekindling ? 'Rekindling…' : 'Rekindle'}
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="mt-3 flex items-center gap-1 border-t border-brand-background/8 pt-3 text-sm">
                          <button
                            type="button"
                            onClick={() => handleToggleLike(post.id)}
                            className={cn(
                              'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-colors hover:bg-brand-background/8',
                              liked ? 'text-brand-accent1' : 'text-brand-background/45',
                            )}
                            aria-label={liked ? 'Unlike post' : 'Like post'}
                            aria-pressed={liked}
                          >
                            <i className={liked ? 'ri-heart-fill' : 'ri-heart-line'} aria-hidden="true" />
                            {formatCompactNumber(post.likes_count as number | undefined)}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleComments(post.id)}
                            className={cn(
                              'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-colors hover:bg-brand-background/8',
                              openCommentsFor.has(post.id) ? 'text-brand-accent2' : 'text-brand-background/45 hover:text-brand-accent2',
                            )}
                            aria-label="Comments"
                            aria-expanded={openCommentsFor.has(post.id)}
                          >
                            <i className="ri-chat-1-line" aria-hidden="true" />
                            {formatCompactNumber(post.comments_count as number | undefined)}
                          </button>

                          {/* Rekindle button */}
                          <button
                            type="button"
                            onClick={() => setRekindlingPostId(rekindlingPostId === post.id ? null : post.id)}
                            className={cn(
                              'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-colors hover:bg-brand-background/8',
                              rekindlingPostId === post.id ? 'text-brand-accent2' : 'text-brand-background/45 hover:text-brand-accent2',
                            )}
                            aria-label="Rekindle"
                          >
                            <i className="ri-loop-left-line" aria-hidden="true" />
                            {formatCompactNumber(post.rekindle_count as number | undefined)}
                          </button>

                          {/* Save / bookmark button */}
                          <button
                            type="button"
                            onClick={() => handleToggleSave(post.id)}
                            className={cn(
                              'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-colors hover:bg-brand-background/8',
                              saved ? 'text-brand-accent3' : 'text-brand-background/45 hover:text-brand-accent3',
                            )}
                            aria-label={saved ? 'Remove from saved' : 'Save post'}
                            aria-pressed={saved}
                          >
                            <i className={saved ? 'ri-bookmark-fill' : 'ri-bookmark-line'} aria-hidden="true" />
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
                                  aria-label="Type an emoji to react"
                                  className="w-12 rounded-full border border-brand-background/20 bg-brand-background/10 px-2 py-1 text-center text-base text-brand-background outline-none focus:border-brand-accent2/50"
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
                                  type="button"
                                  onClick={() => setEmojiInputPostId(null)}
                                  className="text-xs text-brand-background/40"
                                  aria-label="Close emoji input"
                                >
                                  <i className="ri-close-line" aria-hidden="true" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEmojiInputPostId(post.id)
                                  setTimeout(() => emojiInputRef.current?.focus(), 50)
                                }}
                                className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-brand-background/45 transition-colors hover:bg-brand-background/8 hover:text-brand-accent2"
                                aria-label="React with emoji"
                                title="React with emoji"
                              >
                                <i className="ri-emotion-happy-line" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>

                        {openCommentsFor.has(post.id) && (
                          <div className="mt-3 space-y-3 border-t border-brand-background/8 pt-3">
                            {loadingCommentsFor.has(post.id) ? (
                              <p className="text-xs text-brand-background/45">Loading comments…</p>
                            ) : (commentsByPost[post.id] ?? []).length === 0 ? (
                              <p className="text-xs text-brand-background/45">Be the first to reply.</p>
                            ) : (
                              <ul className="space-y-3">
                                {(commentsByPost[post.id] ?? []).filter((comment) => !comment.parent_id).map((comment) => {
                                  const authorProfile = comment.profile
                                  const commentAuthorName = comment.is_anonymous
                                    ? 'Anonymous'
                                    : ((authorProfile?.full_name as string | undefined) ||
                                        (authorProfile?.username as string | undefined) ||
                                        'Community member')
                                  const replies = (commentsByPost[post.id] ?? []).filter((reply) => reply.parent_id === comment.id)
                                  return (
                                    <li key={comment.id} className="flex gap-3">
                                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-accent3/25 text-xs font-bold text-brand-accent3">
                                        {comment.is_anonymous ? (
                                          <i className="ri-spy-line text-sm" aria-hidden="true" />
                                        ) : (
                                          <MemberAvatar
                                            profile={authorProfile}
                                            alt={commentAuthorName}
                                            avatarUrl={authorProfile?.avatar_url as string | undefined}
                                            className="h-8 w-8 rounded-full object-cover"
                                            fullName={authorProfile?.full_name as string | undefined}
                                            isAnonymous={Boolean(comment.is_anonymous)}
                                            userId={authorProfile?.id as string | undefined}
                                            username={authorProfile?.username as string | undefined}
                                          />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1 rounded-2xl bg-brand-background/6 px-3 py-2">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-brand-background/50">
                                          <span className="min-w-0 max-w-full truncate font-semibold text-brand-background/80">
                                            <MemberName
                                              profile={authorProfile}
                                              name={commentAuthorName}
                                              isAnonymous={Boolean(comment.is_anonymous)}
                                            />
                                          </span>
                                          <span aria-hidden="true">·</span>
                                          <span className="shrink-0">{formatRelativeTime(comment.created_at)}</span>
                                        </div>
                                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-brand-background/80">
                                          {renderWithMentions(comment.content as string)}
                                        </p>
                                        <CommentReactions
                                          commentId={comment.id as string}
                                          initialCounts={(comment.reaction_counts as Record<string, number> | undefined) ?? {}}
                                          initialMine={(comment.my_reactions as string[] | undefined) ?? []}
                                          reactors={(comment.reactors as Record<string, string[]> | undefined) ?? {}}
                                          canReact={Boolean(user)}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => setReplyToCommentId(replyToCommentId === comment.id ? null : comment.id)}
                                          className="mt-2 text-xs font-semibold text-brand-accent2 hover:text-brand-accent1"
                                        >
                                          Reply
                                        </button>
                                        {replyToCommentId === comment.id && (
                                          <div className="mt-3 flex items-start gap-2">
                                            <Textarea
                                              value={replyDrafts[comment.id] ?? ''}
                                              onChange={(event) =>
                                                setReplyDrafts((current) => ({
                                                  ...current,
                                                  [comment.id]: event.target.value,
                                                }))
                                              }
                                              onKeyDown={(event) => {
                                                if (event.key === 'Enter' && !event.shiftKey) {
                                                  event.preventDefault()
                                                  void submitCommentReply(post.id, comment.id)
                                                }
                                              }}
                                              placeholder="Write a reply..."
                                              aria-label="Write a reply"
                                              rows={1}
                                              className="flex-1 resize-none !py-2.5"
                                            />
                                            <Button
                                              onClick={() => void submitCommentReply(post.id, comment.id)}
                                              disabled={replyingToCommentId === comment.id || !(replyDrafts[comment.id] ?? '').trim()}
                                              isLoading={replyingToCommentId === comment.id}
                                            >
                                              {replyingToCommentId === comment.id ? 'Sending...' : 'Reply'}
                                            </Button>
                                          </div>
                                        )}
                                        {replies.length > 0 && (
                                          <ul className="mt-3 space-y-2 border-l border-brand-background/10 pl-3">
                                            {replies.map((reply) => {
                                              const replyAuthorProfile = reply.profile
                                              const replyAuthorName = reply.is_anonymous
                                                ? 'Anonymous'
                                                : ((replyAuthorProfile?.full_name as string | undefined) ||
                                                    (replyAuthorProfile?.username as string | undefined) ||
                                                    'Community member')
                                              return (
                                                <li key={reply.id} className="flex gap-2 text-xs">
                                                  <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-accent3/20 text-[10px] font-bold text-brand-accent3">
                                                    {reply.is_anonymous ? (
                                                      <i className="ri-spy-line" aria-hidden="true" />
                                                    ) : (
                                                      <MemberAvatar
                                                        profile={replyAuthorProfile}
                                                        alt={replyAuthorName}
                                                        avatarUrl={replyAuthorProfile?.avatar_url as string | undefined}
                                                        className="h-6 w-6 rounded-full object-cover"
                                                        fullName={replyAuthorProfile?.full_name as string | undefined}
                                                        isAnonymous={Boolean(reply.is_anonymous)}
                                                        userId={replyAuthorProfile?.id as string | undefined}
                                                        username={replyAuthorProfile?.username as string | undefined}
                                                      />
                                                    )}
                                                  </div>
                                                  <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-brand-background/45">
                                                      <span className="font-semibold text-brand-background/70">
                                                        <MemberName
                                                          profile={replyAuthorProfile}
                                                          name={replyAuthorName}
                                                          isAnonymous={Boolean(reply.is_anonymous)}
                                                        />
                                                      </span>
                                                      <span className="shrink-0">{formatRelativeTime(reply.created_at)}</span>
                                                    </div>
                                                    <p className="mt-0.5 whitespace-pre-wrap break-words text-brand-background/75">
                                                      {renderWithMentions(reply.content as string)}
                                                    </p>
                                                    <CommentReactions
                                                      commentId={reply.id as string}
                                                      initialCounts={(reply.reaction_counts as Record<string, number> | undefined) ?? {}}
                                                      initialMine={(reply.my_reactions as string[] | undefined) ?? []}
                                                      reactors={(reply.reactors as Record<string, string[]> | undefined) ?? {}}
                                                      canReact={Boolean(user)}
                                                    />
                                                  </div>
                                                </li>
                                              )
                                            })}
                                          </ul>
                                        )}
                                      </div>
                                    </li>
                                  )
                                })}
                              </ul>
                            )}

                            <div className="flex items-start gap-2">
                              <Textarea
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
                                aria-label="Write a reply"
                                rows={1}
                                className="flex-1 resize-none !py-2.5"
                              />
                              <Button
                                onClick={() => void submitComment(post.id)}
                                disabled={commentingPostId === post.id || !(commentDrafts[post.id] ?? '').trim()}
                                isLoading={commentingPostId === post.id}
                              >
                                {commentingPostId === post.id ? 'Sending…' : 'Reply'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </Card>
                    )
                  })
                ) : loading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Skeleton key={index} className="h-28 rounded-2xl" />
                    ))}
                  </div>
                ) : postSearch ? (
                  <EmptyState
                    icon={<i className="ri-search-line text-3xl" aria-hidden="true" />}
                    title="No posts match that search"
                    description="Try a different word, or clear the search to see every discussion."
                    action={
                      <Button variant="secondary" onClick={() => setPostSearch('')}>
                        Clear search
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={<i className="ri-chat-smile-3-line text-3xl" aria-hidden="true" />}
                    title="No posts here yet"
                    description="It’s quiet for now. Your post could be the one that starts the conversation."
                  />
                )}
              </section>
            </div>

            <aside className="space-y-4">
              <Card className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-brand-background">Needs a reply</h2>
                    <p className="mt-1 text-sm leading-relaxed text-brand-background/60">
                      Recent posts where your lived experience may help.
                    </p>
                  </div>
                  {replyQueue.length > 0 && <Badge tone="sage">{replyQueue.length}</Badge>}
                </div>

                {replyQueue.length > 0 ? (
                  <div className="space-y-2">
                    {replyQueue.map((item) => {
                      const author = item.author
                      const authorName =
                        author?.full_name ||
                        author?.fullName ||
                        author?.username ||
                        (author ? 'Community member' : 'Anonymous')
                      const avatarUrl = author?.avatar_url || author?.avatarUrl || undefined
                      const authorUserId = author?.user_id || author?.userId || author?.id
                      const commentsCount = item.comments_count ?? item.commentsCount ?? 0
                      const reasons = (item.reasons ?? []).slice(0, 3)

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => void openReplyTarget(item.id)}
                          className="group w-full rounded-2xl border border-brand-background/10 bg-brand-background/[0.035] p-3 text-left transition-colors hover:border-brand-accent2/35 hover:bg-brand-accent2/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/40"
                          aria-label={`Open replies for ${authorName}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-background/10 text-brand-accent2">
                              {author ? (
                                <MemberAvatar
                                  profile={author as Record<string, unknown>}
                                  alt={authorName}
                                  avatarUrl={avatarUrl}
                                  className="h-9 w-9 rounded-xl object-cover"
                                  fullName={authorName}
                                  userId={authorUserId}
                                  username={author?.username ?? undefined}
                                />
                              ) : (
                                <i className="ri-spy-line text-sm" aria-hidden="true" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="min-w-0 truncate text-sm font-semibold text-brand-background">
                                  {authorName}
                                </p>
                                <span className="shrink-0 text-[11px] text-brand-background/45">
                                  {formatRelativeTime(item.created_at ?? item.createdAt)}
                                </span>
                              </div>
                              {item.group && (
                                <p className="mt-0.5 truncate text-[11px] text-brand-accent3">
                                  {item.group.name}
                                </p>
                              )}
                              <p className="mt-2 text-sm leading-relaxed text-brand-background/70">
                                {item.content || 'Open discussion'}
                              </p>
                              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                {reasons.map((reason) => (
                                  <span
                                    key={reason}
                                    className="rounded-full bg-brand-surface px-2 py-0.5 text-[11px] font-medium text-brand-background/65"
                                  >
                                    {reason}
                                  </span>
                                ))}
                              </div>
                              <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                                <span className="text-brand-background/45">
                                  {commentsCount === 0
                                    ? 'No replies'
                                    : `${formatCompactNumber(commentsCount)} ${commentsCount === 1 ? 'reply' : 'replies'}`}
                                </span>
                                <span className="inline-flex items-center gap-1 font-semibold text-brand-accent2 transition-colors group-hover:text-brand-accent2/80">
                                  Reply
                                  <i className="ri-arrow-right-s-line" aria-hidden="true" />
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.035] p-4">
                    <p className="text-sm font-semibold text-brand-background">Replies look healthy right now.</p>
                    <p className="mt-1 text-sm leading-relaxed text-brand-background/60">
                      Check the feed for new posts or start a discussion.
                    </p>
                  </div>
                )}
              </Card>

              <Card>
                <h2 className="mb-3 text-base font-bold text-brand-background">Community rhythm</h2>
                <div className="space-y-3">
                  <Card variant="light" className="p-4">
                    <p className="text-xs text-brand-background/45">Latest activity</p>
                    <p className="mt-1 text-sm font-semibold text-brand-background">
                      {featuredPosts[0] ? formatRelativeTime(featuredPosts[0].created_at) : 'Waiting for the first update'}
                    </p>
                  </Card>
                  <Card variant="light" className="p-4">
                    <p className="text-xs text-brand-background/45">Support available now</p>
                    <p className="mt-1 text-sm font-semibold text-brand-background">
                      {(angels.length + mentors.length) > 0
                        ? `${formatCompactNumber(angels.length + mentors.length)} ${angels.length + mentors.length === 1 ? 'peer' : 'peers'} ready to help`
                        : 'Share here - replies come from the whole community.'}
                    </p>
                  </Card>
                </div>
              </Card>
            </aside>
          </div>
        )}

        {activeTab === 'angels' && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              {creator === 'angel' ? (
                <Card className="space-y-3">
                  <h3 className="font-semibold text-brand-background">Become an angel</h3>
                  <p className="text-sm text-brand-background/60">
                    Volunteer as a peer supporter. People navigating something similar can choose you to walk alongside them.
                  </p>
                  <Input placeholder="Your focus (e.g. anxiety, grief, chronic pain)" value={String(creatorForm.specialty ?? '')} onChange={(e) => setField('specialty', e.target.value)} />
                  <Input placeholder="Your support style (e.g. warm listener, practical)" value={String(creatorForm.supportStyle ?? '')} onChange={(e) => setField('supportStyle', e.target.value)} />
                  <Textarea rows={3} placeholder="A short note about how you can help…" value={String(creatorForm.bio ?? '')} onChange={(e) => setField('bio', e.target.value)} />
                  <Input type="number" min={1} max={20} placeholder="People you can support at once (default 3)" value={String(creatorForm.maxSouls ?? '')} onChange={(e) => setField('maxSouls', e.target.value)} />
                  <div className="flex gap-2">
                    <Button onClick={handleBecomeAngel} isLoading={creatorSubmitting} disabled={creatorSubmitting}>List me as an angel</Button>
                    <Button variant="ghost" onClick={closeCreator}>Cancel</Button>
                  </div>
                </Card>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-background/10 bg-brand-background/[0.04] p-4">
                  <p className="text-sm text-brand-background/70">
                    <i className="ri-hand-heart-line mr-1.5 text-brand-accent2" aria-hidden="true" />
                    Want to support others? Volunteer as a peer angel.
                  </p>
                  <Button variant="secondary" onClick={() => { setCreator('angel'); setCreatorForm({}) }}>Become an angel</Button>
                </div>
              )}
            </div>
            {angels.length > 0 ? (
              angels.map((angel) => {
                const profileData = (angel.profile as Record<string, unknown> | undefined) ?? {}
                const name =
                  (profileData.full_name as string | undefined) ||
                  (profileData.username as string | undefined) ||
                  'Peer supporter'

                const isChoosing = choosingAngelIds.has(angel.id as string)
                return (
                  <Card key={angel.id as string} className="flex flex-col">
                    <div className="flex items-start gap-3">
                      <MemberAvatar
                        profile={profileData}
                        alt={name}
                        avatarUrl={profileData.avatar_url as string | undefined}
                        className="h-12 w-12 rounded-2xl object-cover"
                        fullName={profileData.full_name as string | undefined}
                        userId={profileData.id as string | undefined}
                        username={profileData.username as string | undefined}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="min-w-0 truncate font-semibold text-brand-background">
                            <MemberName profile={profileData} name={name} />
                          </h2>
                          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-emerald-300">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                            Available
                          </span>
                        </div>
                        <p className="break-words text-xs text-brand-accent2">{angel.specialty as string}</p>
                        <p className="mt-1 text-xs text-brand-background/45">
                          Rating {angel.rating as number} • {(angel.response_time as string | undefined) || 'Responds soon'}
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 break-words text-sm leading-relaxed text-brand-background/70">
                      {(angel.bio as string | undefined) || 'A real peer supporter, here to walk alongside you.'}
                    </p>

                    <div className="mt-4 flex items-center justify-between text-xs text-brand-background/45">
                      <span>{angel.current_souls as number}/{angel.max_souls as number} members supported</span>
                      <span>{formatCompactNumber(angel.total_reviews as number | undefined)} reviews</span>
                    </div>

                    <div className="mt-5 pt-1">
                      <Button
                        onClick={() => handleChooseAngel(angel.id as string)}
                        disabled={isChoosing}
                        isLoading={isChoosing}
                        fullWidth
                      >
                        {isChoosing ? 'Connecting…' : 'Choose this angel'}
                      </Button>
                    </div>
                  </Card>
                )
              })
            ) : (
              <EmptyState
                className="sm:col-span-2 lg:col-span-3"
                icon={<i className="ri-heart-pulse-line text-3xl" aria-hidden="true" />}
                title="No angels available right now"
                description="Peer supporters step in when they can. Check back soon, or share in Discussions - the whole community is here for you."
                action={
                  <Button variant="secondary" onClick={() => setActiveTab('discussions')}>
                    Go to Discussions
                  </Button>
                }
              />
            )}
          </section>
        )}

        {activeTab === 'mentors' && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              {creator === 'mentor' ? (
                <Card className="space-y-3">
                  <h3 className="font-semibold text-brand-background">Become a mentor</h3>
                  <p className="text-sm text-brand-background/60">
                    Offer guided, structured support in areas you know well. Members can find you here.
                  </p>
                  <Input placeholder="Areas of expertise, comma separated (e.g. ADHD, recovery, caregiving)" value={String(creatorForm.expertise ?? '')} onChange={(e) => setField('expertise', e.target.value)} />
                  <Input type="number" min={0} max={60} placeholder="Years of experience" value={String(creatorForm.experienceYears ?? '')} onChange={(e) => setField('experienceYears', e.target.value)} />
                  <Textarea rows={3} placeholder="A short note about your approach…" value={String(creatorForm.bio ?? '')} onChange={(e) => setField('bio', e.target.value)} />
                  <div className="flex gap-2">
                    <Button onClick={handleBecomeMentor} isLoading={creatorSubmitting} disabled={creatorSubmitting}>List me as a mentor</Button>
                    <Button variant="ghost" onClick={closeCreator}>Cancel</Button>
                  </div>
                </Card>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-background/10 bg-brand-background/[0.04] p-4">
                  <p className="text-sm text-brand-background/70">
                    <i className="ri-user-star-line mr-1.5 text-brand-accent2" aria-hidden="true" />
                    Have experience to share? Offer guided support as a mentor.
                  </p>
                  <Button variant="secondary" onClick={() => { setCreator('mentor'); setCreatorForm({}) }}>Become a mentor</Button>
                </div>
              )}
            </div>
            {mentors.length > 0 ? (
              mentors.map((mentor) => {
                const profileData = (mentor.profile as Record<string, unknown> | undefined) ?? {}
                const name =
                  (profileData.full_name as string | undefined) ||
                  (profileData.username as string | undefined) ||
                  'Mentor'

                return (
                  <Card key={mentor.id as string} className="flex flex-col">
                    <div className="flex items-start gap-3">
                      <MemberAvatar
                        profile={profileData}
                        alt={name}
                        avatarUrl={profileData.avatar_url as string | undefined}
                        className="h-12 w-12 rounded-2xl object-cover"
                        fullName={profileData.full_name as string | undefined}
                        userId={profileData.id as string | undefined}
                        username={profileData.username as string | undefined}
                      />
                      <div className="min-w-0 flex-1">
                          <h2 className="min-w-0 truncate font-semibold text-brand-background">
                            <MemberName profile={profileData} name={name} />
                          </h2>
                        <p className="break-words text-xs text-brand-background/45">
                          {(mentor.credentials as string | undefined) || 'Guided support'}
                        </p>
                        <p className="mt-1 text-xs text-brand-accent2">
                          Rating {mentor.rating as number} • {formatCompactNumber(mentor.sessions_completed as number | undefined)} sessions
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {((mentor.expertise as string[] | undefined) || []).slice(0, 4).map((topic) => (
                        <Badge key={topic} className="text-[10px]">
                          {topic}
                        </Badge>
                      ))}
                    </div>

                    <p className="mt-4 break-words text-sm leading-relaxed text-brand-background/70">
                      {(mentor.bio as string | undefined) || 'Available for guided, structured support.'}
                    </p>

                    <div className="mt-5 pt-1">
                      <LinkButton href="/therapy" variant="accent" fullWidth>
                        View in support space
                      </LinkButton>
                    </div>
                  </Card>
                )
              })
            ) : (
              <EmptyState
                className="sm:col-span-2 lg:col-span-3"
                icon={<i className="ri-user-star-line text-3xl" aria-hidden="true" />}
                title="No mentors published yet"
                description="Guided support from mentors will appear here as they join. In the meantime, peer support is just a tab away."
                action={
                  <Button variant="secondary" onClick={() => setActiveTab('angels')}>
                    See peer supporters
                  </Button>
                }
              />
            )}
          </section>
        )}

        {activeTab === 'activities' && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              {creator === 'activity' ? (
                <Card className="space-y-3">
                  <h3 className="font-semibold text-brand-background">Host an activity</h3>
                  <p className="text-sm text-brand-background/60">
                    Schedule a meetup, support circle, or live session. Members can join from here.
                  </p>
                  <Input placeholder="Title (e.g. Sunday evening check-in)" value={String(creatorForm.title ?? '')} onChange={(e) => setField('title', e.target.value)} />
                  <Textarea rows={3} placeholder="What is it about? What can people expect?" value={String(creatorForm.description ?? '')} onChange={(e) => setField('description', e.target.value)} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input placeholder="Type (e.g. group chat, walk, workshop)" value={String(creatorForm.activityType ?? '')} onChange={(e) => setField('activityType', e.target.value)} />
                    <select className="input-field" value={String(creatorForm.isVirtual ?? 'virtual')} onChange={(e) => setField('isVirtual', e.target.value)} aria-label="Format">
                      <option value="virtual">Virtual</option>
                      <option value="inperson">In person</option>
                    </select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input type="datetime-local" value={String(creatorForm.scheduledAt ?? '')} onChange={(e) => setField('scheduledAt', e.target.value)} aria-label="When" />
                    <Input type="number" min={2} placeholder="Max participants (optional)" value={String(creatorForm.maxParticipants ?? '')} onChange={(e) => setField('maxParticipants', e.target.value)} />
                  </div>
                  {creatorForm.isVirtual === 'inperson' && (
                    <Input placeholder="Location" value={String(creatorForm.location ?? '')} onChange={(e) => setField('location', e.target.value)} />
                  )}
                  <div className="flex gap-2">
                    <Button onClick={handleCreateActivity} isLoading={creatorSubmitting} disabled={creatorSubmitting}>Schedule activity</Button>
                    <Button variant="ghost" onClick={closeCreator}>Cancel</Button>
                  </div>
                </Card>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-background/10 bg-brand-background/[0.04] p-4">
                  <p className="text-sm text-brand-background/70">
                    <i className="ri-calendar-event-line mr-1.5 text-brand-accent2" aria-hidden="true" />
                    Bring people together - host a meetup or live session.
                  </p>
                  <Button variant="secondary" onClick={() => { setCreator('activity'); setCreatorForm({}) }}>Host an activity</Button>
                </div>
              )}
            </div>
            {activities.length > 0 ? (
              activities.map((activity) => {
                const organizer = (activity.organizer as Record<string, unknown> | undefined) ?? {}
                const organizerName =
                  (organizer.full_name as string | undefined) ||
                  (organizer.username as string | undefined) ||
                  'Community host'
                const joining = joiningActivityIds.has(activity.id as string)

                return (
                  <Card key={activity.id as string} className="flex flex-col">
                    <div className="flex items-center justify-between gap-3">
                      <Badge className="min-w-0 max-w-full truncate">
                        {(activity.activity_type as string | undefined) || 'Group activity'}
                      </Badge>
                      <span className="shrink-0 text-xs text-brand-background/45">
                        {formatRelativeTime(activity.scheduled_at)}
                      </span>
                    </div>
                    <h2 className="mt-4 break-words text-xl font-semibold text-brand-background">
                      {activity.title as string}
                    </h2>
                    <p className="mt-2 break-words text-sm leading-relaxed text-brand-background/65">
                      {(activity.description as string | undefined) || 'A live community activity.'}
                    </p>
                    <div className="mt-4 space-y-2 text-xs text-brand-background/45">
                      <p className="flex items-start gap-1.5">
                        <i className="ri-user-heart-line mt-0.5 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 break-words">Hosted by {organizerName}</span>
                      </p>
                      {(activity.location as string | undefined) && (
                        <p className="flex items-start gap-1.5">
                          <i className="ri-map-pin-2-line mt-0.5 shrink-0" aria-hidden="true" />
                          <span className="min-w-0 break-words">{activity.location as string}</span>
                        </p>
                      )}
                      <p className="flex items-center gap-1.5">
                        <i className="ri-group-line" aria-hidden="true" />
                        {formatCompactNumber(activity.participants_count as number | undefined)} joined
                      </p>
                    </div>
                    <div className="mt-5 pt-1">
                      <Button
                        onClick={() => handleJoinActivity(activity.id as string)}
                        disabled={joining}
                        isLoading={joining}
                        fullWidth
                      >
                        {joining ? 'Joining…' : 'Join activity'}
                      </Button>
                    </div>
                  </Card>
                )
              })
            ) : (
              <EmptyState
                className="sm:col-span-2 lg:col-span-3"
                icon={<i className="ri-compass-3-line text-3xl" aria-hidden="true" />}
                title="No activities scheduled yet"
                description="Live activities and meetups will show up here. Check back soon for something to join."
                action={
                  <Button variant="secondary" onClick={() => setActiveTab('discussions')}>
                    Back to Discussions
                  </Button>
                }
              />
            )}
          </section>
        )}
      </div>

      <BottomNav />
    </PageFrame>
  )
}
