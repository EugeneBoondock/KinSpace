'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import ProfileAvatar from '@/components/ProfileAvatar'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { classNames, getInitials } from '@/lib/platform'
import { alertNewNotification } from '@/lib/notify-client'
import { buildSystemNotificationData } from '@/lib/notification-routing'

type NavItem = {
  href: string
  label: string
  icon: string
  activeIcon: string
}

type NavGroup = {
  title: string
  items: NavItem[]
}

// Primary destinations for the mobile tab bar and the top of the sidebar.
const primaryNav: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: 'ri-home-5-line', activeIcon: 'ri-home-5-fill' },
  { href: '/community', label: 'Community', icon: 'ri-chat-3-line', activeIcon: 'ri-chat-3-fill' },
  { href: '/ask', label: 'Ask', icon: 'ri-search-2-line', activeIcon: 'ri-search-2-fill' },
  { href: '/insights', label: 'Insights', icon: 'ri-heart-pulse-line', activeIcon: 'ri-heart-pulse-fill' },
]

// Everything else, grouped so the sidebar and the mobile "More" sheet read as
// clusters instead of one long list. Both surfaces render from this one source.
const navGroups: NavGroup[] = [
  {
    title: 'Connect',
    items: [
      { href: '/strands', label: 'Connections', icon: 'ri-links-line', activeIcon: 'ri-links-fill' },
      { href: '/groups', label: 'Groups', icon: 'ri-group-line', activeIcon: 'ri-group-fill' },
      { href: '/people-like-you', label: 'People like you', icon: 'ri-team-line', activeIcon: 'ri-team-fill' },
      { href: '/support', label: 'Lanterns', icon: 'ri-hand-heart-line', activeIcon: 'ri-hand-heart-fill' },
      { href: '/messages', label: 'Messages', icon: 'ri-mail-line', activeIcon: 'ri-mail-fill' },
      { href: '/notifications', label: 'Notifications', icon: 'ri-notification-3-line', activeIcon: 'ri-notification-3-fill' },
      { href: '/explore', label: 'Explore', icon: 'ri-compass-3-line', activeIcon: 'ri-compass-3-fill' },
    ],
  },
  {
    title: 'Care',
    items: [
      { href: '/care', label: 'Care plan', icon: 'ri-road-map-line', activeIcon: 'ri-road-map-fill' },
      { href: '/symptom-checker', label: 'Symptom check', icon: 'ri-stethoscope-line', activeIcon: 'ri-stethoscope-fill' },
      { href: '/therapy', label: 'Guide', icon: 'ri-mental-health-line', activeIcon: 'ri-mental-health-fill' },
      { href: '/conditions', label: 'Conditions', icon: 'ri-flask-line', activeIcon: 'ri-flask-fill' },
      { href: '/resources', label: 'Resources', icon: 'ri-book-open-line', activeIcon: 'ri-book-open-fill' },
    ],
  },
  {
    title: 'You',
    items: [
      { href: '/saved', label: 'Saved', icon: 'ri-bookmark-line', activeIcon: 'ri-bookmark-fill' },
      { href: '/timeline', label: 'My timeline', icon: 'ri-history-line', activeIcon: 'ri-history-fill' },
      { href: '/calendar', label: 'Calendar', icon: 'ri-calendar-line', activeIcon: 'ri-calendar-fill' },
      { href: '/plan', label: 'Plan', icon: 'ri-bank-card-line', activeIcon: 'ri-bank-card-fill' },
      { href: '/games', label: 'Games', icon: 'ri-gamepad-line', activeIcon: 'ri-gamepad-fill' },
    ],
  },
  {
    title: 'Improve KinSpace',
    items: [
      { href: '/feature-requests', label: 'Feature ideas', icon: 'ri-lightbulb-flash-line', activeIcon: 'ri-lightbulb-flash-fill' },
      { href: '/report-bug', label: 'Report a bug', icon: 'ri-bug-line', activeIcon: 'ri-bug-fill' },
    ],
  },
]

const allSecondary = navGroups.flatMap((group) => group.items)

const profileItem: NavItem = {
  href: '/profile',
  label: 'Profile',
  icon: 'ri-user-3-line',
  activeIcon: 'ri-user-3-fill',
}

const settingsItem: NavItem = {
  href: '/settings',
  label: 'Settings',
  icon: 'ri-settings-3-line',
  activeIcon: 'ri-settings-3-fill',
}

