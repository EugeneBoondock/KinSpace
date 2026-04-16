'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { classNames } from '@/lib/platform'

const navItems = [
  { href: '/dashboard', label: 'Home', icon: 'ri-home-4-line', activeIcon: 'ri-home-4-fill' },
  { href: '/community', label: 'Community', icon: 'ri-chat-3-line', activeIcon: 'ri-chat-3-fill' },
  { href: '/ask', label: 'Ask', icon: 'ri-search-2-line', activeIcon: 'ri-search-2-fill' },
  { href: '/insights', label: 'Insights', icon: 'ri-heart-pulse-line', activeIcon: 'ri-heart-pulse-fill' },
  { href: '/profile', label: 'Profile', icon: 'ri-user-line', activeIcon: 'ri-user-fill' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { user, loading } = useAuth()
  const [pendingStrands, setPendingStrands] = useState(0)

  useEffect(() => {
    if (!user) {
      setPendingStrands(0)
      return
    }
    let cancelled = false
    DatabaseService.getStrandCounts(user.userId)
      .then((counts) => {
        if (!cancelled) setPendingStrands(counts.pendingReceived)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [user, pathname])

  const navClassName =
    'fixed bottom-0 left-0 right-0 z-50 border-t border-[#eedfc8]/10 bg-brand-primary/95 backdrop-blur-md bottom-nav-safe md:bottom-4 md:left-1/2 md:right-auto md:w-auto md:min-w-[42rem] md:-translate-x-1/2 md:rounded-full md:border md:border-[#eedfc8]/15 md:bg-[#234139]/92 md:px-3 md:shadow-[0_22px_55px_rgba(16,28,24,0.34)]'

  if (loading) {
    return (
      <nav className={navClassName}>
        <div className="grid h-16 grid-cols-5 md:h-[4.25rem] md:min-w-[38rem]">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="flex flex-col items-center justify-center gap-1">
              <div className="w-5 h-5 skeleton rounded-full" />
              <div className="w-8 h-2 skeleton rounded" />
            </div>
          ))}
        </div>
      </nav>
    )
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/'
    if (href === '/profile') return pathname.startsWith('/profile') || pathname.startsWith('/settings')
    if (href === '/insights')
      return (
        pathname.startsWith('/insights') ||
        pathname.startsWith('/conditions') ||
        pathname.startsWith('/treatments') ||
        pathname.startsWith('/share-experience') ||
        pathname.startsWith('/research') ||
        pathname.startsWith('/resources')
      )
    if (href === '/ask') return pathname.startsWith('/ask')
    if (href === '/community')
      return (
        pathname.startsWith('/community') ||
        pathname.startsWith('/groups') ||
        pathname.startsWith('/explore') ||
        pathname.startsWith('/strands') ||
        pathname.startsWith('/trauma-bonding')
      )
    return pathname.startsWith(href)
  }

  const getHref = (item: typeof navItems[0]) => {
    if (item.href === '/profile' && user) return `/profile/${user.userId}`
    if (item.href === '/profile') return '/login'
    return item.href
  }

  return (
    <nav className={navClassName}>
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5 md:h-[4.25rem] md:max-w-none md:min-w-[38rem] md:gap-1">
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.label}
              href={getHref(item)}
              className={classNames(
                'flex flex-col items-center justify-center gap-0.5 transition-all duration-200 md:flex-row md:gap-2 md:rounded-full md:px-4',
                active
                  ? 'text-[#eedfc8] md:bg-[#eedfc8]/10'
                  : 'text-[#eedfc8]/40 md:text-[#eedfc8]/55 md:hover:bg-[#eedfc8]/6 md:hover:text-[#eedfc8]/80',
              )}
            >
              <div className="relative">
                <i className={`${active ? item.activeIcon : item.icon} text-xl`} />
                {item.href === '/community' && pendingStrands > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#B85C3A] px-1 text-[9px] font-bold text-[#eedfc8]">
                    {pendingStrands > 9 ? '9+' : pendingStrands}
                  </span>
                )}
              </div>
              <span className={`text-[10px] md:text-sm ${active ? 'font-semibold' : 'font-normal'}`}>
                {item.label}
              </span>
              {active && <div className="mt-0.5 h-1 w-1 rounded-full bg-brand-accent2 md:mt-0 md:h-2 md:w-2" />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
