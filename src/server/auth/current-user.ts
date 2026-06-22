import { cache } from 'react'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users, profiles } from '../db/schema'
import { SESSION_COOKIE, validateSession } from './session'

export type CurrentUser = {
  userId: string
  email: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  emailVerified: boolean
  role: string
  onboardingComplete: boolean
  isAnonymousDefault: boolean
}

/**
 * Resolves the authenticated user for the current request from the session
 * cookie. Memoised per-request with React cache(). Returns null if unauth.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  const session = await validateSession(token)
  if (!session) return null

  const db = getDb()
  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) })
  if (!user || user.status !== 'active') return null

  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, session.userId) })

  return {
    userId: user.id,
    email: user.email,
    username: profile?.username ?? '',
    displayName: profile?.fullName ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    emailVerified: user.emailVerified,
    role: user.role,
    onboardingComplete: profile?.onboardingComplete ?? false,
    isAnonymousDefault: profile?.isAnonymous ?? false,
  }
})

/** Throwing variant for server actions/routes that require auth. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error('UNAUTHENTICATED')
  return user
}

/** Requires the user to hold one of the given roles (admin satisfies all). */
export async function requireRole(...roles: Array<'moderator' | 'admin'>): Promise<CurrentUser> {
  const user = await requireUser()
  const ok = user.role === 'admin' || roles.includes(user.role as 'moderator' | 'admin')
  if (!ok) throw new Error('FORBIDDEN')
  return user
}
