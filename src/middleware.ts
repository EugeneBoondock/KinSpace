import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/server/auth/constants'

/**
 * Optimistic, edge-fast route protection based on session-cookie presence.
 * Authoritative validation (active session, email verified, onboarding) is
 * enforced in server components via getCurrentUser()/requireUser().
 */

// Publicly readable (SEO + marketing + legal). Prefix match.
const PUBLIC_PREFIXES = [
  '/',
  '/conditions',
  '/treatments',
  '/research',
  '/resources',
  '/pricing',
  '/about',
  '/privacy',
  '/terms',
  '/community-guidelines',
  '/crisis',
  '/symptom-checker',
  '/offline',
]

// Auth pages: redirect signed-in users away.
const AUTH_PAGES = ['/login', '/signup', '/forgot-password', '/reset-password']

function isExactOrChild(pathname: string, base: string): boolean {
  if (base === '/') return pathname === '/'
  return pathname === base || pathname.startsWith(`${base}/`)
}

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((base) => isExactOrChild(pathname, base))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = request.cookies.has(SESSION_COOKIE)

  if (AUTH_PAGES.includes(pathname)) {
    if (hasSession) return NextResponse.redirect(new URL('/dashboard', request.url))
    return NextResponse.next()
  }

  if (!isPublic(pathname) && !hasSession) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // Run on everything except API routes, Next internals, and static assets.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|robots.txt|sitemap.xml|llms.txt|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
