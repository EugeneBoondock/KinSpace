'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useToast } from '@/components/Toast'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { getCachedProfile } from '@/lib/profile-cache'
import { detectConcern, formatRelativeTime, getInitials, toDate } from '@/lib/platform'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: Date
}

const quickPrompts = [
  'I feel overwhelmed today',
  'I need help calming down',
  'I am grieving and need space to talk',
  'What do people with my condition find helps?',
  'I need one small step for today',
]

function buildWelcomeMessage(name: string): Message {
  return {
    id: 'welcome',
    role: 'assistant',
    content: `Hi${name ? ` ${name}` : ''}. I'm your KinSpace Guide. I know a bit about what you've shared on your profile — conditions, goals, what the community has been finding helpful — so I can skip the generic stuff. What's coming up for you today?`,
    created_at: new Date(),
  }
}

function mapRoleToRaw(role: Message['role']): 'user' | 'assistant' {
  return role === 'user' ? 'user' : 'assistant'
}

export default function TherapyPage() {
  const { user, loading: authLoading } = useAuth()
  const { push: toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [angels, setAngels] = useState<Record<string, unknown>[]>([])
  const [mentors, setMentors] = useState<Record<string, unknown>[]>([])
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [showCrisis, setShowCrisis] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const roomId = user ? `guided-support-${user.userId}` : null
  const displayName = useMemo(() => {
    if (!profile) return ''
    return (
      (profile.full_name as string | undefined) ||
      (profile.username as string | undefined) ||
      ''
    )
  }, [profile])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  useEffect(() => {
    async function loadTherapyData() {
      if (!user || !roomId) {
        setLoading(false)
        return
      }

      try {
        const [cachedProfile, savedMessages, supportAngels, supportMentors] = await Promise.all([
          getCachedProfile(user.userId),
          DatabaseService.getMessages(roomId, 80),
          DatabaseService.getUserAngels(user.userId),
          DatabaseService.getMentors(),
        ])

        setProfile(cachedProfile)

        const restored = (savedMessages as Record<string, unknown>[]).map((message) => ({
          id: message.id as string,
          role: (message.is_ai ? 'assistant' : 'user') as 'user' | 'assistant',
          content: message.message as string,
          created_at: toDate(message.created_at) || new Date(),
        }))

        const firstName = ((cachedProfile?.full_name as string | undefined) || (cachedProfile?.username as string | undefined) || '').split(' ')[0]
        setMessages([buildWelcomeMessage(firstName), ...restored])

        setAngels(
          (supportAngels as Array<Record<string, unknown> & { angel?: Record<string, unknown> | null }>)
            .map((relationship) => relationship.angel)
            .filter(Boolean) as Record<string, unknown>[],
        )
        setMentors((supportMentors as Record<string, unknown>[]).slice(0, 4))
      } catch (error) {
        console.error('Failed to load therapy data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading) loadTherapyData()
  }, [authLoading, roomId, user])

  const latestAssistantReply = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant'),
    [messages],
  )

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed || !user || !roomId) return

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        created_at: new Date(),
      }

      const concern = detectConcern(trimmed)
      if (concern === 'crisis') setShowCrisis(true)

      setMessages((current) => [...current, userMessage])
      setInputValue('')
      setSending(true)

      // Persist user message (fire-and-forget so the chat doesn't stall)
      void DatabaseService.sendMessage(user.userId, null, roomId, userMessage.content, false).catch(
        (error) => console.error('Failed to save user message:', error),
      )

      const history = [...messages, userMessage]
        .filter((message) => message.id !== 'welcome')
        .map((message) => ({ role: mapRoleToRaw(message.role), content: message.content }))

      try {
        const response = await fetch('/api/therapy/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.userId,
            messages: history,
            profileCache: profile,
          }),
        })
        const data = (await response.json().catch(() => null)) as
          | { ok: boolean; reply?: string; isCrisis?: boolean; error?: string }
          | null

        if (!response.ok || !data?.ok || !data.reply) {
          throw new Error(data?.error ?? 'Therapy chat failed')
        }

        if (data.isCrisis) setShowCrisis(true)

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
              'I am having trouble reaching the model right now. Let us try again in a moment. If something urgent is happening, please use one of the crisis links in the sidebar.',
            created_at: new Date(),
          },
        ])
      } finally {
        setSending(false)
      }
    },
    [messages, profile, roomId, toast, user],
  )

  if (authLoading || loading) {
    return (
      <PageFrame>
        <div className="page-grid lg:grid-cols-[minmax(0,1.15fr)_22rem]">
          <div className="h-[38rem] skeleton rounded-3xl" />
          <div className="space-y-4">
            <div className="h-48 skeleton rounded-3xl" />
            <div className="h-48 skeleton rounded-3xl" />
          </div>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  const conditionList = Array.isArray(profile?.conditions) ? (profile?.conditions as string[]) : []

  return (
    <PageFrame>
      {showCrisis && (
        <div className="mb-4 rounded-3xl border border-[#B85C3A]/40 bg-[#B85C3A]/12 p-4 text-sm">
          <div className="flex items-start gap-3">
            <i className="ri-alarm-warning-line mt-0.5 text-xl text-[#B85C3A]" />
            <div className="flex-1">
              <p className="font-semibold text-[#eedfc8]">If you are in crisis, please reach a human.</p>
              <p className="mt-1 text-[#eedfc8]/80">
                The Guide is peer support, not emergency care. In the US/Canada: call or text{' '}
                <strong>988</strong>. In the UK: <strong>111 option 2</strong> or Samaritans{' '}
                <strong>116 123</strong>. Elsewhere: <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer" className="underline text-[#D19A58]">findahelpline.com</a>.
              </p>
            </div>
            <button
              onClick={() => setShowCrisis(false)}
              className="text-[#eedfc8]/55 hover:text-[#eedfc8]"
              aria-label="Dismiss"
            >
              <i className="ri-close-line" />
            </button>
          </div>
        </div>
      )}

      <div className="page-grid lg:grid-cols-[minmax(0,1.15fr)_22rem] lg:items-start">
        <section className="card flex min-h-[38rem] flex-col">
          <div className="border-b border-[#eedfc8]/8 pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
              Therapy
            </p>
            <div className="mt-2 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-[#eedfc8]">KinSpace Guide</h1>
                <p className="mt-2 max-w-2xl text-sm text-[#eedfc8]/60">
                  Warm peer-support AI that already knows your conditions, goals, and what your community has found useful.
                </p>
                {conditionList.length > 0 && (
                  <p className="mt-2 text-xs text-[#eedfc8]/50">
                    Context: {conditionList.slice(0, 4).join(' · ')}
                  </p>
                )}
              </div>
              <div className="badge bg-[#6B8A83]/16 text-[#6B8A83]">Private room</div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto py-5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-[1.5rem] px-4 py-3 text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-[#eedfc8] text-[#2A4A42]'
                      : 'bg-[#eedfc8]/6 text-[#eedfc8]'
                  }`}
                >
                  <p className="whitespace-pre-line">{message.content}</p>
                  <p
                    className={`mt-2 text-[10px] ${
                      message.role === 'user' ? 'text-[#2A4A42]/55' : 'text-[#eedfc8]/35'
                    }`}
                  >
                    {message.created_at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="rounded-[1.5rem] bg-[#eedfc8]/6 px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="typing-dot h-2 w-2 rounded-full bg-[#eedfc8]/40" />
                    <div className="typing-dot h-2 w-2 rounded-full bg-[#eedfc8]/40" />
                    <div className="typing-dot h-2 w-2 rounded-full bg-[#eedfc8]/40" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-[#eedfc8]/8 pt-4">
            <div className="flex gap-2 overflow-x-auto pb-3">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={sending}
                  className="rounded-full bg-[#eedfc8]/8 px-4 py-2 text-xs whitespace-nowrap text-[#eedfc8]/70 transition-colors hover:bg-[#eedfc8]/14 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <input
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void sendMessage(inputValue)
                  }
                }}
                className="input-field"
                placeholder="Write what is happening right now"
                disabled={sending}
              />
              <button
                onClick={() => sendMessage(inputValue)}
                disabled={!inputValue.trim() || sending}
                className="btn-primary !px-4 !py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
            <p className="mt-2 text-[10px] text-[#eedfc8]/35">
              Peer support · not medical or therapeutic advice · uses your KinSpace profile as context
            </p>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="card">
            <h2 className="section-title">What the Guide knows</h2>
            <div className="space-y-2 text-sm text-[#eedfc8]/70">
              <p>
                <span className="text-[#eedfc8]/45">You are talking as:</span>{' '}
                <span className="font-medium text-[#eedfc8]">{displayName || 'KinSpace member'}</span>
              </p>
              {conditionList.length > 0 && (
                <p>
                  <span className="text-[#eedfc8]/45">Conditions:</span>{' '}
                  {conditionList.join(', ')}
                </p>
              )}
              {Array.isArray(profile?.medications) && (profile?.medications as string[]).length > 0 && (
                <p>
                  <span className="text-[#eedfc8]/45">Medications:</span>{' '}
                  {(profile?.medications as string[]).join(', ')}
                </p>
              )}
              <Link href="/settings" className="mt-2 inline-block text-xs text-[#D19A58]">
                Update your profile →
              </Link>
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">Latest reflection</h2>
            <p className="text-sm leading-relaxed text-[#eedfc8]/70">
              {latestAssistantReply?.content || 'The Guide\'s latest reply will appear here.'}
            </p>
          </section>

          <section className="card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title !mb-0">Your angels</h2>
              <span className="text-xs text-[#eedfc8]/45">{angels.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {angels.length > 0 ? (
                angels.map((angel) => {
                  const angelProfile = (angel.profile as Record<string, unknown> | undefined) ?? {}
                  const name =
                    (angelProfile.full_name as string | undefined) ||
                    (angelProfile.username as string | undefined) ||
                    'Peer supporter'

                  return (
                    <div key={angel.id as string} className="card-light !p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#D19A58]/18 text-sm font-bold text-[#D19A58]">
                          {getInitials(name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-[#eedfc8]">{name}</p>
                          <p className="text-xs text-[#eedfc8]/45">{angel.specialty as string}</p>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-[#eedfc8]/55">You have not connected with an angel yet.</p>
              )}
            </div>
          </section>

          <section className="card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title !mb-0">Available mentors</h2>
              <span className="text-xs text-[#eedfc8]/45">{mentors.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {mentors.length > 0 ? (
                mentors.map((mentor) => {
                  const mentorProfile = (mentor.profile as Record<string, unknown> | undefined) ?? {}
                  const name =
                    (mentorProfile.full_name as string | undefined) ||
                    (mentorProfile.username as string | undefined) ||
                    'Mentor'

                  return (
                    <div key={mentor.id as string} className="card-light !p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#6B8A83]/18 text-sm font-bold text-[#6B8A83]">
                          {getInitials(name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-[#eedfc8]">{name}</p>
                          <p className="text-xs text-[#eedfc8]/45">
                            {(mentor.credentials as string | undefined) || 'Support guide'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-[#eedfc8]/55">No mentors have been added to the platform yet.</p>
              )}
            </div>
          </section>

          <section className="card-light">
            <p className="text-sm font-semibold text-[#eedfc8]">Need urgent human help?</p>
            <p className="mt-2 text-sm text-[#eedfc8]/60">
              If you are in immediate danger, call local emergency services or a crisis line now. The Guide is supportive but is not emergency care.
            </p>
            <p className="mt-3 text-xs text-[#eedfc8]/45">
              Last reply: {latestAssistantReply ? formatRelativeTime(latestAssistantReply.created_at) : 'just now'}
            </p>
          </section>
        </aside>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
