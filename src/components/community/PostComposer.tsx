'use client'

import { useCallback, useRef, useState } from 'react'
import ProfileAvatar from '@/components/ProfileAvatar'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { StorageService, detectMediaType } from '@/lib/storage'
import { Button, Card, Input, Textarea } from '@/components/ui'
import { cn } from '@/lib/cn'

type PendingMedia = { file: File; preview: string; type: 'image' | 'video' | 'audio' }

type PostComposerProps = {
  /** When set, the new post is scoped to this group. */
  groupId?: string | null
  /** Called after a post (or poll) is created so the caller can refresh its feed. */
  onPosted?: () => void | Promise<void>
}

/**
 * Self-contained post composer that mirrors the public community feed: text,
 * per-post anonymous toggle, image/video upload, voice-note recording, poll
 * mode, and emoji-friendly text. When `groupId` is provided the created post (or
 * poll) belongs to that group; otherwise it posts to the public feed.
 */
export default function PostComposer({ groupId, onPosted }: PostComposerProps) {
  const { user } = useAuth()
  const { push: toast } = useToast()

  const [newPostContent, setNewPostContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [anonymous, setAnonymous] = useState(false)

  // Poll mode
  const [pollMode, setPollMode] = useState(false)
  const [pollDraftOptions, setPollDraftOptions] = useState<string[]>(['', ''])
  const [pollMultiple, setPollMultiple] = useState(false)

  // Media attachments
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([])
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

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
          isAnonymous: anonymous,
          groupId: groupId ?? null,
        })
        setNewPostContent('')
        setPollDraftOptions(['', ''])
        setPollMultiple(false)
        setPollMode(false)
        await onPosted?.()
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
        anonymous,
        uploadedMedia.length > 0 ? uploadedMedia : undefined,
        groupId ?? null,
      )
      setNewPostContent('')
      // Clean up previews
      pendingMedia.forEach((item) => URL.revokeObjectURL(item.preview))
      setPendingMedia([])
      await onPosted?.()
      toast(groupId ? 'Posted to the group' : 'Post shared with the community', 'success')
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

    const newItems: PendingMedia[] = []
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

  return (
    <Card>
      <div className="flex items-start gap-3">
        <ProfileAvatar
          alt="Your profile"
          avatarUrl={user?.photoURL}
          className="h-12 w-12 rounded-2xl object-cover"
          fullName={user?.displayName || undefined}
          userId={user?.userId}
          email={user?.email}
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
                // eslint-disable-next-line @next/next/no-img-element
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
          <label className="flex items-center gap-1.5 text-[11px] text-brand-background/45">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(event) => setAnonymous(event.target.checked)}
              className="accent-brand-accent2"
            />
            Anonymous
          </label>
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
  )
}