const adminNav: NavItem = {
  href: '/admin',
  label: 'Admin',
  icon: 'ri-shield-star-line',
  activeIcon: 'ri-shield-star-fill',
}

export default function BottomNav() {
  const pathname = usePathname()
  const { user, loading, signOut } = useAuth()
  const [pendingStrands, setPendingStrands] = useState(0)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [unreadMsgs, setUnreadMsgs] = useState(0)
  const [moreOpen, setMoreOpen] = useState(false)
  // Tracks the last-seen unread count so a genuine increase can chime + pop up.
  // Starts at -1 ("not loaded yet") so the first poll never fires an alert.
  const prevNotifRef = useRef(-1)

  useEffect(() => {
    if (!user) {
      setPendingStrands(0)
      return
    }
    let cancelled = false
    DatabaseService.getStrandCounts(user.userId)
      .then((counts) => {
        if (!cancelled) setPendingStrands((counts as { pending_received?: number }).pending_received ?? 0)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [user, pathname])

  // Unread badges for notifications + DMs. Refreshes on navigation and on a slow
  // poll so the counts stay roughly live without hammering the API.
  useEffect(() => {
    if (!user) {
      setUnreadNotifs(0)
      setUnreadMsgs(0)
      return
    }
    let cancelled = false
    const refresh = () => {
      DatabaseService.getUnreadNotificationCount(user.userId)
        .then((raw) => {
          if (cancelled) return
          const count = Number(raw) || 0
          setUnreadNotifs(count)
          const prev = prevNotifRef.current
          prevNotifRef.current = count
          // Alert only on a real increase after the first load, chime + native
          // pop-up (which surfaces on mobile when the PWA is installed).
          if (prev >= 0 && count > prev) {
            DatabaseService.getNotifications(user.userId)
              .then((rows) => {
                const list = Array.isArray(rows) ? rows : []
                const newest = list[0] as {
                  title?: string
                  body?: string | null
                  type?: string
                  data?: Record<string, unknown> | null
                } | undefined
                if (newest?.title) {
                  void alertNewNotification(newest.title, newest.body ?? undefined, buildSystemNotificationData(newest))
                } else {
                  void alertNewNotification('New activity on KinSpace')
                }
              })
              .catch(() => undefined)
          }
        })
        .catch(() => undefined)
      DatabaseService.getUnreadMessageCount(user.userId)
        .then((count) => {
          if (!cancelled) setUnreadMsgs(Number(count) || 0)
        })
        .catch(() => undefined)
    }
    refresh()
    // Poll only while the tab is visible, and refresh on focus - keeps badges
    // live without burning requests (and D1/KV reads) on a backgrounded tab.
    const tick = () => {
      if (typeof document === 'undefined' || !document.hidden) refresh()
    }
    const interval = window.setInterval(tick, 60000)
    const onVisible = () => {
      if (typeof document !== 'undefined' && !document.hidden) refresh()
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.clearInterval(interval)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user, pathname])

  // Close the mobile "More" sheet on navigation + Escape.
  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  // Admins get an extra link. The check is a cheap RPC; non-admins (and
  // anonymous visitors) simply never see it.
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    if (!user) {
      setIsAdmin(false)
      return
    }
    let cancelled = false
    // The dashboard fires a burst of RPCs on mount; a transient failure here used
    // to leave the Admin link hidden until a manual reload. Retry with backoff and
    // refetch on navigation so it self-heals.
    const load = (attempt = 0) => {
      DatabaseService.isAdmin()
        .then((v) => {
          if (!cancelled) setIsAdmin(Boolean(v))
        })
        .catch(() => {
          if (!cancelled && attempt < 3) {
            window.setTimeout(() => load(attempt + 1), 1500 * (attempt + 1))
          }
        })
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user, pathname])

  const isActive = (href: string) => {
    const p = pathname
    if (href === '/dashboard') return p === '/dashboard' || p === '/'
    if (href === '/profile') return p.startsWith('/profile') || p.startsWith('/settings')
    if (href === '/community') return p.startsWith('/community') || p.startsWith('/trauma-bonding')
    if (href === '/strands') return p.startsWith('/strands')
    if (href === '/groups') return p.startsWith('/groups')
    if (href === '/insights')
      return (
        p.startsWith('/insights') ||
        p.startsWith('/treatments') ||
        p.startsWith('/research') ||
        p.startsWith('/share-experience')
      )
    if (href === '/conditions') return p.startsWith('/conditions')
    if (href === '/support') return p.startsWith('/support')
    if (href === '/care') return p.startsWith('/care')
    if (href === '/ask') return p.startsWith('/ask')
    if (href === '/therapy') return p.startsWith('/therapy')
    if (href === '/games') return p.startsWith('/games')
    return p.startsWith(href)
  }

  const resolveHref = (item: NavItem) => {
    if (item.href === '/profile') return user ? `/profile/${user.userId}` : '/login'
    return item.href
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } finally {
      window.location.href = '/login'
    }
  }

  const displayName = user?.displayName || user?.username || 'You'
  const handle = user?.username ? `@${user.username}` : 'View profile'

  const badgeFor = (href: string): number => {
    if (href === '/strands') return pendingStrands
    if (href === '/notifications') return unreadNotifs
    if (href === '/messages') return unreadMsgs
    return 0
  }

  // Anything reachable only from "More" that has a badge feeds the More tab dot.
  const moreBadgeCount = unreadNotifs + unreadMsgs + pendingStrands

  const moreActive =
    !primaryNav.some((item) => isActive(item.href)) &&
    (allSecondary.some((item) => isActive(item.href)) || isActive('/profile') || isActive('/admin'))

  // Active-aware icon + unread badge for a single destination.
  const renderIcon = (item: NavItem, active: boolean) => {
    const count = badgeFor(item.href)
    return (
      <span className="relative inline-flex">
        <i className={`${active ? item.activeIcon : item.icon} text-xl`} aria-hidden="true" />
        {count > 0 && (
          <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-accent1 px-1 text-[9px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </span>
    )
  }

  const sidebarLinkClass = (active: boolean) =>
    classNames(
      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent1/40',
      active ? 'bg-brand-accent1/12 text-brand-accent1' : 'text-brand-ink/70 hover:bg-brand-ink/[0.05] hover:text-brand-ink',
    )

  // Anonymous visitors never see the authenticated app nav. Public pages they can
  // reach (e.g. /conditions) render with the marketing top nav instead, and the
  // page shell drops its sidebar gutter via html[data-authed].
  if (!user) return null

  const sidebarGroups: NavGroup[] = isAdmin
    ? navGroups.map((group) =>
        group.title === 'Improve KinSpace' ? { ...group, items: [...group.items, adminNav] } : group,
      )
    : navGroups

  return (
    <>
      {/* ───────── Desktop: persistent left sidebar ───────── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-brand-line bg-brand-surface md:flex">
        <Link
          href={user ? '/dashboard' : '/'}
          className="flex items-center gap-2.5 px-6 py-5 focus-visible:outline-none"
          aria-label="KinSpace home"
        >
          <Image src="/images/gather_logo.png" alt="" width={36} height={36} className="h-9 w-9 rounded-xl" priority />
          <span className="text-lg font-bold tracking-tight text-brand-ink">KinSpace</span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <ul className="space-y-1">
            {primaryNav.map((item) => {
              const active = isActive(item.href)
              return (
                <li key={item.href}>
                  <Link href={resolveHref(item)} aria-current={active ? 'page' : undefined} className={sidebarLinkClass(active)}>
                    {renderIcon(item, active)}
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>

          {sidebarGroups.map((group) => (
            <div key={group.title}>
              <p className="px-3 pb-2 pt-5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-brand-ink/35">
                {group.title}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <li key={item.href}>
                      <Link href={resolveHref(item)} aria-current={active ? 'page' : undefined} className={sidebarLinkClass(active)}>
                        {renderIcon(item, active)}
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Account block pinned to the bottom */}
        <div className="border-t border-brand-line p-3">
          <Link
            href={resolveHref(profileItem)}
            className={classNames(
              'flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-brand-ink/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent1/40',
              isActive('/profile') && 'bg-brand-ink/[0.05]')}
          >
            <ProfileAvatar
              alt={displayName}
              avatarUrl={user?.photoURL}
              className="h-9 w-9 shrink-0 rounded-full object-cover"
              fullName={displayName}
              userId={user?.userId}
              username={user?.username}
              fallbackText={getInitials(displayName)}
              fallbackClassName="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent2/20 text-sm font-bold text-brand-background"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-brand-ink">{displayName}</span>
              <span className="block truncate text-xs text-brand-ink/50">{handle}</span>
            </span>
          </Link>
          {user && (
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-brand-ink/60 transition-colors hover:bg-brand-crisis/10 hover:text-brand-crisis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-crisis/40"
            >
              <i className="ri-logout-box-r-line text-lg" aria-hidden="true" />
              Log out
            </button>
          )}
        </div>
      </aside>

      {/* ───────── Mobile: full-feature "More" sheet ───────── */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="More of KinSpace">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-3xl border-t border-brand-line bg-brand-surface pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-18px_48px_rgba(16,28,24,0.35)]">
            <div className="sticky top-0 z-10 bg-brand-surface px-4 pt-3">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-brand-ink/15" />
              <Link
                href={resolveHref(profileItem)}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-brand-ink/[0.05]"
              >
                <ProfileAvatar
                  alt={displayName}
                  avatarUrl={user?.photoURL}
                  className="h-11 w-11 shrink-0 rounded-full object-cover"
                  fullName={displayName}
                  userId={user?.userId}
                  username={user?.username}
                  fallbackText={getInitials(displayName)}
                  fallbackClassName="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-accent2/20 text-sm font-bold text-brand-background"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-brand-ink">{displayName}</span>
                  <span className="block truncate text-xs text-brand-ink/50">{handle}</span>
                </span>
                <i className="ri-arrow-right-s-line text-xl text-brand-ink/40" aria-hidden="true" />
              </Link>
              <div className="mt-2 border-t border-brand-line" />
            </div>

            <div className="px-3">
              {navGroups.map((group) => (
                <div key={group.title}>
                  <p className="px-3 pb-1 pt-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-brand-ink/35">
                    {group.title}
                  </p>
                  <ul className="grid grid-cols-2 gap-1">
                    {group.items.map((item) => {
                      const active = isActive(item.href)
                      return (
                        <li key={item.href}>
                          <Link href={resolveHref(item)} onClick={() => setMoreOpen(false)} aria-current={active ? 'page' : undefined} className={sidebarLinkClass(active)}>
                            {renderIcon(item, active)}
                            {item.label}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}

              <div className="mt-3 border-t border-brand-line pt-3">
                <ul className="space-y-1">
                  <li>
                    <Link href={settingsItem.href} onClick={() => setMoreOpen(false)} aria-current={isActive('/settings') ? 'page' : undefined} className={sidebarLinkClass(isActive('/settings'))}>
                      <i className={`${isActive('/settings') ? settingsItem.activeIcon : settingsItem.icon} text-xl`} aria-hidden="true" />
                      {settingsItem.label}
                    </Link>
                  </li>
                  {isAdmin && (
                    <li>
                      <Link href={adminNav.href} onClick={() => setMoreOpen(false)} aria-current={isActive('/admin') ? 'page' : undefined} className={sidebarLinkClass(isActive('/admin'))}>
                        <i className={`${isActive('/admin') ? adminNav.activeIcon : adminNav.icon} text-xl`} aria-hidden="true" />
                        {adminNav.label}
                      </Link>
                    </li>
                  )}
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false)
                        void handleSignOut()
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-ink/60 transition-colors hover:bg-brand-crisis/10 hover:text-brand-crisis"
                    >
                      <i className="ri-logout-box-r-line text-xl" aria-hidden="true" />
                      Log out
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────── Mobile: solid docked bottom tab bar ───────── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-line bg-brand-surface/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Primary"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {primaryNav.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={resolveHref(item)}
                aria-current={active ? 'page' : undefined}
                className={classNames(
                  'flex h-16 flex-col items-center justify-center gap-1 transition-colors focus-visible:outline-none',
                  active ? 'text-brand-accent1' : 'text-brand-ink/45 hover:text-brand-ink/70')}
              >
                {renderIcon(item, active)}
                <span className={classNames('text-[10px]', active ? 'font-semibold' : 'font-medium')}>{item.label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            aria-label="More"
            className={classNames(
              'flex h-16 flex-col items-center justify-center gap-1 transition-colors focus-visible:outline-none',
              moreActive || moreOpen ? 'text-brand-accent1' : 'text-brand-ink/45 hover:text-brand-ink/70')}
          >
            <span className="relative inline-flex">
              <i className={`${moreActive || moreOpen ? 'ri-apps-2-fill' : 'ri-apps-2-line'} text-xl`} aria-hidden="true" />
              {moreBadgeCount > 0 && !moreOpen && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-accent1 px-1 text-[9px] font-bold text-white">
                  {moreBadgeCount > 9 ? '9+' : moreBadgeCount}
                </span>
              )}
            </span>
            <span className={classNames('text-[10px]', moreActive || moreOpen ? 'font-semibold' : 'font-medium')}>More</span>
          </button>
        </div>
        {loading && <span className="sr-only">Loading navigation</span>}
      </nav>
    </>
  )
}
