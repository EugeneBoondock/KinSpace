import { NextRequest, NextResponse } from 'next/server'
import { handleGoogleCallback } from '@/server/auth/google'
import { SESSION_COOKIE } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATE_COOKIE = 'g_oauth_state'
const isProd = process.env.NODE_ENV === 'production'

function appOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const savedState = request.cookies.get(STATE_COOKIE)?.value

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL('/login?error=Google+sign-in+failed', appOrigin()))
  }

  try {
    const meta = {
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('cf-connecting-ip'),
    }
    const { token, expiresAt, isNew } = await handleGoogleCallback(code, meta)
    const res = NextResponse.redirect(new URL(isNew ? '/onboarding' : '/dashboard', appOrigin()))
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      expires: new Date(expiresAt),
    })
    res.cookies.delete(STATE_COOKIE)
    return res
  } catch (error) {
    console.error('Google callback failed:', error)
    return NextResponse.redirect(new URL('/login?error=Google+sign-in+failed', appOrigin()))
  }
}
