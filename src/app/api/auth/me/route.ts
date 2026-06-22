import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/server/auth/current-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Returns the current user in the legacy AuthUser shape, or { user: null }. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ user: null })
  return NextResponse.json({
    user: {
      userId: user.userId,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.avatarUrl,
      emailVerified: user.emailVerified,
    },
  })
}
