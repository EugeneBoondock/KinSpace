'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'

const navItems = [
  { href: '/dashboard', label: 'Home', icon: 'ri-home-4-line', activeIcon: 'ri-home-4-fill' },
  { href: '/explore', label: 'Explore', icon: 'ri-compass-3-line', activeIcon: 'ri-compass-3-fill' },
  { href: '/community', label: 'Community', icon: 'ri-chat-3-line', activeIcon: 'ri-chat-3-fill' },
  { href: '/resources', label: 'Resources', icon: 'ri-book-open-line', activeIcon: 'ri-book-open-fill' },
  { href: '/profile', label: 'Profile', icon: 'ri-user-line', activeIcon: 'ri-user-fill' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-brand-primary/95 backdrop-blur-md border-t border-[#eedfc8]/10 z-50 bottom-nav-safe md:hidden">
        <div className="grid grid-cols-5 h-16">
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
    return pathname.startsWith(href)
  }

  const getHref = (item: typeof navItems[0]) => {
    if (item.href === '/profile' && user) return `/profile/${user.userId}`
    if (item.href === '/profile') return '/login'
    return item.href
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-brand-primary/95 backdrop-blur-md border-t border-[#eedfc8]/10 z-50 bottom-nav-safe md:hidden">
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.label}
              href={getHref(item)}
              className={`flex flex-col items-center justify-center gap-0.5 transition-all duration-200 ${
                active ? 'text-[#eedfc8]' : 'text-[#eedfc8]/40'
              }`}
            >
              <i className={`${active ? item.activeIcon : item.icon} text-xl`} />
              <span className={`text-[10px] ${active ? 'font-semibold' : 'font-normal'}`}>
                {item.label}
              </span>
              {active && <div className="w-1 h-1 rounded-full bg-brand-accent2 mt-0.5" />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
