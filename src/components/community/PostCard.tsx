'use client'

import { useState } from 'react'
import ReportDialog from '@/components/ReportDialog'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { formatCompactNumber, formatRelativeTime } from '@/lib/platform'
import { getTopReactions, isEmoji, applyReactionMutation } from '@/lib/social'
import { Badge, Button, Card, Textarea } from '@/components/ui'
import { cn } from '@/lib/cn'
import { renderWithMentions } from '@/components/community/renderMentions'
import CommentReactions from '@/components/community/CommentReactions'
import ReactionSummaryButton from '@/components/community/ReactionSummaryButton'
import { MemberAvatar, MemberName } from '@/components/MemberIdentity'

export type PostShape = Record<string, unknown> & {
  id: string
  profile?: Record<string, unknown> | null
}

export type PollDto = {
  id: string
  question: string
  allow_multiple: boolean
  total_votes: number
  closed: boolean
  options: Array<{ id: string; label: string; votes_count: number }>
  my_option_ids: string[]
}

type CommentEntry = Record<string, unknown> & { id: string; profile: Record<string, unknown> | null }

type PostCardProps = {
  /** A hydrated post (snake_case shape) from getCommunityPosts / getGroupFeed. */
  post: PostShape
  /** The poll attached to this post, if it is a poll. */
  poll?: PollDto
  /** Emoji-reaction keys (`postId:emoji`) the current user has reacted with. */
  reacted: Set<string>
  /** Whether the current user has liked this post (seeds the like button). */
  initialLiked?: boolean
  /** Whether the current user has bookmarked this post (seeds the save button). */
  initialSaved?: boolean
  /** The signed-in user's id, for owner-only controls. */
  currentUserId?: string | null
  /** When true, the viewer is an admin/owner of this post's group and may pin it. */
  isGroupAdmin?: boolean
  /** Called after a change that affects the feed (delete, rekindle, pin-to-group). */
  onChanged?: () => void | Promise<void>
  className?: string
}

/**
 * One community/group post with full parity to the public feed: author, content,
 * edit/delete (author only), poll + voting, media (image/video/audio playback),
 * emoji reactions, rekindle, save/bookmark, and an inline comment thread.
 */
