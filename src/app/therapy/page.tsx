'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { getCachedProfile, updateCachedProfile } from '@/lib/profile-cache'
import { detectConcern, toDate } from '@/lib/platform'
import {
  THERAPIST_PERSONAS,
  THERAPY_THEMES,
  MOOD_OPTIONS,
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

type View = 'loading' | 'onboard' | 'empty' | 'chat'

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
        className="flex shrink-0 items-center justify-center rounded-full text-sm font-bold text-[#2A4A42] shadow-md"
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
  const [showCrisisSheet, setShowCrisisSheet] = useState(false)
  const [showBreathing, setShowBreathing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const [personaId, setPersonaId] = useState<string>('mira')
  const [themeId, setThemeId] = useState<string>('default')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const persona = useMemo(() => getPersona(personaId), [personaId])
  const theme = useMemo(() => getTheme(themeId), [themeId])

  const roomId = user ? `guided-support-${user.userId}` : null
  const firstName = useMemo(() => firstNameFrom(profile), [profile])

  // ── Load profile + previous messages + resolve view state ─────────
  useEffect(() => {
    async function load() {
      if (!user || !roomId) {
        setView('loading')
        return
      }
      try {
        const [cachedProfile, savedMessages] = await Promise.all([
          getCachedProfile(user.userId),
          DatabaseService.getMessages(roomId, 80),
        ])
        setProfile(cachedProfile)

        const savedPersona = (cachedProfile?.therapist_persona as string | undefined) ?? null
        const savedTheme = (cachedProfile?.therapy_theme as string | undefined) ?? null
        if (savedPersona) setPersonaId(savedPersona)
        if (savedTheme) setThemeId(savedTheme)

        const restored = (savedMessages as Record<string, unknown>[]).map((message) => ({
          id: message.id as string,
          role: (message.is_ai ? 'assistant' : 'user') as 'user' | 'assistant',
          content: message.message as string,
          created_at: toDate(message.created_at) || new Date(),
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

  // ── End-session hook: summarise when the tab closes ──────────────
  useEffect(() => {
    function flush() {
      if (!sessionId || !user) return
      const recent = messages.filter((message) => message.role === 'user').length
      if (recent < 2) return
      const payload = JSON.stringify({
        sessionId,
        userId: user.userId,
        personaName: persona.name,
        moodAtStart,
        messages: messages.slice(-40).map((message) => ({ role: message.role, content: message.content })),
      })
      try {
        const blob = new Blob([payload], { type: 'application/json' })
        if (navigator.sendBeacon) navigator.sendBeacon('/api/therapy/end-session', blob)
        else void fetch('/api/therapy/end-session', { method: 'POST', body: payload, keepalive: true })
      } catch {
        // best-effort
      }
    }
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', flush)
    }
  }, [sessionId, user, messages, persona.name, moodAtStart])

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
    [user],
  )

  // ── Session start (lazy — first time the user actually sends) ────
  const ensureSession = useCallback(
    async (mood: string | null): Promise<string | null> => {
      if (sessionId) return sessionId
      if (!user) return null
      try {
        const { id } = await DatabaseService.startTherapySession(user.userId, {
          persona: personaId,
          theme: themeId,
          mood,
        })
        setSessionId(id)
        setMoodAtStart(mood)
        return id
      } catch (error) {
        console.error('Failed to start session:', error)
        return null
      }
    },
    [personaId, sessionId, themeId, user],
  )

  // ── Send ────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (content: string, moodForStart: string | null = null) => {
      const trimmed = content.trim()
      if (!trimmed || !user || !roomId) return

      const sid = (await ensureSession(moodForStart ?? moodAtStart)) ?? null
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        created_at: new Date(),
      }

      if (detectConcern(trimmed) === 'crisis') setShowCrisisSheet(true)

      setMessages((current) => [...current, userMessage])
      setInputValue('')
      setSending(true)
      setView('chat')

      void DatabaseService.sendMessage(user.userId, null, roomId, userMessage.content, false).catch(
        (error) => console.error('Failed to save user message:', error),
      )

      const history = [...messages, userMessage].map((message) => ({
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
          | { ok: boolean; reply?: string; isCrisis?: boolean; error?: string }
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
        setMessages((current) => [...current, guideMessage])

        void DatabaseService.sendMessage('guided-support', null, roomId, guideMessage.content, true).catch(
          (error) => console.error('Failed to save guide reply:', error),
        )
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
    [ensureSession, messages, moodAtStart, personaId, profile, roomId, toast, user],
  )

  function handleMoodPick(mood: MoodOption) {
    void sendMessage(mood.starterPhrase, mood.id)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage(inputValue)
    }
  }

  // ── Render ──────────────────────────────────────────────────────
  const pageStyle: React.CSSProperties = {
    background: theme.pageBackground,
    minHeight: '100dvh',
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
                  onClick={() => setPersonaId(option.id)}
                  className="rounded-3xl border-2 p-4 text-left transition-all"
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
                    onClick={() => setThemeId(option.id)}
                    className="rounded-2xl border-2 p-3 text-left transition-all"
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
              onClick={async () => {
                await chooseAndPersist(personaId, themeId)
                setView('empty')
              }}
              className="rounded-2xl px-5 py-3 text-sm font-semibold shadow-md transition-transform hover:scale-[1.01]"
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
                  onClick={() => handleMoodPick(mood)}
                  disabled={sending}
                  className="flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center transition-all hover:scale-[1.03] disabled:opacity-50"
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
              or just start typing below — no mood required.
            </p>
          </div>

          {/* Action strip: breathe / crisis / settings */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setShowBreathing(true)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ background: theme.accentSoft, color: theme.accent }}
            >
              <i className="ri-leaf-line" /> Breathe
            </button>
            <button
              onClick={() => setShowCrisisSheet(true)}
              className="flex items-center gap-1.5 rounded-full bg-[#B85C3A]/18 px-3 py-1.5 text-xs font-medium text-[#f0b59c] hover:bg-[#B85C3A]/30"
            >
              <i className="ri-heart-3-line" /> Need a human?
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ background: 'rgba(238,223,200,0.08)', color: theme.bodyColor }}
            >
              <i className="ri-settings-3-line" /> Guide &amp; scenery
            </button>
          </div>

          {/* Inline composer — shown from the jump, no scrolling required */}
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
              <button
                type="submit"
                disabled={!inputValue.trim() || sending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-md transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: theme.accent, color: theme.userBubbleText }}
                aria-label="Send"
              >
                <i className="ri-send-plane-2-fill text-lg" />
              </button>
            </div>
          </form>

          <p className="text-center text-[10px]" style={{ color: theme.mutedColor }}>
            {persona.name} remembers past sessions, your conditions, and today&apos;s mood.
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
    <div style={pageStyle} className="px-3 pb-28 pt-6 sm:px-4 md:pb-24">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {/* Header strip — icons on mobile, pills on desktop */}
        <div className="flex items-center justify-between gap-2">
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
              onClick={() => setShowBreathing(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full sm:h-auto sm:w-auto sm:gap-1 sm:px-3 sm:py-1.5 text-xs font-medium"
              style={{ background: theme.accentSoft, color: theme.accent }}
              aria-label="Breathe"
            >
              <i className="ri-leaf-line" />
              <span className="hidden sm:inline">Breathe</span>
            </button>
            <button
              onClick={() => setShowCrisisSheet(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#B85C3A]/18 text-[#f0b59c] sm:h-auto sm:w-auto sm:gap-1 sm:px-3 sm:py-1.5 text-xs font-medium"
              aria-label="Need a human?"
            >
              <i className="ri-heart-3-line" />
              <span className="hidden sm:inline">Human?</span>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: 'rgba(238,223,200,0.08)', color: theme.bodyColor }}
              aria-label="Guide & scenery"
            >
              <i className="ri-settings-3-line" />
            </button>
          </div>
        </div>

        {/* Chat card */}
        <section
          className="flex flex-col rounded-[1.75rem] border md:min-h-[calc(100dvh-16rem)] md:overflow-hidden"
          style={{
            borderColor: 'rgba(238,223,200,0.08)',
            background: theme.cardBackground,
          }}
        >
          <div className="space-y-5 px-4 py-6 md:flex-1 md:overflow-y-auto md:px-6">
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
                      className="rounded-[1.5rem] px-4 py-3 text-[15px] leading-relaxed"
                      style={
                        message.role === 'user'
                          ? {
                              background: theme.userBubble,
                              color: theme.userBubbleText,
                              borderBottomRightRadius: '0.5rem',
                            }
                          : {
                              background: theme.accentSoft,
                              color: theme.headingColor,
                              borderBottomLeftRadius: '0.5rem',
                            }
                      }
                    >
                      <p className="whitespace-pre-line">{message.content}</p>
                    </div>
                  </div>
                </div>
              )
            })}

            {sending && (
              <div className="message-fade flex items-end gap-2">
                <PersonaAvatar persona={persona} size={32} theme={theme} />
                <div
                  className="rounded-[1.5rem] rounded-bl-md px-4 py-3"
                  style={{ background: theme.accentSoft }}
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

          {/* Composer */}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void sendMessage(inputValue)
            }}
            className="border-t px-3 pb-3 pt-3 md:px-4"
            style={{ borderColor: 'rgba(238,223,200,0.08)', background: 'rgba(238,223,200,0.03)' }}
          >
            <div
              className="flex items-end gap-2 rounded-3xl border px-3 py-2"
              style={{ borderColor: 'rgba(238,223,200,0.12)', background: 'rgba(238,223,200,0.04)' }}
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
              <button
                type="submit"
                disabled={!inputValue.trim() || sending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-md transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
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

        <p className="text-center text-[10px]" style={{ color: theme.mutedColor }}>
          Peer-support AI —{' '}
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
            className="fixed inset-0 z-[90] flex items-end bg-black/55 backdrop-blur-sm md:items-center md:justify-center"
            onClick={() => setShowCrisisSheet(false)}
          >
            <div
              className="w-full rounded-t-[2rem] border-t border-[#eedfc8]/12 bg-[#244039] p-6 shadow-[0_-24px_60px_rgba(16,28,24,0.5)] md:max-w-lg md:rounded-[2rem] md:border"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#eedfc8]/20 md:hidden" />
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#B85C3A]/20 text-xl text-[#B85C3A]">
                  <i className="ri-hand-heart-line" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-[#eedfc8]">
                    You deserve a human right now
                  </h2>
                  <p className="mt-1 text-sm text-[#eedfc8]/65">
                    {persona.name} is here but is not a clinician. These lines answer 24/7.
                  </p>
                </div>
                <button
                  onClick={() => setShowCrisisSheet(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#eedfc8]/6 text-[#eedfc8]/55 hover:bg-[#eedfc8]/12"
                  aria-label="Close"
                >
                  <i className="ri-close-line" />
                </button>
              </div>
              <div className="mt-5 space-y-2">
                <a
                  href="tel:988"
                  className="flex items-center justify-between rounded-2xl bg-[#eedfc8]/6 px-4 py-3 text-sm text-[#eedfc8] hover:bg-[#eedfc8]/10"
                >
                  <span>
                    <span className="font-semibold">988</span>
                    <span className="ml-2 text-[#eedfc8]/55">US &amp; Canada — call or text</span>
                  </span>
                  <i className="ri-phone-line text-[#D19A58]" />
                </a>
                <a
                  href="tel:111"
                  className="flex items-center justify-between rounded-2xl bg-[#eedfc8]/6 px-4 py-3 text-sm text-[#eedfc8] hover:bg-[#eedfc8]/10"
                >
                  <span>
                    <span className="font-semibold">111 option 2</span>
                    <span className="ml-2 text-[#eedfc8]/55">UK NHS mental health</span>
                  </span>
                  <i className="ri-phone-line text-[#D19A58]" />
                </a>
                <a
                  href="tel:116123"
                  className="flex items-center justify-between rounded-2xl bg-[#eedfc8]/6 px-4 py-3 text-sm text-[#eedfc8] hover:bg-[#eedfc8]/10"
                >
                  <span>
                    <span className="font-semibold">116 123</span>
                    <span className="ml-2 text-[#eedfc8]/55">Samaritans — UK &amp; Ireland</span>
                  </span>
                  <i className="ri-phone-line text-[#D19A58]" />
                </a>
                <a
                  href="https://findahelpline.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-2xl bg-[#eedfc8]/6 px-4 py-3 text-sm text-[#eedfc8] hover:bg-[#eedfc8]/10"
                >
                  <span>
                    <span className="font-semibold">findahelpline.com</span>
                    <span className="ml-2 text-[#eedfc8]/55">Anywhere in the world</span>
                  </span>
                  <i className="ri-external-link-line text-[#D19A58]" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Breathing overlay */}
        {showBreathing && (
          <div
            className="fixed inset-0 z-[95] flex flex-col items-center justify-center bg-[#1a2d28]/95 backdrop-blur-sm"
            onClick={() => setShowBreathing(false)}
          >
            <button
              onClick={() => setShowBreathing(false)}
              className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-[#eedfc8]/10 text-[#eedfc8]/70 hover:bg-[#eedfc8]/18"
              aria-label="Close"
            >
              <i className="ri-close-line text-xl" />
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
            <p className="max-w-xs text-center text-sm leading-relaxed text-[#eedfc8]/80">
              In for 4 · hold for 4 · out for 8. Tap anywhere when you&apos;re ready.
            </p>
          </div>
        )}

        {/* Guide & scenery settings sheet */}
        {showSettings && (
          <div
            className="fixed inset-0 z-[92] flex items-end bg-black/55 backdrop-blur-sm md:items-center md:justify-center"
            onClick={() => setShowSettings(false)}
          >
            <div
              className="max-h-[85dvh] w-full overflow-y-auto rounded-t-[2rem] border border-[#eedfc8]/10 bg-[#244039] p-6 shadow-[0_-24px_60px_rgba(16,28,24,0.5)] md:max-w-2xl md:rounded-[2rem]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#eedfc8]/20 md:hidden" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/45">
                    Guide &amp; scenery
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[#eedfc8]">Tune your room</h2>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#eedfc8]/6 text-[#eedfc8]/55 hover:bg-[#eedfc8]/12"
                  aria-label="Close"
                >
                  <i className="ri-close-line" />
                </button>
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/45">Guide</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {THERAPIST_PERSONAS.map((option) => {
                    const selected = option.id === personaId
                    return (
                      <button
                        key={option.id}
                        onClick={() => setPersonaId(option.id)}
                        className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                          selected
                            ? 'border-[#D19A58] bg-[#D19A58]/10'
                            : 'border-[#eedfc8]/8 bg-[#eedfc8]/4 hover:bg-[#eedfc8]/8'
                        }`}
                      >
                        <PersonaAvatar persona={option} size={40} theme={theme} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#eedfc8]">{option.name}</p>
                          <p className="truncate text-xs text-[#eedfc8]/55">{option.tagline}</p>
                        </div>
                        {selected && <i className="ri-check-line text-[#D19A58]" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/45">Scenery</p>
                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                  {THERAPY_THEMES.map((option) => {
                    const selected = option.id === themeId
                    return (
                      <button
                        key={option.id}
                        onClick={() => setThemeId(option.id)}
                        className="rounded-2xl border-2 p-3 text-left transition-all"
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
                  onClick={() => setShowSettings(false)}
                  className="rounded-2xl bg-[#eedfc8]/8 px-4 py-2.5 text-sm text-[#eedfc8]/65"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await chooseAndPersist(personaId, themeId)
                    setShowSettings(false)
                    toast('Room updated', 'success')
                  }}
                  className="rounded-2xl px-4 py-2.5 text-sm font-semibold"
                  style={{ background: theme.accent, color: theme.userBubbleText }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }
}
