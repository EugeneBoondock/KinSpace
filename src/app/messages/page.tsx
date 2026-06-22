'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PageFrame from '@/components/PageFrame'
import BottomNav from '@/components/BottomNav'
import SocialStarterPanel from '@/components/SocialStarterPanel'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { formatRelativeTime, getInitials, toDate } from '@/lib/platform'
import { Card, Skeleton } from '@/components/ui'

type PartnerProfile = {
  id?: string
  user_id?: string
  username?: string
  full_name?: string | null
  pseudonym?: string | null
  is_anonymous?: boolean
  avatar_url?: string | null
} | null

type Conversation = {
  partner_id: string
  last_message: string
  last_at: string | null
  last_from_me: boolean
  unread: number
  partner: PartnerProfile
}

type ThreadMessage = {
  id: string
  message: string
  sender_id: string
  from_me: boolean
  created_at: string | null
}

function partnerName(partner: PartnerProfile): string {
  if (!partner) return 'Member'
  if (partner.is_anonymous) return partner.pseudonym || 'Anonymous'
  return partner.full_name || partner.username || 'Member'
}

function Avatar({ partner, size = 40 }: { partner: PartnerProfile; size?: number }) {
  const name = partnerName(partner)
  const url = partner?.is_anonymous ? null : partner?.avatar_url
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-accent2/20 text-sm font-bold text-brand-accent2"
      style={{ width: size, height: size }}
    >
      {getInitials(name)}
    </div>
  )
}

