'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageFrame from '@/components/PageFrame'
import BottomNav from '@/components/BottomNav'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { ensureNotificationPermission } from '@/lib/notify-client'
import { formatRelativeTime, toDate } from '@/lib/platform'
import { Card, EmptyState, Skeleton } from '@/components/ui'

type NotificationRow = {
  id: string
  type: string
  title: string
  body: string | null
  data: Record<string, unknown> | null
  read_at: string | null
  created_at: string | null
}

const typeIcons: Record<string, string> = {
  dm: 'ri-chat-3-line',
  connection_request: 'ri-user-add-line',
  connection_accepted: 'ri-user-heart-line',
  achievement: 'ri-medal-line',
  quiet_checkin: 'ri-heart-3-line',
  group_invite: 'ri-group-line',
  group_role: 'ri-shield-star-line',
  expertise: 'ri-lightbulb-flash-line',
}

function notificationAction(row: NotificationRow): { label: string; href: string } | null {
  const data = row.data ?? {}
  const fromUserId = (data.from_user_id ?? data.fromUserId) as string | undefined
  if (row.type === 'dm' && fromUserId) return { label: 'Open conversation', href: `/messages?to=${fromUserId}` }
  if (row.type === 'connection_request' || row.type === 'connection_accepted')
    return { label: 'View your strands', href: '/strands' }
  if (row.type === 'quiet_checkin') return { label: 'Go to your space', href: '/dashboard' }
  const groupId = (data.group_id ?? data.groupId) as string | undefined
  if ((row.type === 'group_invite' || row.type === 'group_role') && groupId)
    return { label: 'Open the group', href: `/groups/${groupId}` }
  const postId = (data.post_id ?? data.postId) as string | undefined
  if (row.type === 'expertise') {
    if (groupId) return { label: 'Open the group', href: `/groups/${groupId}` }
    if (postId) return { label: 'View the post', href: '/community' }
    return { label: 'Go to community', href: '/community' }
  }
  return null
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [selected, setSelected] = useState<NotificationRow | null>(null)

  function openNotification(item: NotificationRow) {
    // Tapping a notification is a user gesture, a good moment to ask for
    // permission so future alerts can pop up on mobile.
    void ensureNotificationPermission()
    setSelected(item)
    if (!item.read_at) {
      setItems((current) => current.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)))
      DatabaseService.markNotificationsRead([item.id]).catch(() => undefined)
    }
  }

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    async function load() {
      if (!user) return
      try {
        const rows = (await DatabaseService.getNotifications(user.userId)) as NotificationRow[]
        setItems(Array.isArray(rows) ? rows : [])
      } catch (error) {
        console.error('Failed to load notifications:', error)
      } finally {
        setLoading(false)
      }
    }
    if (user) load()
  }, [user])

  return (
    <PageFrame>
      <div className="page-grid space-y-6 overflow-x-hidden">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent2">Activity</p>
          <h1 className="text-2xl font-bold text-brand-background sm:text-3xl">Notifications</h1>
        </header>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card>
            <EmptyState
              icon={<i className="ri-notification-3-line text-2xl" aria-hidden="true" />}
              title="Nothing new"
              description="Messages, connection requests, and replies will show up here."
            />
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const when = toDate(item.created_at)
              const unread = !item.read_at
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40 ${
                    unread
                      ? 'border-brand-accent2/40 bg-brand-accent2/[0.08]'
                      : 'border-brand-line bg-brand-background/[0.03] hover:bg-brand-background/[0.06]'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent2/15 text-brand-accent2">
                    <i className={typeIcons[item.type] ?? 'ri-notification-3-line'} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-brand-background">{item.title}</p>
                    {item.body && <p className="mt-0.5 line-clamp-2 text-xs text-brand-background/60">{item.body}</p>}
                    {when && <p className="mt-1 text-[11px] text-brand-background/40">{formatRelativeTime(when)}</p>}
                  </div>
                  {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-accent2" />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-brand-line bg-brand-surface p-6 shadow-2xl sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-accent2/15 text-brand-accent2">
                <i className={typeIcons[selected.type] ?? 'ri-notification-3-line'} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-brand-background">{selected.title}</h2>
                {toDate(selected.created_at) && (
                  <p className="mt-0.5 text-xs text-brand-background/50">
                    {formatRelativeTime(toDate(selected.created_at)!)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="shrink-0 rounded-full p-1.5 text-brand-background/50 transition-colors hover:bg-brand-background/[0.06] hover:text-brand-background"
              >
                <i className="ri-close-line text-xl" aria-hidden="true" />
              </button>
            </div>

            {selected.body && (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-brand-background/80">{selected.body}</p>
            )}

            {(() => {
              const action = notificationAction(selected)
              if (!action) return null
              return (
                <button
                  type="button"
                  onClick={() => {
                    const href = action.href
                    setSelected(null)
                    router.push(href)
                  }}
                  className="mt-6 w-full rounded-xl bg-brand-accent2 px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  {action.label}
                </button>
              )
            })()}
          </div>
        </div>
      )}

      <BottomNav />
    </PageFrame>
  )
}
