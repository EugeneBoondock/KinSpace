'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import { SunlitCanopy } from '@/components/SunlitCanopy'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { getCachedProfile, updateCachedProfile } from '@/lib/profile-cache'
import { detectConcern, toDate } from '@/lib/platform'
import { cn } from '@/lib/cn'
import { AmbientEngine, type AmbientPreset } from '@/lib/audio/ambient'
import { useSpeechInput, useSpeechOutput } from '@/lib/voice/useSpeech'
import {
  THERAPIST_PERSONAS,
  THERAPY_THEMES,
  MOOD_OPTIONS,
  STARTER_CHIPS,
  getPersona,
  getTheme,
  type MoodOption,
  type TherapistPersona,
  type TherapyTheme,
} from '@/lib/therapy-config'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: Date
}

// Shapes returned by the session-history data methods (snake_cased on the wire).
type SessionSummaryRow = {
  id: string
  persona: string | null
  theme: string | null
  moodAtStart: string | null
  moodAtEnd: string | null
  summary: string | null
  keyThemes: string[]
  startedAt: string | null
  endedAt: string | null
  messageCount: number
}

type TranscriptRow = {
  id: string
  message: string
  isAi: boolean
  senderId: string
  createdAt: string | null
}

type ActiveSessionRow = {
  id: string
  persona: string | null
  theme: string | null
  moodAtStart: string | null
  startedAt: string | null
  updatedAt: string | null
  messages: Array<{
    id: string
    role: 'user' | 'assistant'
    content: string
    createdAt: string | null
  }>
}

type View = 'loading' | 'onboard' | 'empty' | 'chat'

function ambientPresetForTheme(id: string): AmbientPreset {
  // Every room maps to a NATURAL soundscape (never the synth drone).
  const map: Record<string, AmbientPreset> = {
    rainfall: 'rain',
    cabin: 'fire',
    sunrise: 'forest',
    moonlit: 'ocean',
    dusk: 'wind',
    default: 'forest',
  }
  return map[id] ?? 'forest'
}

function ambientIntensityForMood(mood: string | null): number {
  return mood && ['heavy', 'overwhelmed', 'sad', 'numb'].includes(mood) ? 0.7 : 1
}

function firstNameFrom(profile: Record<string, unknown> | null): string {
  if (!profile) return ''
  const full =
    (profile.full_name as string | undefined) || (profile.username as string | undefined) || ''
  return full.split(' ')[0] ?? ''
}