function MessagesInner() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const toParam = searchParams.get('to')

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [activeUserId, setActiveUserId] = useState<string | null>(toParam)
  const [thread, setThread] = useState<{ partner: PartnerProfile; messages: ThreadMessage[] } | null>(null)
  const [loadingThread, setLoadingThread] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    setActiveUserId(toParam)
  }, [toParam])

  const loadConversations = useCallback(async () => {
    if (!user) return
    try {
      const rows = (await DatabaseService.getConversations(user.userId)) as Conversation[]
      setConversations(Array.isArray(rows) ? rows : [])
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setLoadingList(false)
    }
  }, [user])

  useEffect(() => {
    if (user) void loadConversations()
  }, [user, loadConversations])

  const loadThread = useCallback(async () => {
    if (!user || !activeUserId) {
      setThread(null)
      return
    }
    try {
      const data = (await DatabaseService.getDirectMessages(activeUserId)) as {
        partner: PartnerProfile
        messages: ThreadMessage[]
      }
      setThread(data ?? { partner: null, messages: [] })
    } catch (error) {
      console.error('Failed to load thread:', error)
    } finally {
      setLoadingThread(false)
    }
  }, [user, activeUserId])

  useEffect(() => {
    if (!activeUserId) {
      setThread(null)
      return
    }
    setLoadingThread(true)
    void loadThread()
    // Poll only while the tab is visible; refresh on focus. Keeps the thread
    // live without hammering the API on a backgrounded tab.
    const interval = window.setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) void loadThread()
    }, 20000)
    const onVisible = () => {
      if (typeof document !== 'undefined' && !document.hidden) void loadThread()
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(interval)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
    }
  }, [activeUserId, loadThread])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread?.messages.length])

  function openThread(partnerId: string) {
    setActiveUserId(partnerId)
    router.replace(`/messages?to=${partnerId}`)
  }

  function backToList() {
    setActiveUserId(null)
    router.replace('/messages')
  }

  async function send() {
    const text = input.trim()
    if (!text || !activeUserId || sending) return
    setSending(true)
    setInput('')
    try {
      await DatabaseService.sendDirectMessage(activeUserId, text)
      await Promise.all([loadThread(), loadConversations()])
    } catch (error) {
      console.error('Failed to send message:', error)
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  const activeName = useMemo(() => partnerName(thread?.partner ?? null), [thread?.partner])

  return (
    <PageFrame>
      <div className="page-grid space-y-4 overflow-x-hidden">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent2">Direct</p>
          <h1 className="text-2xl font-bold text-brand-background sm:text-3xl">Messages</h1>
        </header>

        <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
          {/* Conversation list - hidden on mobile when a thread is open */}
          <div className={activeUserId ? 'hidden lg:block' : 'block'}>
            <div className="overflow-hidden rounded-2xl border border-brand-line bg-brand-surface shadow-[var(--shadow-card)]">
              {loadingList ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-14 rounded-xl" />
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="space-y-4 p-4">
                  <div className="text-center text-sm leading-relaxed text-brand-background/60">
                    No conversations yet. Start with a strand so the first message has context.
                  </div>
                  <SocialStarterPanel
                    compact
                    title="Start from a match"
                    description="Shared health signals and live support help you choose a person before opening a direct message."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-brand-line">
                  {conversations.map((conversation) => {
                    const when = toDate(conversation.last_at)
                    const isActive = conversation.partner_id === activeUserId
                    return (
                      <li key={conversation.partner_id}>
                        <button
                          type="button"
                          onClick={() => openThread(conversation.partner_id)}
                          className={`flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-brand-background/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 ${
                            isActive ? 'bg-brand-background/[0.06]' : ''
                          }`}
                        >
                          <Avatar partner={conversation.partner} size={44} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-brand-background">
                                {partnerName(conversation.partner)}
                              </p>
                              {when && <span className="shrink-0 text-[10px] text-brand-background/40">{formatRelativeTime(when)}</span>}
                            </div>
                            <p className="truncate text-xs text-brand-background/55">
                              {conversation.last_from_me ? 'You: ' : ''}
                              {conversation.last_message}
                            </p>
                          </div>
                          {conversation.unread > 0 && (
                            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-accent2 px-1.5 text-[10px] font-bold text-white">
                              {conversation.unread}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Thread pane */}
          <div className={activeUserId ? 'block' : 'hidden lg:block'}>
            {!activeUserId ? (
              <Card>
                <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center text-sm text-brand-background/50">
                  <i className="ri-chat-3-line mb-2 text-3xl text-brand-background/30" aria-hidden="true" />
                  <p>Pick a conversation to read it here.</p>
                  {conversations.length === 0 && (
                    <SocialStarterPanel
                      compact
                      embedded
                      title="No inbox yet"
                      description="Send a strand to someone with shared symptoms, treatments, or goals first."
                      className="w-full text-left"
                    />
                  )}
                </div>
              </Card>
            ) : (
              <div className="flex h-[70dvh] flex-col overflow-hidden rounded-2xl border border-brand-line bg-brand-surface shadow-[var(--shadow-card)]">
                <div className="flex shrink-0 items-center gap-3 border-b border-brand-line p-3">
                  <button
                    type="button"
                    onClick={backToList}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-brand-background/65 hover:bg-brand-background/[0.08] lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                    aria-label="Back"
                  >
                    <i className="ri-arrow-left-line" aria-hidden="true" />
                  </button>
                  <Avatar partner={thread?.partner ?? null} size={36} />
                  <p className="truncate text-sm font-semibold text-brand-background">{activeName}</p>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {loadingThread && !thread ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-2/3 rounded-2xl" />
                      <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
                    </div>
                  ) : (thread?.messages.length ?? 0) === 0 ? (
                    <p className="py-8 text-center text-xs text-brand-background/50">
                      Say hello to start the conversation.
                    </p>
                  ) : (
                    thread?.messages.map((message) => (
                      <div key={message.id} className={`flex ${message.from_me ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                            message.from_me
                              ? 'rounded-br-md bg-brand-accent2 text-white'
                              : 'rounded-bl-md bg-brand-background/[0.08] text-brand-background'
                          }`}
                        >
                          <p className="whitespace-pre-line break-words">{message.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={endRef} />
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void send()
                  }}
                  className="flex shrink-0 items-end gap-2 border-t border-brand-line p-3"
                >
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        void send()
                      }
                    }}
                    rows={1}
                    maxLength={4000}
                    placeholder={`Message ${activeName}`}
                    className="max-h-32 flex-1 resize-none rounded-2xl border border-brand-line bg-brand-background/[0.04] px-3 py-2 text-sm text-brand-background placeholder:text-brand-background/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || sending}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-accent2 text-white transition hover:brightness-105 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/40"
                    aria-label="Send"
                  >
                    <i className="ri-send-plane-2-fill" aria-hidden="true" />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNav />
    </PageFrame>
  )
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <PageFrame>
          <div className="page-grid space-y-4">
            <Skeleton className="h-10 w-40 rounded-xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </PageFrame>
      }
    >
      <MessagesInner />
    </Suspense>
  )
}
