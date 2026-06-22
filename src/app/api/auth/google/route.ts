import { NextResponse } from 'next/server'
import { buildGoogleAuthUrl } from '@/server/auth/google'
import { randomToken } from '@/server/auth/crypto'
import { AuthError } from '@/server/auth/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATE_COOKIE = 'g_oauth_state'

export async function GET() {
  try {
    const state = randomToken(16)
    const url = buildGoogleAuthUrl(state)
    const res = NextResponse.redirect(url)
    res.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    })
    return res
  } catch (error) {
    const message = error instanceof AuthError ? error.message : 'Google sign-in unavailable'
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
    )
  }
}
