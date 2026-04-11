'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { buildGuidedSupportReply, formatRelativeTime, getInitials, toDate } from '@/lib/platform'

type Message = {
  id: string
  role: 'user' | 'guide'
  content: string
  created_at: Date
}

const quickPrompts = [
  'I feel overwhelmed today',
  'I need help calming down',
  'I am grieving and need space to talk',
  'I need one small step for today',
]

const welcomeMessage: Message = {
  id: 'welcome',
  role: 'guide',
  content:
    'This is your guided support space. What you write here is saved to your private room, and the responses are generated from a local support framework so you can come back to the same thread later.',
  created_at: new Date(),
}

export default function TherapyPage() {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<Message[]>([welcomeMessage])
  const [angels, setAngels] = useState<Record<string, unknown>[]>([])
  const [mentors, setMentors] = useState<Record<string, unknown>[]>([])
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const roomId = user ? `guided-support-${user.userId}` : null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  useEffect(() => {
    async function loadTherapyData() {
      if (!user || !roomId) return

      try {
        const [savedMessages, supportAngels, supportMentors] = await Promise.all([
          DatabaseService.getMessages(roomId, 80),
          DatabaseService.getUserAngels(user.userId),
          DatabaseService.getMentors(),
        ])

        const restoredMessages = (savedMessages as Record<string, unknown>[])
          .map((message) => ({
            id: message.id as string,
            role: (message.is_ai ? 'guide' : 'user') as 'user' | 'guide',
            content: message.message as string,
            created_at: toDate(message.created_at) || new Date(),
          }))

        setMessages([welcomeMessage, ...restoredMessages])
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

  const latestGuideReply = useMemo(() => messages.filter((message) => message.role === 'guide').at(-1), [messages])

  async function sendMessage(content: string) {
    if (!content.trim() || !user || !roomId) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      created_at: new Date(),
    }

    setMessages((current) => [...current, userMessage])
    setInputValue('')
    setSending(true)

    try {
      await DatabaseService.sendMessage(user.userId, null, roomId, userMessage.content, false)
    } catch (error) {
      console.error('Failed to save user message:', error)
    }

    const reply = buildGuidedSupportReply(userMessage.content, messages.length)
    const guideMessage: Message = {
      id: crypto.randomUUID(),
      role: 'guide',
      content: reply.text,
      created_at: new Date(),
    }

    window.setTimeout(async () => {
      setMessages((current) => [...current, guideMessage])
      setSending(false)

      try {
        await DatabaseService.sendMessage('guided-support', null, roomId, guideMessage.content, true)
      } catch (error) {
        console.error('Failed to save guide reply:', error)
      }
    }, 650)
  }

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

  return (
    <PageFrame>
      <div className="page-grid lg:grid-cols-[minmax(0,1.15fr)_22rem] lg:items-start">
        <section className="card flex min-h-[38rem] flex-col">
          <div className="border-b border-[#eedfc8]/8 pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
              Therapy
            </p>
            <div className="mt-2 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-[#eedfc8]">Guided support</h1>
                <p className="mt-2 max-w-2xl text-sm text-[#eedfc8]/60">
                  A persistent reflection room with grounded, non-demo replies and live support contacts beside it.
                </p>
              </div>
              <div className="badge bg-[#6B8A83]/16 text-[#6B8A83]">Saved to your room</div>
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
                  className="rounded-full bg-[#eedfc8]/8 px-4 py-2 text-xs whitespace-nowrap text-[#eedfc8]/70 transition-colors hover:bg-[#eedfc8]/14"
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
              />
              <button
                onClick={() => sendMessage(inputValue)}
                disabled={!inputValue.trim() || sending}
                className="btn-primary !px-4 !py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="card">
            <h2 className="section-title">Current guide note</h2>
            <p className="text-sm leading-relaxed text-[#eedfc8]/70">
              {latestGuideReply?.content || 'Your most recent support response will appear here.'}
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
                  const profile = (angel.profile as Record<string, unknown> | undefined) ?? {}
                  const name =
                    (profile.full_name as string | undefined) ||
                    (profile.username as string | undefined) ||
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
                  const profile = (mentor.profile as Record<string, unknown> | undefined) ?? {}
                  const name =
                    (profile.full_name as string | undefined) ||
                    (profile.username as string | undefined) ||
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
              If you are in immediate danger or might hurt yourself, call local emergency services or a crisis line now.
            </p>
            <p className="mt-3 text-xs text-[#eedfc8]/45">
              The guided room is supportive, but it is not a substitute for emergency care.
            </p>
            <p className="mt-3 text-xs text-[#eedfc8]/35">
              Last guide message: {latestGuideReply ? formatRelativeTime(latestGuideReply.created_at) : 'just now'}
            </p>
          </section>
        </aside>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