export default function PostCard({
  post,
  poll: initialPoll,
  reacted,
  initialLiked = false,
  initialSaved = false,
  currentUserId,
  isGroupAdmin = false,
  onChanged,
  className,
}: PostCardProps) {
  const { user } = useAuth()
  const { push: toast } = useToast()

  // Local mirror of mutable post fields so counts update without a full reload.
  const [livePost, setLivePost] = useState<PostShape>(post)
  const [poll, setPoll] = useState<PollDto | undefined>(initialPoll)
  const [userReactions, setUserReactions] = useState<Set<string>>(reacted)

  const [liked, setLiked] = useState(initialLiked)
  const [saved, setSaved] = useState(initialSaved)

  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  const [emojiInputOpen, setEmojiInputOpen] = useState(false)
  const [guideReplying, setGuideReplying] = useState(false)

  // Rekindle
  const [rekindling, setRekindling] = useState(false)
  const [rekindleOpen, setRekindleOpen] = useState(false)
  const [rekindleComment, setRekindleComment] = useState('')

  // Comments
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState<CommentEntry[] | null>(null)
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [commenting, setCommenting] = useState(false)
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [replyingToId, setReplyingToId] = useState<string | null>(null)

  // Pin-to-group (group admins only) + per-comment pin (post author only)
  const [pinningGroup, setPinningGroup] = useState(false)
  const [pinningCommentId, setPinningCommentId] = useState<string | null>(null)

  const postId = livePost.id
  const isOwner = Boolean(currentUserId && (livePost.user_id as string) === currentUserId)
  const isPinnedInGroup = Boolean(livePost.pinned_in_group_at)
  const inGroup = Boolean(livePost.group_id || livePost.group)
  const canPinToGroup = isGroupAdmin && inGroup
  const author = livePost.is_anonymous
    ? 'Anonymous'
    : (((livePost.profile as Record<string, unknown> | null)?.full_name as string | undefined) ||
        ((livePost.profile as Record<string, unknown> | null)?.username as string | undefined) ||
        'Community member')
  const postMedia = (livePost.media as Array<{ url: string; type: string }> | undefined) || []
  const rekindleOriginal = livePost.rekindle_original as Record<string, unknown> | undefined
  const profileData = livePost.profile as Record<string, unknown> | null

  async function handleVote(optionId: string) {
    if (!user || !poll) return
    if (poll.closed) return
    try {
      const updated = (await DatabaseService.votePoll(poll.id, optionId)) as PollDto | null
      if (updated) setPoll(updated)
    } catch (error) {
      console.error('Failed to vote:', error)
      toast('Could not record your vote', 'error')
    }
  }

  async function handleEditPost() {
    if (!user || !editContent.trim()) return
    setSaving(true)
    try {
      await DatabaseService.updatePost(postId, user.userId, { content: editContent.trim() })
      setLivePost((prev) => ({ ...prev, content: editContent.trim(), edited: true }))
      setEditing(false)
      setEditContent('')
      toast('Post updated', 'success')
    } catch (error) {
      console.error('Failed to edit post:', error)
      toast('Could not save edit', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePost() {
    if (!user) return
    if (typeof window !== 'undefined' && !window.confirm('Delete this post? This cannot be undone.')) return
    try {
      await DatabaseService.deletePost(postId, user.userId)
      await onChanged?.()
      toast('Post deleted', 'success')
    } catch (error) {
      console.error('Failed to delete post:', error)
      toast('Could not delete post', 'error')
    }
  }

  async function handleRekindle() {
    if (!user) return
    setRekindling(true)
    try {
      await DatabaseService.rekindlePost(postId, user.userId, rekindleComment.trim() || undefined)
      setRekindleOpen(false)
      setRekindleComment('')
      setLivePost((prev) => ({
        ...prev,
        rekindle_count: ((prev.rekindle_count as number | undefined) ?? 0) + 1,
      }))
      await onChanged?.()
      toast('Rekindled to your circle', 'success')
    } catch (error) {
      console.error('Failed to rekindle:', error)
      toast('Rekindle failed', 'error')
    } finally {
      setRekindling(false)
    }
  }

  async function handleToggleLike() {
    if (!user) return
    const previouslyLiked = liked
    setLiked(!previouslyLiked)
    setLivePost((prev) => ({
      ...prev,
      likes_count: Math.max(0, ((prev.likes_count as number | undefined) ?? 0) + (previouslyLiked ? -1 : 1)),
    }))
    try {
      await DatabaseService.togglePostLike(postId, user.userId)
    } catch (error) {
      console.error('Failed to toggle like:', error)
    }
  }

  async function handleToggleSave() {
    if (!user) return
    const wasSaved = saved
    setSaved(!wasSaved)
    try {
      const result = (await DatabaseService.toggleBookmark(postId)) as { saved: boolean }
      setSaved(result.saved)
      toast(result.saved ? 'Saved to your collection' : 'Removed from saved', 'success')
    } catch (error) {
      console.error('Failed to toggle bookmark:', error)
      setSaved(wasSaved)
      toast('Could not update saved', 'error')
    }
  }

  async function handleEmojiReaction(emoji: string) {
    if (!user || !isEmoji(emoji)) return
    const key = `${postId}:${emoji}`
    const wasActive = userReactions.has(key)
    setUserReactions((current) => {
      const next = new Set(current)
      if (wasActive) next.delete(key)
      else next.add(key)
      return next
    })
    setLivePost((prev) => applyReactionMutation(prev, emoji, !wasActive))
    setEmojiInputOpen(false)
    try {
      await DatabaseService.togglePostReaction(postId, user.userId, emoji)
    } catch (error) {
      console.error('Failed to toggle reaction:', error)
    }
  }

  function handleEmojiInput(value: string) {
    const emoji = value.trim()
    if (emoji && isEmoji(emoji)) handleEmojiReaction(emoji)
  }

  async function toggleComments() {
    const willOpen = !commentsOpen
    setCommentsOpen(willOpen)
    if (willOpen && comments === null) {
      setLoadingComments(true)
      try {
        const grouped = await DatabaseService.getCommentsForPosts([postId], 50)
        setComments(((grouped as Record<string, CommentEntry[]>)[postId]) ?? [])
      } catch (error) {
        console.error('Failed to load comments:', error)
        setComments([])
      } finally {
        setLoadingComments(false)
      }
    }
  }

  async function submitComment() {
    if (!user) return
    const draft = commentDraft.trim()
    if (!draft) return
    setCommenting(true)
    try {
      await DatabaseService.addPostComment(postId, user.userId, draft, Boolean(livePost.is_anonymous))
      const grouped = await DatabaseService.getCommentsForPosts([postId], 50)
      setComments(((grouped as Record<string, CommentEntry[]>)[postId]) ?? [])
      setLivePost((prev) => ({
        ...prev,
        comments_count: ((prev.comments_count as number | undefined) ?? 0) + 1,
      }))
      setCommentDraft('')
      setCommentsOpen(true)
      toast('Comment added', 'success')
    } catch (error) {
      console.error('Failed to comment:', error)
      toast('Could not add comment', 'error')
    } finally {
      setCommenting(false)
    }
  }

  async function submitCommentReply(parentId: string) {
    if (!user) return
    const draft = replyDraft.trim()
    if (!draft) return
    setReplyingToId(parentId)
    try {
      await DatabaseService.addPostComment(
        postId,
        user.userId,
        draft,
        Boolean(livePost.is_anonymous),
        parentId
      )
      const grouped = await DatabaseService.getCommentsForPosts([postId], 50)
      setComments(((grouped as Record<string, CommentEntry[]>)[postId]) ?? [])
      setLivePost((prev) => ({
        ...prev,
        comments_count: ((prev.comments_count as number | undefined) ?? 0) + 1,
      }))
      setReplyDraft('')
      setReplyToCommentId(null)
      toast('Reply added', 'success')
    } catch (error) {
      console.error('Failed to reply:', error)
      toast('Could not add reply', 'error')
    } finally {
      setReplyingToId(null)
    }
  }

  async function handleGuideReply() {
    if (!user) return
    setGuideReplying(true)
    try {
      await DatabaseService.requestGuidePostComment(postId, 'mira')
      const grouped = await DatabaseService.getCommentsForPosts([postId], 50)
      setComments(((grouped as Record<string, CommentEntry[]>)[postId]) ?? [])
      setLivePost((prev) => ({
        ...prev,
        comments_count: ((prev.comments_count as number | undefined) ?? 0) + 1,
      }))
      setCommentsOpen(true)
      toast('Guide replied', 'success')
    } catch (error) {
      console.error('Failed to ask Guide:', error)
      toast('Guide could not reply right now', 'error')
    } finally {
      setGuideReplying(false)
    }
  }

  async function handleTogglePinToGroup() {
    if (!user || !canPinToGroup) return
    const wasPinned = isPinnedInGroup
    setPinningGroup(true)
    try {
      if (wasPinned) {
        await DatabaseService.unpinPostToGroup(postId)
        setLivePost((prev) => ({ ...prev, pinned_in_group_at: null }))
        toast('Unpinned from the group', 'success')
      } else {
        await DatabaseService.pinPostToGroup(postId)
        setLivePost((prev) => ({ ...prev, pinned_in_group_at: new Date().toISOString() }))
        toast('Pinned to the top of the group', 'success')
      }
      await onChanged?.()
    } catch (error) {
      console.error('Failed to toggle group pin:', error)
      toast('Could not update pin', 'error')
    } finally {
      setPinningGroup(false)
    }
  }

  async function handleToggleCommentPin(comment: CommentEntry) {
    if (!user || !isOwner) return
    const wasPinned = Boolean(comment.pinned_at)
    setPinningCommentId(comment.id)
    try {
      if (wasPinned) {
        await DatabaseService.unpinComment(comment.id)
      } else {
        await DatabaseService.pinComment(comment.id)
      }
      // Reflect locally: at most one pinned comment per post.
      setComments((prev) =>
        (prev ?? []).map((entry) => ({
          ...entry,
          pinned_at: entry.id === comment.id ? (wasPinned ? null : new Date().toISOString()) : null,
        })),
      )
      toast(wasPinned ? 'Comment unpinned' : 'Comment pinned', 'success')
    } catch (error) {
      console.error('Failed to toggle comment pin:', error)
      toast('Could not update pin', 'error')
    } finally {
      setPinningCommentId(null)
    }
  }

  // Group comments into top-level and replies.
  const parentComments = (comments ?? []).filter((c) => !c.parent_id)
  const sortedParentComments = parentComments.slice().sort((a, b) => {
    const aPinned = a.pinned_at ? 1 : 0
    const bPinned = b.pinned_at ? 1 : 0
    return bPinned - aPinned
  })

  const getRepliesFor = (parentId: string) => {
    return (comments ?? [])
      .filter((c) => c.parent_id === parentId)
      .sort(
        (a, b) =>
          new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime()
      )
  }

  return (
    <Card id={`community-post-${postId}`} className={className}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-brand-background/10 text-sm font-bold text-brand-accent2">
          {livePost.is_anonymous ? (
            <i className="ri-spy-line text-base" aria-hidden="true" />
          ) : (
                              <MemberAvatar
                                profile={profileData}
                                alt={author}
                                avatarUrl={profileData?.avatar_url as string | undefined}
                                className="h-11 w-11 rounded-2xl object-cover"
                                fullName={profileData?.full_name as string | undefined}
                                isAnonymous={Boolean(livePost.is_anonymous)}
                                userId={profileData?.id as string | undefined}
                                username={profileData?.username as string | undefined}
                              />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 max-w-full truncate font-semibold text-brand-background">
                        <MemberName
                          profile={profileData}
                          name={author}
                          isAnonymous={Boolean(livePost.is_anonymous)}
                          showQuickAction={!isOwner}
                        />
                      </p>
            {isPinnedInGroup && (
              <Badge tone="accent" className="text-[10px]">
                <i className="ri-pushpin-fill" aria-hidden="true" /> Pinned
              </Badge>
            )}
            {livePost.type === 'rekindle' && (
              <Badge tone="accent" className="text-[10px]">
                <i className="ri-loop-left-line" aria-hidden="true" /> rekindled
              </Badge>
            )}
            {typeof livePost.type === 'string' && livePost.type !== 'rekindle' && (
              <Badge className="text-[10px] capitalize">{livePost.type as string}</Badge>
            )}
            {!!livePost.edited && (
              <span className="text-[10px] italic text-brand-background/35">edited</span>
            )}
          </div>
          <p className="text-xs text-brand-background/40">{formatRelativeTime(livePost.created_at)}</p>
        </div>
        {!editing && (canPinToGroup || isOwner || Boolean(currentUserId)) && (
          <div className="flex items-center gap-1">
            {canPinToGroup && (
              <button
                type="button"
                onClick={handleTogglePinToGroup}
                disabled={pinningGroup}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl transition-colors disabled:opacity-50',
                  isPinnedInGroup
                    ? 'text-brand-accent2 hover:bg-brand-accent2/10'
                    : 'text-brand-background/35 hover:bg-brand-background/8 hover:text-brand-accent2',
                )}
                aria-label={isPinnedInGroup ? 'Unpin from group' : 'Pin to top of group'}
                aria-pressed={isPinnedInGroup}
                title={isPinnedInGroup ? 'Unpin from group' : 'Pin to top of group'}
              >
                <i className={isPinnedInGroup ? 'ri-pushpin-fill text-sm' : 'ri-pushpin-line text-sm'} aria-hidden="true" />
              </button>
            )}
            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => { setEditing(true); setEditContent((livePost.content as string) || '') }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-brand-background/35 transition-colors hover:bg-brand-background/8 hover:text-brand-background/60"
                  aria-label="Edit post"
                  title="Edit post"
                >
                  <i className="ri-pencil-line text-sm" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleDeletePost}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-brand-background/35 transition-colors hover:bg-brand-accent1/10 hover:text-brand-accent1"
                  aria-label="Delete post"
                  title="Delete post"
                >
                  <i className="ri-delete-bin-line text-sm" aria-hidden="true" />
                </button>
              </>
            )}
            {Boolean(currentUserId) && !isOwner && (
              <ReportDialog
                targetType="post"
                targetId={postId}
                targetOwnerId={livePost.user_id as string | undefined}
                compact
                className="flex h-9 w-9 items-center justify-center rounded-xl text-brand-background/35 transition-colors hover:bg-brand-accent1/10 hover:text-brand-accent1"
              />
            )}
          </div>
        )}
      </div>

      {/* Post content or edit mode */}
      {editing ? (
        <div className="mt-3">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            aria-label="Edit post content"
            className="resize-none"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setEditContent('') }}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleEditPost}
              disabled={saving || !editContent.trim()}
              isLoading={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {(livePost.content as string)?.trim() && (
            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-brand-background/75">
              {renderWithMentions(livePost.content as string)}
            </p>
          )}
        </>
      )}

      {/* Poll */}
      {poll && (() => {
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
                  onClick={() => handleVote(option.id)}
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
              {(rekindleOriginal.author_name as string) || 'Someone'}
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
                    // eslint-disable-next-line @next/next/no-img-element
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
                // eslint-disable-next-line @next/next/no-img-element
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
      {getTopReactions(livePost).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {getTopReactions(livePost).map(({ emoji, count }) => {
            const isReacted = userReactions.has(`${postId}:${emoji}`)
            return (
              <ReactionSummaryButton
                key={emoji}
                emoji={emoji}
                count={count}
                active={isReacted}
                actors={(livePost.reactors as Record<string, string[]> | undefined)?.[emoji] ?? []}
                onClick={() => handleEmojiReaction(emoji)}
              />
            )
          })}
        </div>
      )}

      {/* Rekindle composer inline */}
      {rekindleOpen && (
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
            <Button variant="ghost" size="sm" onClick={() => { setRekindleOpen(false); setRekindleComment('') }}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRekindle}
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
          onClick={handleToggleLike}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-colors hover:bg-brand-background/8',
            liked ? 'text-brand-accent1' : 'text-brand-background/45',
          )}
          aria-label={liked ? 'Unlike post' : 'Like post'}
          aria-pressed={liked}
        >
          <i className={liked ? 'ri-heart-fill' : 'ri-heart-line'} aria-hidden="true" />
          {formatCompactNumber(livePost.likes_count as number | undefined)}
        </button>
        <button
          type="button"
          onClick={toggleComments}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-colors hover:bg-brand-background/8',
            commentsOpen ? 'text-brand-accent2' : 'text-brand-background/45 hover:text-brand-accent2',
          )}
          aria-label="Comments"
          aria-expanded={commentsOpen}
        >
          <i className="ri-chat-1-line" aria-hidden="true" />
          {formatCompactNumber(livePost.comments_count as number | undefined)}
        </button>

        <button
          type="button"
          onClick={handleGuideReply}
          disabled={guideReplying}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-brand-background/45 transition-colors hover:bg-brand-background/8 hover:text-brand-accent2 disabled:cursor-not-allowed disabled:opacity-45"
          aria-label="Ask Guide to reply"
          title="Ask Guide to reply"
        >
          <i className={guideReplying ? 'ri-loader-4-line animate-spin' : 'ri-sparkling-line'} aria-hidden="true" />
          <span className="hidden sm:inline">Guide</span>
        </button>

        {/* Rekindle button */}
        <button
          type="button"
          onClick={() => setRekindleOpen((open) => !open)}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-colors hover:bg-brand-background/8',
            rekindleOpen ? 'text-brand-accent2' : 'text-brand-background/45 hover:text-brand-accent2',
          )}
          aria-label="Rekindle"
        >
          <i className="ri-loop-left-line" aria-hidden="true" />
          {formatCompactNumber(livePost.rekindle_count as number | undefined)}
        </button>

        {/* Save / bookmark button */}
        <button
          type="button"
          onClick={handleToggleSave}
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
          {emojiInputOpen ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                inputMode="text"
                autoFocus
                aria-label="Type an emoji to react"
                className="w-12 rounded-full border border-brand-background/20 bg-brand-background/10 px-2 py-1 text-center text-base text-brand-background outline-none focus:border-brand-accent2/50"
                placeholder="?"
                onInput={(e) => {
                  const val = (e.target as HTMLInputElement).value
                  if (val) handleEmojiInput(val)
                }}
                onBlur={() => setTimeout(() => setEmojiInputOpen(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEmojiInputOpen(false)
                }}
              />
              <button
                type="button"
                onClick={() => setEmojiInputOpen(false)}
                className="text-xs text-brand-background/40"
                aria-label="Close emoji input"
              >
                <i className="ri-close-line" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEmojiInputOpen(true)}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-brand-background/45 transition-colors hover:bg-brand-background/8 hover:text-brand-accent2"
              aria-label="React with emoji"
              title="React with emoji"
            >
              <i className="ri-emotion-happy-line" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {commentsOpen && (
        <div className="mt-3 space-y-3 border-t border-brand-background/8 pt-3">
          {loadingComments ? (
            <p className="text-xs text-brand-background/45">Loading comments…</p>
          ) : sortedParentComments.length === 0 ? (
            <p className="text-xs text-brand-background/45">Be the first to reply.</p>
          ) : (
            <ul className="space-y-3">
              {sortedParentComments.map((comment) => {
                const authorProfile = comment.profile
                const commentAuthorName = comment.is_anonymous
                  ? 'Anonymous'
                  : ((authorProfile?.full_name as string | undefined) ||
                      (authorProfile?.username as string | undefined) ||
                      'Community member')
                const commentPinned = Boolean(comment.pinned_at)
                return (
                  <li key={comment.id} className="block">
                    <div className="flex gap-3">
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
                      <div className={cn(
                        'min-w-0 flex-1 rounded-2xl px-3 py-2',
                        commentPinned ? 'bg-brand-accent2/10 ring-1 ring-brand-accent2/25' : 'bg-brand-background/6',
                      )}>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-brand-background/50">
                                    <span className="min-w-0 max-w-full truncate font-semibold text-brand-background/80">
                                      <MemberName
                                        profile={authorProfile}
                                        name={commentAuthorName}
                                        isAnonymous={Boolean(comment.is_anonymous)}
                                      />
                                    </span>
                          {commentPinned && (
                            <Badge tone="accent" className="text-[9px]">
                              <i className="ri-pushpin-fill" aria-hidden="true" /> Pinned
                            </Badge>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="shrink-0">{formatRelativeTime(comment.created_at)}</span>
                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => handleToggleCommentPin(comment)}
                              disabled={pinningCommentId === comment.id}
                              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] text-brand-background/45 transition-colors hover:text-brand-accent2 disabled:opacity-50"
                              aria-label={commentPinned ? 'Unpin comment' : 'Pin comment'}
                              aria-pressed={commentPinned}
                              title={commentPinned ? 'Unpin comment' : 'Pin comment'}
                            >
                              <i className={commentPinned ? 'ri-pushpin-fill' : 'ri-pushpin-line'} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-brand-background/80">
                          {renderWithMentions(comment.content as string)}
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-brand-background/45">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyToCommentId(replyToCommentId === comment.id ? null : comment.id)
                              setReplyDraft('')
                            }}
                            className="hover:text-brand-accent2 transition-colors font-medium"
                          >
                            Reply
                          </button>
                        </div>
                        <CommentReactions
                          commentId={comment.id}
                          initialCounts={(comment.reaction_counts as Record<string, number> | undefined) ?? {}}
                          initialMine={(comment.my_reactions as string[] | undefined) ?? []}
                          reactors={(comment.reactors as Record<string, string[]> | undefined) ?? {}}
                          canReact={Boolean(user)}
                        />
                        {replyToCommentId === comment.id && (
                          <div className="mt-2.5 flex items-start gap-2 border-t border-brand-background/8 pt-2">
                            <Textarea
                              value={replyDraft}
                              onChange={(event) => setReplyDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                  event.preventDefault()
                                  void submitCommentReply(comment.id)
                                }
                              }}
                              placeholder="Write a reply…"
                              aria-label="Write a reply"
                              rows={1}
                              autoFocus
                              className="text-xs"
                            />
                            <Button
                              size="sm"
                              variant="accent"
                              onClick={() => submitCommentReply(comment.id)}
                              isLoading={replyingToId === comment.id}
                              className="h-8 shrink-0 text-xs px-3"
                            >
                              Send
                            </Button>
                          </div>
                        )}
                        {getRepliesFor(comment.id).length > 0 && (
                          <ul className="ml-2 mt-3 space-y-3 border-l border-brand-background/10 pl-3">
                            {getRepliesFor(comment.id).map((reply) => {
                              const replyAuthorProfile = reply.profile
                              const replyAuthorName = reply.is_anonymous
                                ? 'Anonymous'
                                : ((replyAuthorProfile?.full_name as string | undefined) ||
                                    (replyAuthorProfile?.username as string | undefined) ||
                                    'Community member')
                              return (
                                <li key={reply.id} className="flex gap-2 text-xs">
                                  <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-accent3/25 text-[10px] font-bold text-brand-accent3">
                                    {reply.is_anonymous ? (
                                      <i className="ri-spy-line text-xs" aria-hidden="true" />
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
                                  <div className="min-w-0 flex-1 rounded-xl bg-brand-background/4 px-2.5 py-1.5">
                                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-brand-background/40">
                                            <span className="font-semibold text-brand-background/70">
                                              <MemberName
                                                profile={replyAuthorProfile}
                                                name={replyAuthorName}
                                                isAnonymous={Boolean(reply.is_anonymous)}
                                              />
                                            </span>
                                      <span aria-hidden="true">·</span>
                                      <span className="shrink-0">{formatRelativeTime(reply.created_at)}</span>
                                    </div>
                                    <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-brand-background/80">
                                      {renderWithMentions(reply.content as string)}
                                    </p>
                                    <CommentReactions
                                      commentId={reply.id}
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
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="flex items-start gap-2">
            <Textarea
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void submitComment()
                }
              }}
              placeholder="Write a supportive reply…"
              aria-label="Write a reply"
              rows={1}
              className="flex-1 resize-none !py-2.5"
            />
            <Button
              onClick={() => void submitComment()}
              disabled={commenting || !commentDraft.trim()}
              isLoading={commenting}
            >
              {commenting ? 'Sending…' : 'Reply'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
