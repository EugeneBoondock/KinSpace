import { getEnv } from '../env'
import * as usersRepo from '../repos/users'
import { hashPassword, verifyPassword, randomToken } from './crypto'
import { createSession, invalidateAllSessions } from './session'
import { sendEmail, verificationEmailHtml, passwordResetEmailHtml } from '../email'
import type { SignUpInput, SignInInput } from '@/lib/schemas/auth'

const VERIFY_PREFIX = 'emailverify:'
const RESET_PREFIX = 'pwreset:'
const VERIFY_TTL = 60 * 60 * 24 // 24h
const RESET_TTL = 60 * 60 // 1h

export class AuthError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'AuthError'
  }
}

type SessionMeta = { userAgent?: string | null; ip?: string | null }
type AuthSuccess = { userId: string; token: string; expiresAt: number }

function appUrl(): string {
  return getEnv().NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export async function signUp(input: SignUpInput, meta?: SessionMeta): Promise<AuthSuccess> {
  const existing = await usersRepo.getUserByEmail(input.email)
  if (existing) throw new AuthError('email-taken', 'An account with this email already exists.')
  if (await usersRepo.isUsernameTaken(input.username)) {
    throw new AuthError('username-taken', 'That username is already taken.')
  }

  const passwordHash = await hashPassword(input.password)
  const { userId } = await usersRepo.createUserWithProfile({
    email: input.email,
    passwordHash,
    username: input.username,
    fullName: input.fullName,
  })

  await sendVerificationEmail(userId, input.email)
  const { token, expiresAt } = await createSession(userId, meta)
  return { userId, token, expiresAt }
}

export async function signIn(input: SignInInput, meta?: SessionMeta): Promise<AuthSuccess> {
  const user = await usersRepo.getUserByEmail(input.email)
  if (!user || !user.passwordHash) {
    throw new AuthError('invalid-credentials', 'Incorrect email or password.')
  }
  if (user.status !== 'active') {
    throw new AuthError('account-disabled', 'This account is not active. Contact support.')
  }
  const ok = await verifyPassword(input.password, user.passwordHash)
  if (!ok) throw new AuthError('invalid-credentials', 'Incorrect email or password.')

  await usersRepo.touchLastLogin(user.id)
  const { token, expiresAt } = await createSession(user.id, meta)
  return { userId: user.id, token, expiresAt }
}

async function sendVerificationEmail(userId: string, email: string): Promise<{ ok: boolean }> {
  const token = randomToken(24)
  await getEnv().KV.put(VERIFY_PREFIX + token, userId, { expirationTtl: VERIFY_TTL })
  return sendEmail({
    to: email,
    subject: 'Verify your KinSpace email',
    html: verificationEmailHtml(`${appUrl()}/api/auth/verify?token=${token}`),
  })
}

export async function resendVerification(userId: string, email: string): Promise<{ ok: boolean }> {
  return sendVerificationEmail(userId, email)
}

export async function verifyEmail(token: string): Promise<boolean> {
  const kv = getEnv().KV
  const userId = await kv.get(VERIFY_PREFIX + token)
  if (!userId) return false
  await usersRepo.setEmailVerified(userId)
  await kv.delete(VERIFY_PREFIX + token)
  return true
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await usersRepo.getUserByEmail(email)
  if (!user) return // do not leak which emails exist
  const token = randomToken(24)
  await getEnv().KV.put(RESET_PREFIX + token, user.id, { expirationTtl: RESET_TTL })
  await sendEmail({
    to: email,
    subject: 'Reset your KinSpace password',
    html: passwordResetEmailHtml(`${appUrl()}/reset-password?token=${token}`),
  })
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const kv = getEnv().KV
  const userId = await kv.get(RESET_PREFIX + token)
  if (!userId) throw new AuthError('invalid-token', 'This reset link is invalid or has expired.')
  const passwordHash = await hashPassword(password)
  await usersRepo.setPasswordHash(userId, passwordHash)
  await invalidateAllSessions(userId)
  await kv.delete(RESET_PREFIX + token)
}