function PersonaAvatar({
  persona,
  size = 44,
  theme,
}: {
  persona: TherapistPersona
  size?: number
  theme?: TherapyTheme
}) {
  const [errored, setErrored] = useState(false)
  const dim = { width: size, height: size }
  if (errored) {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${theme?.accent ?? '#D19A58'}, ${
            theme?.userBubble ?? '#eedfc8'
          })`,
        }}
        className="flex shrink-0 items-center justify-center rounded-full text-sm font-bold text-brand-primary shadow-md"
      >
        {persona.avatarFallback}
      </div>
    )
  }
  return (
    <Image
      src={persona.avatarSrc}
      alt={persona.name}
      width={dim.width}
      height={dim.height}
      className="shrink-0 rounded-full object-cover shadow-md"
      onError={() => setErrored(true)}
      unoptimized
    />
  )
}

export default function TherapyPage() {
  const { user, loading: authLoading } = useAuth()
  const { push: toast } = useToast()

  const [view, setView] = useState<View>('loading')
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [moodAtStart, setMoodAtStart] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [showCrisisSheet, setShowCrisisSheet] = useState(false)
  const [showBreathing, setShowBreathing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // ── Session history (read-only replay of past sessions) ──────────
  const [showHistory, setShowHistory] = useState(false)
  const [sessions, setSessions] = useState<SessionSummaryRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [openSession, setOpenSession] = useState<SessionSummaryRow | null>(null)
  const [sessionMessages, setSessionMessages] = useState<TranscriptRow[]>([])
  const [loadingTranscript, setLoadingTranscript] = useState(false)
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null)

  const [personaId, setPersonaId] = useState<string>('mira')
  const [themeId, setThemeId] = useState<string>('default')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sessionIdRef = useRef<string | null>(null)
  const creatingSessionRef = useRef<Promise<string | null> | null>(null)

  const persona = useMemo(() => getPersona(personaId), [personaId])
  const theme = useMemo(() => getTheme(themeId), [themeId])

  const roomId = user ? `guided-support-${user.userId}` : null
  const firstName = useMemo(() => firstNameFrom(profile), [profile])

  const [readAloud, setReadAloud] = useState(false)
  const [ambientOn, setAmbientOn] = useState(false)
  const [feedbackByMsg, setFeedbackByMsg] = useState<Record<string, 'up' | 'down'>>({})
  const [feedbackOpenFor, setFeedbackOpenFor] = useState<string | null>(null)
  const ambientRef = useRef<AmbientEngine | null>(null)
  const { speak, cancel: cancelSpeech } = useSpeechOutput()
  const {
    supported: micSupported,
    listening,
    start: startDictation,
    stop: stopDictation,
  } = useSpeechInput((text) => setInputValue((current) => (current ? `${current} ${text}` : text)))

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  function toggleAmbient() {
    if (!ambientRef.current) ambientRef.current = new AmbientEngine()
    const engine = ambientRef.current
    if (ambientOn) {
      engine.stop()
      setAmbientOn(false)
    } else {
      void engine.start(ambientPresetForTheme(themeId), ambientIntensityForMood(moodAtStart))
      setAmbientOn(true)
    }
  }

  async function sendMessageFeedback(messageId: string, content: string, value: 'up' | 'down', reason?: string) {
    setFeedbackByMsg((current) => ({ ...current, [messageId]: value }))
    setFeedbackOpenFor(value === 'down' && !reason ? messageId : null)
    try {
      await DatabaseService.recordTherapyFeedback({
        sessionId,
        value,
        reason: reason ?? null,
        snippet: content.slice(0, 300),
      })
    } catch {
      // Best-effort feedback.
    }
  }

  useEffect(() => {
    if (ambientOn && ambientRef.current) {
      ambientRef.current.setPreset(ambientPresetForTheme(themeId), ambientIntensityForMood(moodAtStart))
    }
  }, [themeId, moodAtStart, ambientOn])

  useEffect(
    () => () => {
      ambientRef.current?.stop()
      cancelSpeech()
    },
    [cancelSpeech])

  // ── Voice, ambient sound, and per-message feedback ───────────────
  // Keep the ambient texture in sync with the room theme + mood while it plays.
  // ── Load profile + previous messages + resolve view state ─────────
  useEffect(() => {
    async function load() {
      if (!user || !roomId) {
        setView('loading')
        return
      }
      try {
        const [cachedProfile, activeSession] = await Promise.all([
          getCachedProfile(user.userId),
          DatabaseService.getActiveTherapySession(user.userId),
        ])
        setProfile(cachedProfile)

        const active = activeSession as ActiveSessionRow | null
        const savedPersona = active?.persona ?? (cachedProfile?.therapist_persona as string | undefined) ?? null
        const savedTheme = active?.theme ?? (cachedProfile?.therapy_theme as string | undefined) ?? null
        if (savedPersona) setPersonaId(savedPersona)
        if (savedTheme) setThemeId(savedTheme)
        setSessionId(active?.id ?? null)
        sessionIdRef.current = active?.id ?? null
        setMoodAtStart(active?.moodAtStart ?? null)

        const restored = (active?.messages ?? []).map((message) => ({
          id: message.id as string,
          role: message.role,
          content: message.content,
          created_at: toDate(message.createdAt) || new Date(),
        }))
        setMessages(restored)

        if (!savedPersona) {
          setView('onboard')
        } else if (restored.some((message) => message.role === 'user')) {
          setView('chat')
        } else {
          setView('empty')
        }
      } catch (error) {
        console.error('Failed to load therapy:', error)
        setView('empty')
      }
    }
    if (!authLoading) void load()
  }, [authLoading, roomId, user])

  // ── Autoscroll ──────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  // ── Autosize textarea ───────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [inputValue])

  // ── Persona + theme commit ──────────────────────────────────────
  const chooseAndPersist = useCallback(
    async (nextPersona: string, nextTheme: string) => {
      if (!user) return
      setPersonaId(nextPersona)
      setThemeId(nextTheme)
      try {
        await DatabaseService.updateProfile(user.userId, {
          therapist_persona: nextPersona,
          therapy_theme: nextTheme,
        })
        updateCachedProfile(user.userId, {
          therapist_persona: nextPersona,
          therapy_theme: nextTheme,
        })
      } catch (error) {
        console.error('Failed to save persona/theme:', error)
      }
    },
    [user])

  // ── Session start (lazy - first time the user actually sends) ────
  // Guard against creating duplicate sessions: `sessionId` is React state, so two
  // messages sent in quick succession both read it as null and each start a new
  // session. A ref is updated synchronously, and an in-flight promise dedupes
  // concurrent calls.

  const ensureSession = useCallback(
    async (mood: string | null): Promise<string | null> => {
      if (sessionIdRef.current) return sessionIdRef.current
      if (creatingSessionRef.current) return creatingSessionRef.current
      if (!user) return null
      const creation = (async () => {
        try {
          const { id } = await DatabaseService.startTherapySession(user.userId, {
            persona: personaId,
            theme: themeId,
            mood,
          })
          sessionIdRef.current = id
          setSessionId(id)
          setMoodAtStart(mood)
          return id
        } catch (error) {
          console.error('Failed to start session:', error)
          return null
        } finally {
          creatingSessionRef.current = null
        }
      })()
      creatingSessionRef.current = creation
      return creation
    },
    [personaId, themeId, user])

  // ── Send ────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (content: string, moodForStart: string | null = null, options: { forceNewSession?: boolean } = {}) => {
      const trimmed = content.trim()
      if (!trimmed || !user || !roomId) return

      const baseMessages = options.forceNewSession ? [] : messages
      if (options.forceNewSession) {
        sessionIdRef.current = null
        setSessionId(null)
        setMoodAtStart(moodForStart)
        setMessages([])
      }
      const sid = (await ensureSession(options.forceNewSession ? moodForStart : moodForStart ?? moodAtStart)) ?? null
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        created_at: new Date(),
      }

      if (detectConcern(trimmed) === 'crisis') setShowCrisisSheet(true)

      setMessages((current) => options.forceNewSession ? [userMessage] : [...current, userMessage])
      setInputValue('')
      setSending(true)
      setSessionEnded(false)
      setView('chat')

      void DatabaseService.sendMessage(user.userId, null, roomId, userMessage.content, false, sid).catch(
        (error) => console.error('Failed to save user message:', error))

      const history = [...baseMessages, userMessage].map((message) => ({
        role: message.role,
        content: message.content,
      }))

      try {
        const response = await fetch('/api/therapy/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.userId,
            messages: history,
            profileCache: profile,
            sessionId: sid,
            personaId,
          }),
        })
        const data = (await response.json().catch(() => null)) as
          | { ok: boolean; reply?: string; isCrisis?: boolean; endSession?: boolean; error?: string }
          | null

        if (!response.ok || !data?.ok || !data.reply) {
          throw new Error(data?.error ?? 'Therapy chat failed')
        }

        if (data.isCrisis) setShowCrisisSheet(true)

        const guideMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.reply,
          created_at: new Date(),
        }
        const closing = [...baseMessages, userMessage, guideMessage]
        setMessages((current) => [...current, guideMessage])
        if (readAloud) speak(data.reply, persona.gender)

        void DatabaseService.sendMessage('guided-support', null, roomId, guideMessage.content, true, sid).catch(
          (error) => console.error('Failed to save guide reply:', error))

        // Either side asked to wrap up: summarise the session and reset so the
        // next message opens a fresh one. The transcript stays on screen.
        if (data.endSession && sid) {
          setSessionEnded(true)
          setSessionId(null)
          setMoodAtStart(null)
          void fetch('/api/therapy/end-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: sid,
              personaName: persona.name,
              moodAtStart,
              messages: closing.slice(-40).map((message) => ({ role: message.role, content: message.content })),
            }),
          }).catch(() => undefined)
        }
      } catch (error) {
        console.error('Therapy chat error:', error)
        toast('I could not respond just now. Try again?', 'error')
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content:
              'I am having trouble reaching the model right now. Give me a moment, or tap "Need a human?" above if something urgent is happening.',
            created_at: new Date(),
          },
        ])
      } finally {
        setSending(false)
      }
    },
    [
      ensureSession,
      messages,
      moodAtStart,
      persona.gender,
      persona.name,
      personaId,
      profile,
      readAloud,
      roomId,
      speak,
      toast,
      user,
    ])

  // A daily check-in can hand off a contextual opener (stashed in sessionStorage
  // by the dashboard popup). Consume it once the room is ready and send it so the
  // Guide opens in context. Guarded so it never fires twice.
  const starterConsumedRef = useRef(false)
  useEffect(() => {
    if (starterConsumedRef.current) return
    if (view !== 'empty' && view !== 'chat') return
    if (typeof window === 'undefined') return
    let starter: string | null = null
    try {
      starter = window.sessionStorage.getItem('kinspace:therapy-starter')
    } catch {
      starter = null
    }
    if (!starter) return
    starterConsumedRef.current = true
    try {
      window.sessionStorage.removeItem('kinspace:therapy-starter')
    } catch {
      // ignore
    }
    void sendMessage(starter, null, { forceNewSession: true })
  }, [view, sendMessage])

  function handleMoodPick(mood: MoodOption) {
    void sendMessage(mood.starterPhrase, mood.id)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage(inputValue)
    }
  }

  // ── Session history handlers ────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!user) return
    setLoadingHistory(true)
    try {
      const rows = (await DatabaseService.getTherapySessionHistory(user.userId)) as SessionSummaryRow[]
      setSessions(Array.isArray(rows) ? rows : [])
    } catch {
      toast('Could not load your session history.', 'error')
    } finally {
      setLoadingHistory(false)
    }
  }, [toast, user])

  function openHistory() {
    setShowHistory(true)
    void loadHistory()
  }

  // Load history on mount too, so the empty-state can offer a "pick up where we
  // left off" recap from the most recent session (continuity is the #1 ask).
  useEffect(() => {
    if (user) void loadHistory()
  }, [user, loadHistory])

  useEffect(() => {
    if (typeof window === 'undefined' || !user) return
    if (new URLSearchParams(window.location.search).get('history') === '1') {
      setShowHistory(true)
      void loadHistory()
    }
  }, [user, loadHistory])

  const lastSession = sessions[0]
  const lastTheme = lastSession?.keyThemes?.[0] ?? null

  const openSessionTranscript = useCallback(
    async (session: SessionSummaryRow) => {
      setOpenSession(session)
      setSessionMessages([])
      setLoadingTranscript(true)
      try {
        const rows = (await DatabaseService.getTherapySessionMessages(session.id)) as TranscriptRow[]
        setSessionMessages(Array.isArray(rows) ? rows : [])
      } catch {
        toast('Could not open that session.', 'error')
      } finally {
        setLoadingTranscript(false)
      }
    },
    [toast])

  const deleteSessionMessage = useCallback(
    async (messageId: string) => {
      setDeletingMessageId(messageId)
      try {
        const response = await fetch('/api/therapy/message/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId }),
        })
        const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null
        if (!response.ok || !data?.ok) throw new Error(data?.error ?? 'Delete failed')
        setSessionMessages((current) => current.filter((row) => row.id !== messageId))
        void loadHistory()
        toast('Deleted, and erased from your Guide’s memory.', 'success')
      } catch {
        toast('Could not delete that message.', 'error')
      } finally {
        setDeletingMessageId(null)
      }
    },
    [loadHistory, toast])

  // ── Render ──────────────────────────────────────────────────────
  const pageStyle: React.CSSProperties = {
    background: theme.pageBackground,
    minHeight: '100dvh',
    overflowX: 'hidden',
    width: '100%',
    maxWidth: '100vw',
  }

  // Summarise + close the current session (mirrors the auto-end + tab-close hook),
  // then clear the live session id so the next message opens a fresh one.
  async function endActiveSession(options?: { silent?: boolean }) {
    const sid = sessionId
    const enoughToSummarise = messages.filter((message) => message.role === 'user').length >= 2
    if (sid && user && enoughToSummarise) {
      try {
        await fetch('/api/therapy/end-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sid,
            personaName: persona.name,
            moodAtStart,
            messages: messages.slice(-40).map((message) => ({ role: message.role, content: message.content })),
          }),
        })
      } catch {
        // best-effort; the tab-close hook is a fallback
      }
    }
    sessionIdRef.current = null
    setSessionId(null)
    if (!options?.silent) toast('Session ended and saved to your history.', 'success')
  }

  async function handleEndSession() {
    if (sessionEnded) return
    await endActiveSession()
    setSessionEnded(true)
  }

  async function handleNewSession() {
    await endActiveSession({ silent: true })
    setMessages([])
    setSessionEnded(false)
    setMoodAtStart(null)
    setInputValue('')
    setView('empty')
    toast('Fresh session ready when you are.', 'success')
  }

  if (view === 'loading' || authLoading) {
    return (
      <div style={pageStyle} className="px-3 pb-28 pt-6 sm:px-4 md:pb-24">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <div className="h-24 skeleton rounded-3xl" />
          <div className="h-[28rem] skeleton rounded-3xl" />
        </div>
        <BottomNav />
      </div>
    )
  }

  // ── Onboarding: pick a Guide + scenery ──────────────────────────
  if (view === 'onboard') {
    return (
      <div style={pageStyle} className="px-3 pb-28 pt-6 sm:px-4 md:pb-24">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="text-center">
            <p
              className="text-xs font-semibold uppercase tracking-[0.18em]"
              style={{ color: theme.mutedColor }}
            >
              A room of your own
            </p>
            <h1
              className="mt-2 text-3xl font-bold md:text-4xl"
              style={{ color: theme.headingColor }}
            >
              Who would you like to talk to?
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm" style={{ color: theme.bodyColor }}>
              Pick a Guide whose voice feels easiest to sit with. You can change it anytime.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {THERAPIST_PERSONAS.map((option) => {
              const selected = option.id === personaId
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPersonaId(option.id)}
                  aria-pressed={selected}
                  className="rounded-3xl border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                  style={{
                    borderColor: selected ? theme.accent : 'rgba(238,223,200,0.1)',
                    background: selected ? theme.accentSoft : theme.cardBackground,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <PersonaAvatar persona={option} size={56} theme={theme} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold" style={{ color: theme.headingColor }}>
                          {option.name}
                        </p>
                        <span className="text-xs" style={{ color: theme.mutedColor }}>
                          {option.pronouns} · {option.ageBand}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm" style={{ color: theme.bodyColor }}>
                        {option.tagline}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {option.toneWords.map((word) => (
                          <span
                            key={word}
                            className="rounded-full px-2 py-0.5 text-[10px]"
                            style={{
                              background: theme.accentSoft,
                              color: theme.accent,
                            }}
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="space-y-3">
            <p
              className="text-xs font-semibold uppercase tracking-[0.18em]"
              style={{ color: theme.mutedColor }}
            >
              Pick the feel of the room
            </p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {THERAPY_THEMES.map((option) => {
                const selected = option.id === themeId
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setThemeId(option.id)}
                    aria-pressed={selected}
                    className="rounded-2xl border-2 p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                    style={{
                      borderColor: selected ? option.accent : 'rgba(238,223,200,0.1)',
                      background: option.pageBackground,
                    }}
                  >
                    <p className="font-semibold" style={{ color: option.headingColor }}>
                      {option.name}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: option.mutedColor }}>
                      {option.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={async () => {
                await chooseAndPersist(personaId, themeId)
                setView('empty')
              }}
              className="rounded-2xl px-5 py-3 text-sm font-semibold shadow-md transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
              style={{ background: theme.accent, color: theme.userBubbleText }}
            >
              Step into the room →
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  // ── Empty state: greeting + mood emoji picker ───────────────────
  if (view === 'empty') {
    return (
      <div style={pageStyle} className="px-3 pb-28 pt-6 sm:px-4 md:pb-24">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 pt-4 md:pt-10">
          {/* Persona header */}
          <div className="flex flex-col items-center gap-3">
            <PersonaAvatar persona={persona} size={88} theme={theme} />
            <div className="text-center">
              <p
                className="text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ color: theme.mutedColor }}
              >
                Private with {persona.name}
              </p>
              <h1 className="mt-1 text-2xl font-bold md:text-3xl" style={{ color: theme.headingColor }}>
                {firstName ? `Hi ${firstName},` : 'You found the room.'}
              </h1>
              <p className="mt-2 max-w-md text-sm leading-relaxed" style={{ color: theme.bodyColor }}>
                {persona.openerLine}
              </p>
            </div>
          </div>

          {/* Continuity: pick up the most recent session's theme */}
          {lastTheme && (
            <button
              type="button"
              onClick={() => void sendMessage(`Last time we talked about ${lastTheme}. Can we pick that up?`)}
              disabled={sending}
              className="flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all hover:scale-[1.02] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
              style={{ borderColor: 'rgba(238,223,200,0.2)', background: theme.cardBackground, color: theme.bodyColor }}
            >
              <i className="ri-history-line" style={{ color: theme.accent }} aria-hidden="true" />
              Pick up where we left off, {lastTheme}
            </button>
          )}

          {/* Mood picker */}
          <div className="w-full">
            <p
              className="text-center text-xs font-semibold uppercase tracking-[0.18em]"
              style={{ color: theme.mutedColor }}
            >
              Pick how you&apos;re arriving
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {MOOD_OPTIONS.map((mood) => (
                <button
                  key={mood.id}
                  type="button"
                  onClick={() => handleMoodPick(mood)}
                  disabled={sending}
                  className="flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center transition-all hover:scale-[1.03] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                  style={{
                    borderColor: 'rgba(238,223,200,0.12)',
                    background: theme.cardBackground,
                  }}
                >
                  <span className="text-2xl">{mood.emoji}</span>
                  <span className="text-[11px] font-medium" style={{ color: theme.bodyColor }}>
                    {mood.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-xs" style={{ color: theme.mutedColor }}>
              or just start typing below - no mood required.
            </p>
          </div>

          {/* Starter chips - lower the blank-page barrier, steer the kind of support wanted */}
          <div className="w-full">
            <p
              className="text-center text-xs font-semibold uppercase tracking-[0.18em]"
              style={{ color: theme.mutedColor }}
            >
              Or start with
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {STARTER_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => void sendMessage(chip)}
                  disabled={sending}
                  className="rounded-full px-3.5 py-2 text-sm font-medium transition-all hover:scale-[1.03] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                  style={{ background: theme.accentSoft, color: theme.accent }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Action strip: breathe / crisis / settings */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setShowBreathing(true)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
              style={{ background: theme.accentSoft, color: theme.accent }}
            >
              <i className="ri-leaf-line" aria-hidden="true" /> Breathe
            </button>
            <button
              type="button"
              onClick={() => setShowCrisisSheet(true)}
              className="flex items-center gap-1.5 rounded-full bg-brand-accent1/20 px-3 py-1.5 text-xs font-medium text-brand-accent1 transition-colors hover:bg-brand-accent1/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
            >
              <i className="ri-heart-3-line" aria-hidden="true" /> Need a human?
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
              style={{ background: 'rgba(238,223,200,0.08)', color: theme.bodyColor }}
            >
              <i className="ri-settings-3-line" aria-hidden="true" /> Guide &amp; scenery
            </button>
          </div>

          {/* Inline composer - shown from the jump, no scrolling required */}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void sendMessage(inputValue)
            }}
            className="w-full"
          >
            <div
              className="flex items-end gap-2 rounded-3xl border px-3 py-2"
              style={{
                borderColor: 'rgba(238,223,200,0.12)',
                background: theme.cardBackground,
              }}
            >
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                maxLength={4000}
                placeholder={`Tell ${persona.name} what's happening. No pressure.`}
                disabled={sending}
                className="max-h-60 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-relaxed focus:outline-none disabled:opacity-50"
                style={{ color: theme.headingColor }}
              />
              {micSupported && (
                <button
                  type="button"
                  onClick={() => (listening ? stopDictation() : startDictation())}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                  style={{
                    borderColor: 'rgba(238,223,200,0.25)',
                    background: listening ? theme.accent : 'transparent',
                    color: listening ? theme.userBubbleText : theme.bodyColor,
                  }}
                  aria-label={listening ? 'Stop voice input' : 'Speak your message'}
                  aria-pressed={listening}
                  title="Voice input"
                >
                  <i className={listening ? 'ri-mic-fill animate-pulse' : 'ri-mic-line'} aria-hidden="true" />
                </button>
              )}
              <button
                type="submit"
                disabled={!inputValue.trim() || sending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-md transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                style={{ background: theme.accent, color: theme.userBubbleText }}
                aria-label="Send"
              >
                <i className="ri-send-plane-2-fill text-lg" />
              </button>
            </div>
          </form>

          <p className="text-center text-[10px]" style={{ color: theme.mutedColor }}>
            {persona.name} remembers past sessions, your conditions, access needs, and today&rsquo;s mood.
            Nothing in this room is medical advice.
          </p>
        </div>
        {renderOverlays()}
        <BottomNav />
      </div>
    )
  }

  // ── Full chat view ─────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden pt-3 sm:pt-6"
      style={{ height: '100dvh' }}
    >
      {/* Ambient scenery: an optional background image, softly tinted by the active
          theme. If the image is absent the theme gradient is the built-in fallback,
          so the room still feels calm and intentional. Drop a PNG at the path below
          (per theme: ambient-<themeId>.png) and it lights up automatically. */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: `url('/images/therapy/ambient-${theme.id}.png') center / cover no-repeat, url('/images/therapy/ambient-default.png') center / cover no-repeat, ${theme.pageBackground}`,
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: theme.pageBackground, opacity: 0.5 }}
        aria-hidden="true"
      />
      {/* Living light: animated window-blind shadows + wind-swayed leaf shadows,
          layered on top of the ambient image so the still scenery breathes. */}
      <SunlitCanopy />
      {/* Full-width column so the scroll container's scrollbar sits at the screen
          edge. Offset by the sidebar on desktop; each row centers its own content
          at max-w-6xl. */}
      <div className="relative z-10 flex h-full flex-col gap-3 pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-4 md:pl-64">
        {/* Header strip - icons on mobile, pills on desktop. shrink-0 keeps the
            therapist name pinned at the top; it never scrolls away. */}
        <div className="mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between gap-2 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <PersonaAvatar persona={persona} size={40} theme={theme} />
            <div className="min-w-0">
              <p
                className="truncate text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: theme.mutedColor }}
              >
                Private with {persona.name}
              </p>
              <h1 className="truncate text-base font-semibold" style={{ color: theme.headingColor }}>
                {firstName ? `Hi ${firstName}` : 'A place to land'}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={toggleAmbient}
              className="flex h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
              style={{
                background: ambientOn ? theme.accentSoft : 'rgba(20,28,24,0.55)',
                borderColor: 'rgba(238,223,200,0.2)',
                color: ambientOn ? theme.accent : theme.headingColor,
              }}
              aria-label={ambientOn ? 'Turn off ambient sound' : 'Turn on ambient sound'}
              aria-pressed={ambientOn}
              title="Ambient sound"
            >
              <i className={ambientOn ? 'ri-volume-up-line' : 'ri-volume-mute-line'} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (readAloud) cancelSpeech()
                setReadAloud((on) => !on)
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
              style={{
                background: readAloud ? theme.accentSoft : 'rgba(20,28,24,0.55)',
                borderColor: 'rgba(238,223,200,0.2)',
                color: readAloud ? theme.accent : theme.headingColor,
              }}
              aria-label={readAloud ? 'Turn off read aloud' : 'Read replies aloud'}
              aria-pressed={readAloud}
              title="Read replies aloud"
            >
              <i className="ri-speak-line" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void handleNewSession()}
              className="flex h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 sm:h-auto sm:w-auto sm:gap-1 sm:px-3 sm:py-1.5 text-xs font-semibold"
              style={{ background: 'rgba(20,28,24,0.55)', borderColor: 'rgba(238,223,200,0.2)', color: theme.headingColor }}
              aria-label="Start a new session"
            >
              <i className="ri-add-line" aria-hidden="true" />
              <span className="hidden sm:inline">New</span>
            </button>
            {!sessionEnded && messages.length > 0 && (
              <button
                type="button"
                onClick={() => void handleEndSession()}
                className="flex h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 sm:h-auto sm:w-auto sm:gap-1 sm:px-3 sm:py-1.5 text-xs font-semibold"
                style={{ background: 'rgba(20,28,24,0.55)', borderColor: 'rgba(238,223,200,0.2)', color: theme.headingColor }}
                aria-label="End this session"
              >
                <i className="ri-stop-circle-line" aria-hidden="true" />
                <span className="hidden sm:inline">End</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowBreathing(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 sm:h-auto sm:w-auto sm:gap-1 sm:px-3 sm:py-1.5 text-xs font-semibold"
              style={{ background: 'rgba(20,28,24,0.55)', borderColor: 'rgba(238,223,200,0.24)', color: theme.accent }}
              aria-label="Breathe"
            >
              <i className="ri-leaf-line" aria-hidden="true" />
              <span className="hidden sm:inline">Breathe</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCrisisSheet(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-accent1 text-white shadow-md transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 sm:h-auto sm:w-auto sm:gap-1 sm:px-3 sm:py-1.5 text-xs font-semibold"
              aria-label="Need a human?"
            >
              <i className="ri-heart-3-line" aria-hidden="true" />
              <span className="hidden sm:inline">Human?</span>
            </button>
            <button
              type="button"
              onClick={openHistory}
              className="flex h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 sm:h-auto sm:w-auto sm:gap-1 sm:px-3 sm:py-1.5 text-xs font-semibold"
              style={{ background: 'rgba(20,28,24,0.55)', borderColor: 'rgba(238,223,200,0.2)', color: theme.headingColor }}
              aria-label="Past sessions"
            >
              <i className="ri-history-line" aria-hidden="true" />
              <span className="hidden sm:inline">History</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
              style={{ background: 'rgba(20,28,24,0.55)', borderColor: 'rgba(238,223,200,0.2)', color: theme.headingColor }}
              aria-label="Guide & scenery"
            >
              <i className="ri-settings-3-line" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Open room: no container card. The conversation flows directly over the
            ambient scenery; each message carries its own frosted card so the room
            stays visible behind. */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-6xl space-y-5 px-3 py-2 sm:px-4">
            {messages.map((message, index) => {
              const prev = messages[index - 1]
              const showAvatar = message.role === 'assistant' && (!prev || prev.role !== 'assistant')
              return (
                <div
                  key={message.id}
                  className={`message-fade flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="flex max-w-[90%] items-end gap-2">
                    {message.role === 'assistant' && showAvatar && (
                      <PersonaAvatar persona={persona} size={32} theme={theme} />
                    )}
                    {message.role === 'assistant' && !showAvatar && <div className="h-8 w-8 shrink-0" />}
                    <div
                      className="rounded-[1.5rem] border px-4 py-3 text-[15px] leading-relaxed shadow-lg backdrop-blur-md"
                      style={
                        message.role === 'user'
                          ? {
                              background: theme.userBubble,
                              color: theme.userBubbleText,
                              borderColor: 'rgba(0,0,0,0.08)',
                              borderBottomRightRadius: '0.5rem',
                            }
                          : {
                              background: theme.cardBackground,
                              color: theme.headingColor,
                              borderColor: 'rgba(238,223,200,0.16)',
                              borderBottomLeftRadius: '0.5rem',
                            }
                      }
                    >
                      <p className="whitespace-pre-line">{message.content}</p>
                    </div>
                    {message.role === 'assistant' && (
                      <div className="flex flex-col items-start gap-1 self-end">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => sendMessageFeedback(message.id, message.content, 'up')}
                            aria-label="Helpful"
                            className="rounded-full p-1 transition hover:brightness-125"
                            style={{ color: feedbackByMsg[message.id] === 'up' ? theme.accent : theme.mutedColor }}
                          >
                            <i
                              className={feedbackByMsg[message.id] === 'up' ? 'ri-thumb-up-fill' : 'ri-thumb-up-line'}
                              aria-hidden="true"
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => sendMessageFeedback(message.id, message.content, 'down')}
                            aria-label="Not helpful"
                            className="rounded-full p-1 transition hover:brightness-125"
                            style={{ color: feedbackByMsg[message.id] === 'down' ? theme.accent : theme.mutedColor }}
                          >
                            <i
                              className={
                                feedbackByMsg[message.id] === 'down' ? 'ri-thumb-down-fill' : 'ri-thumb-down-line'
                              }
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                        {feedbackOpenFor === message.id && (
                          <div className="flex flex-wrap gap-1">
                            {['Not helpful', 'Felt off', 'Wrong'].map((reason) => (
                              <button
                                key={reason}
                                type="button"
                                onClick={() => sendMessageFeedback(message.id, message.content, 'down', reason)}
                                className="rounded-full px-2 py-0.5 text-[10px]"
                                style={{ background: theme.accentSoft, color: theme.bodyColor }}
                              >
                                {reason}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {sending && (
              <div className="message-fade flex items-end gap-2">
                <PersonaAvatar persona={persona} size={32} theme={theme} />
                <div
                  className="rounded-[1.5rem] rounded-bl-md border px-4 py-3 shadow-lg backdrop-blur-md"
                  style={{ background: theme.cardBackground, borderColor: 'rgba(238,223,200,0.16)' }}
                >
                  <div className="flex gap-1.5">
                    <div
                      className="typing-dot h-2 w-2 rounded-full"
                      style={{ background: theme.accent, opacity: 0.7 }}
                    />
                    <div
                      className="typing-dot h-2 w-2 rounded-full"
                      style={{ background: theme.accent, opacity: 0.7 }}
                    />
                    <div
                      className="typing-dot h-2 w-2 rounded-full"
                      style={{ background: theme.accent, opacity: 0.7 }}
                    />
                  </div>
                </div>
              </div>
            )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {sessionEnded && (
            <div
              className="mx-auto mb-1 flex w-full max-w-6xl items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-xs sm:px-4"
              style={{
                borderColor: 'rgba(238,223,200,0.16)',
                background: theme.accentSoft,
                color: theme.bodyColor,
              }}
            >
              <span className="flex items-center gap-1.5">
                <i className="ri-checkbox-circle-line" aria-hidden="true" style={{ color: theme.accent }} />
                Session ended and saved to your history.
              </span>
              <button
                type="button"
                onClick={() => void handleNewSession()}
                className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1 font-semibold transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                style={{ background: theme.accent, color: '#1a2420' }}
              >
                <i className="ri-add-line" aria-hidden="true" /> New session
              </button>
            </div>
          )}

          {/* Composer */}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void sendMessage(inputValue)
            }}
            className="mx-auto w-full max-w-6xl px-3 pb-1 pt-3 sm:px-4"
          >
            <div
              className="flex items-end gap-2 rounded-3xl border px-3 py-2 shadow-lg backdrop-blur-md"
              style={{ borderColor: 'rgba(238,223,200,0.18)', background: theme.cardBackground }}
            >
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                maxLength={4000}
                placeholder="Type what's happening. No pressure."
                disabled={sending}
                className="max-h-60 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-relaxed focus:outline-none disabled:opacity-50"
                style={{ color: theme.headingColor }}
              />
              {micSupported && (
                <button
                  type="button"
                  onClick={() => (listening ? stopDictation() : startDictation())}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                  style={{
                    borderColor: 'rgba(238,223,200,0.25)',
                    background: listening ? theme.accent : 'transparent',
                    color: listening ? theme.userBubbleText : theme.bodyColor,
                  }}
                  aria-label={listening ? 'Stop voice input' : 'Speak your message'}
                  aria-pressed={listening}
                  title="Voice input"
                >
                  <i className={listening ? 'ri-mic-fill animate-pulse' : 'ri-mic-line'} aria-hidden="true" />
                </button>
              )}
              <button
                type="submit"
                disabled={!inputValue.trim() || sending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-md transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                style={{ background: theme.accent, color: theme.userBubbleText }}
                aria-label="Send"
              >
                <i className="ri-send-plane-2-fill text-lg" />
              </button>
            </div>
            <div
              className="mt-2 flex items-center justify-between gap-2 px-1 text-[10px]"
              style={{ color: theme.mutedColor }}
            >
              <span>Enter to send · Shift+Enter for a new line</span>
              <span className="flex items-center gap-1">
                <i className="ri-shield-keyhole-line" /> Private to you
              </span>
            </div>
          </form>
        </section>

        <p className="mx-auto w-full max-w-6xl shrink-0 px-3 text-center text-[10px] sm:px-4" style={{ color: theme.mutedColor }}>
          Peer-support AI -{' '}
          <Link href="/settings" className="underline" style={{ color: theme.accent }}>
            your profile
          </Link>{' '}
          stays in this room. {persona.name} remembers prior sessions.
        </p>
      </div>

      {renderOverlays()}
      <BottomNav />
    </div>
  )

  function renderOverlays() {
    return (
      <>
        {/* Crisis bottom sheet */}
        {showCrisisSheet && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Crisis support lines"
            className="fixed inset-0 z-[90] flex items-end bg-black/55 backdrop-blur-sm md:items-center md:justify-center"
            onClick={() => setShowCrisisSheet(false)}
          >
            <div
              className="w-full rounded-t-[2rem] border-t border-brand-background/12 bg-brand-dark p-6 shadow-[0_-24px_60px_rgba(16,28,24,0.5)] md:max-w-lg md:rounded-[2rem] md:border"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-brand-background/20 md:hidden" />
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-accent1/20 text-xl text-brand-accent1">
                  <i className="ri-hand-heart-line" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-brand-background">
                    You deserve a human right now
                  </h2>
                  <p className="mt-1 text-sm text-brand-background/65">
                    {persona.name} is here but is not a clinician. These lines answer 24/7.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCrisisSheet(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-background/[0.06] text-brand-background/55 transition-colors hover:bg-brand-background/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                  aria-label="Close"
                >
                  <i className="ri-close-line" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-5 space-y-2">
                <a
                  href="tel:0800567567"
                  className="flex items-center justify-between rounded-2xl bg-brand-background/[0.06] px-4 py-3 text-sm text-brand-background transition-colors hover:bg-brand-background/10"
                >
                  <span>
                    <span className="font-semibold">0800 567 567</span>
                    <span className="ml-2 text-brand-background/55">SADAG mental health, 24/7 (SMS 31393)</span>
                  </span>
                  <i className="ri-phone-line text-brand-accent2" aria-hidden="true" />
                </a>
                <a
                  href="tel:0800121314"
                  className="flex items-center justify-between rounded-2xl bg-brand-background/[0.06] px-4 py-3 text-sm text-brand-background transition-colors hover:bg-brand-background/10"
                >
                  <span>
                    <span className="font-semibold">0800 12 13 14</span>
                    <span className="ml-2 text-brand-background/55">SA Suicide Crisis Helpline, 24/7</span>
                  </span>
                  <i className="ri-phone-line text-brand-accent2" aria-hidden="true" />
                </a>
                <a
                  href="tel:10111"
                  className="flex items-center justify-between rounded-2xl bg-brand-background/[0.06] px-4 py-3 text-sm text-brand-background transition-colors hover:bg-brand-background/10"
                >
                  <span>
                    <span className="font-semibold">10111</span>
                    <span className="ml-2 text-brand-background/55">SA emergency (112 from a cellphone)</span>
                  </span>
                  <i className="ri-phone-line text-brand-accent2" aria-hidden="true" />
                </a>
                <a
                  href="https://findahelpline.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-2xl bg-brand-background/[0.06] px-4 py-3 text-sm text-brand-background transition-colors hover:bg-brand-background/10"
                >
                  <span>
                    <span className="font-semibold">findahelpline.com</span>
                    <span className="ml-2 text-brand-background/55">Outside South Africa</span>
                  </span>
                  <i className="ri-external-link-line text-brand-accent2" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Breathing overlay */}
        {showBreathing && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Breathing exercise"
            className="fixed inset-0 z-[95] flex flex-col items-center justify-center bg-brand-dark/95 backdrop-blur-sm"
            onClick={() => setShowBreathing(false)}
          >
            <button
              type="button"
              onClick={() => setShowBreathing(false)}
              className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-brand-background/10 text-brand-background/70 transition-colors hover:bg-brand-background/[0.18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
              aria-label="Close"
            >
              <i className="ri-close-line text-xl" aria-hidden="true" />
            </button>
            <div className="relative mb-8 h-64 w-64">
              <div
                className="breath-orb absolute inset-0 rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${theme.accent}, ${theme.userBubble})`,
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-center">
                <span
                  className="text-sm font-semibold uppercase tracking-[0.3em]"
                  style={{ color: theme.headingColor }}
                >
                  Breathe
                </span>
              </div>
            </div>
            <p className="max-w-xs text-center text-sm leading-relaxed text-brand-background/80">
              In for 4 · hold for 4 · out for 8. Tap anywhere when you&apos;re ready.
            </p>
          </div>
        )}

        {/* Guide & scenery settings sheet */}
        {showSettings && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Guide and scenery settings"
            className="fixed inset-0 z-[92] flex items-end bg-black/55 backdrop-blur-sm md:items-center md:justify-center"
            onClick={() => setShowSettings(false)}
          >
            <div
              className="max-h-[85dvh] w-full overflow-y-auto rounded-t-[2rem] border border-brand-background/10 bg-brand-dark p-6 shadow-[0_-24px_60px_rgba(16,28,24,0.5)] md:max-w-2xl md:rounded-[2rem]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-brand-background/20 md:hidden" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-background/45">
                    Guide &amp; scenery
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-brand-background">Tune your room</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-background/[0.06] text-brand-background/55 transition-colors hover:bg-brand-background/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                  aria-label="Close"
                >
                  <i className="ri-close-line" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-background/45">Guide</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {THERAPIST_PERSONAS.map((option) => {
                    const selected = option.id === personaId
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setPersonaId(option.id)}
                        className={cn(
                          'flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                          selected
                            ? 'border-brand-accent2 bg-brand-accent2/10'
                            : 'border-brand-background/[0.08] bg-brand-background/[0.04] hover:bg-brand-background/[0.08]')}
                      >
                        <PersonaAvatar persona={option} size={40} theme={theme} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-brand-background">{option.name}</p>
                          <p className="truncate text-xs text-brand-background/55">{option.tagline}</p>
                        </div>
                        {selected && <i className="ri-check-line text-brand-accent2" aria-hidden="true" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-background/45">Scenery</p>
                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                  {THERAPY_THEMES.map((option) => {
                    const selected = option.id === themeId
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setThemeId(option.id)}
                        className="rounded-2xl border-2 p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                        style={{
                          borderColor: selected ? option.accent : 'rgba(238,223,200,0.1)',
                          background: option.pageBackground,
                        }}
                      >
                        <p className="font-semibold" style={{ color: option.headingColor }}>
                          {option.name}
                        </p>
                        <p className="mt-0.5 text-xs" style={{ color: option.mutedColor }}>
                          {option.description}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="rounded-2xl bg-brand-background/[0.08] px-4 py-2.5 text-sm text-brand-background/65 transition-colors hover:bg-brand-background/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await chooseAndPersist(personaId, themeId)
                    setShowSettings(false)
                    toast('Room updated', 'success')
                  }}
                  className="rounded-2xl px-4 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                  style={{ background: theme.accent, color: theme.userBubbleText }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Session history list */}
        {showHistory && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Past sessions"
            className="fixed inset-0 z-[93] flex items-end bg-black/55 backdrop-blur-sm md:items-center md:justify-center"
            onClick={() => setShowHistory(false)}
          >
            <div
              className="max-h-[85dvh] w-full overflow-y-auto rounded-t-[2rem] border border-brand-background/10 bg-brand-dark p-6 shadow-[0_-24px_60px_rgba(16,28,24,0.5)] md:max-w-2xl md:rounded-[2rem]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-brand-background/20 md:hidden" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-background/45">
                    Your sessions
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-brand-background">Past conversations</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-background/[0.06] text-brand-background/55 transition-colors hover:bg-brand-background/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                  aria-label="Close"
                >
                  <i className="ri-close-line" aria-hidden="true" />
                </button>
              </div>

              <p className="mt-2 text-xs leading-relaxed text-brand-background/55">
                These are read only. Open one to revisit it, or delete any of your own messages to erase them
                from {persona.name}’s memory.
              </p>

              <div className="mt-4 space-y-2">
                {loadingHistory ? (
                  <div className="rounded-2xl bg-brand-background/[0.05] p-4 text-sm text-brand-background/60">
                    Loading your sessions...
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-brand-background/15 p-6 text-center">
                    <i className="ri-chat-history-line text-2xl text-brand-background/40" aria-hidden="true" />
                    <p className="mt-2 text-sm font-semibold text-brand-background">No past sessions yet</p>
                    <p className="mt-1 text-xs text-brand-background/55">
                      Your conversations show up here once you have talked a little.
                    </p>
                  </div>
                ) : (
                  sessions.map((session) => {
                    const sessionPersona = getPersona(session.persona)
                    const started = session.startedAt ? new Date(session.startedAt) : null
                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => openSessionTranscript(session)}
                        className="flex w-full items-start gap-3 rounded-2xl border border-brand-background/[0.08] bg-brand-background/[0.04] p-3 text-left transition-colors hover:bg-brand-background/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                      >
                        <PersonaAvatar persona={sessionPersona} size={36} theme={theme} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-brand-background">
                              {started
                                ? started.toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })
                                : 'Session'}
                            </p>
                            <span className="shrink-0 text-[11px] text-brand-background/45">
                              {session.messageCount} msg{session.messageCount === 1 ? '' : 's'}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-brand-background/60">
                            {session.summary || 'No summary saved for this session.'}
                          </p>
                          {session.keyThemes && session.keyThemes.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {session.keyThemes.slice(0, 4).map((themeTag) => (
                                <span
                                  key={themeTag}
                                  className="rounded-full bg-brand-background/[0.08] px-2 py-0.5 text-[10px] text-brand-background/60"
                                >
                                  {themeTag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <i className="ri-arrow-right-s-line mt-1 shrink-0 text-brand-background/40" aria-hidden="true" />
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Read-only transcript for one past session */}
        {openSession && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Session transcript"
            className="fixed inset-0 z-[94] flex items-end bg-black/60 backdrop-blur-sm md:items-center md:justify-center"
            onClick={() => setOpenSession(null)}
          >
            <div
              className="flex max-h-[88dvh] w-full flex-col rounded-t-[2rem] border border-brand-background/10 bg-brand-dark shadow-[0_-24px_60px_rgba(16,28,24,0.5)] md:max-w-2xl md:rounded-[2rem]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-brand-background/10 p-5">
                <button
                  type="button"
                  onClick={() => setOpenSession(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-background/[0.06] text-brand-background/65 transition-colors hover:bg-brand-background/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                  aria-label="Back to sessions"
                >
                  <i className="ri-arrow-left-line" aria-hidden="true" />
                </button>
                <div className="min-w-0 flex-1 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-background/45">
                    Read only
                  </p>
                  <p className="truncate text-sm font-semibold text-brand-background">
                    {openSession.startedAt
                      ? new Date(openSession.startedAt).toLocaleDateString(undefined, {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Session'}
                  </p>
                </div>
                <div className="h-9 w-9" />
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {loadingTranscript ? (
                  <div className="rounded-2xl bg-brand-background/[0.05] p-4 text-sm text-brand-background/60">
                    Loading the conversation...
                  </div>
                ) : sessionMessages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-brand-background/15 p-6 text-center">
                    <p className="text-sm font-semibold text-brand-background">No replayable messages</p>
                    <p className="mt-1 text-xs text-brand-background/55">
                      {openSession.summary
                        ? `Here is what ${persona.name} remembers from this session:`
                        : 'This session has no saved transcript.'}
                    </p>
                    {openSession.summary && (
                      <p className="mt-3 rounded-2xl bg-brand-background/[0.05] p-3 text-left text-xs leading-relaxed text-brand-background/75">
                        {openSession.summary}
                      </p>
                    )}
                  </div>
                ) : (
                  sessionMessages.map((row) => {
                    const isUser = !row.isAi
                    return (
                      <div key={row.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className="flex max-w-[88%] items-end gap-2">
                          {!isUser && (
                            <PersonaAvatar persona={getPersona(openSession.persona)} size={28} theme={theme} />
                          )}
                          <div
                            className="rounded-[1.25rem] px-3.5 py-2.5 text-sm leading-relaxed"
                            style={
                              isUser
                                ? { background: theme.userBubble, color: theme.userBubbleText }
                                : { background: 'rgba(238,223,200,0.08)', color: theme.headingColor }
                            }
                          >
                            <p className="whitespace-pre-line">{row.message}</p>
                          </div>
                          {isUser && (
                            <button
                              type="button"
                              onClick={() => deleteSessionMessage(row.id)}
                              disabled={deletingMessageId === row.id}
                              aria-label="Delete this message"
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-accent1/15 text-brand-accent1 transition hover:bg-brand-accent1/25 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                            >
                              <i
                                className={
                                  deletingMessageId === row.id
                                    ? 'ri-loader-4-line animate-spin'
                                    : 'ri-delete-bin-line'
                                }
                                aria-hidden="true"
                              />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="shrink-0 border-t border-brand-background/10 p-4">
                <p className="text-center text-[11px] leading-relaxed text-brand-background/45">
                  <i className="ri-shield-keyhole-line" aria-hidden="true" /> Deleting your message erases it
                  here and from {persona.name}’s memory.
                </p>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }
}
