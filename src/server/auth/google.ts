import { getEnv } from '../env'
import * as usersRepo from '../repos/users'
import { createSession } from './session'
import { AuthError } from './service'

type SessionMeta = { userAgent?: string | null; ip?: string | null }

export function googleRedirectUri(): string {
  const base = getEnv().NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base}/api/auth/google/callback`
}

export function buildGoogleAuthUrl(state: string): string {
  const env = getEnv()
  if (!env.GOOGLE_CLIENT_ID) throw new AuthError('google-not-configured', 'Google sign-in is not configured.')
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

type GoogleResult = { userId: string; token: string; expiresAt: number; isNew: boolean }

export async function handleGoogleCallback(code: string, meta?: SessionMeta): Promise<GoogleResult> {
  const env = getEnv()
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new AuthError('google-not-configured', 'Google sign-in is not configured.')
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })
  if (!tokenRes.ok) throw new AuthError('google-token-failed', 'Could not complete Google sign-in.')
  const tokenData = (await tokenRes.json()) as { access_token?: string }
  if (!tokenData.access_token) throw new AuthError('google-token-failed', 'Could not complete Google sign-in.')

  const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  if (!infoRes.ok) throw new AuthError('google-userinfo-failed', 'Could not read your Google profile.')
  const info = (await infoRes.json()) as {
    sub: string
    email: string
    email_verified?: boolean
    name?: string
    picture?: string
  }

  let user = await usersRepo.getUserByGoogleId(info.sub)
  if (!user) {
    const byEmail = await usersRepo.getUserByEmail(info.email)
    if (byEmail) {
      await usersRepo.linkGoogleId(byEmail.id, info.sub)
      user = byEmail
    }
  }

  let isNew = false
  if (!user) {
    const base = (info.name ?? info.email.split('@')[0]).toLowerCase().replace(/[^a-z0-9_]/g, '')
    const { userId } = await usersRepo.createUserWithProfile({
      email: info.email,
      username: base || 'friend',
      fullName: info.name ?? '',
      googleId: info.sub,
      emailVerified: Boolean(info.email_verified),
      avatarUrl: info.picture ?? null,
    })
    user = await usersRepo.getUserById(userId)
    isNew = true
  }

  if (!user) throw new AuthError('google-failed', 'Could not complete Google sign-in.')
  const { token, expiresAt } = await createSession(user.id, meta)
  return { userId: user.id, token, expiresAt, isNew }
}
