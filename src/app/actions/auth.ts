'use server'

import { cookies, headers } from 'next/headers'
import { SESSION_COOKIE, invalidateSession } from '@/server/auth/session'
import * as AuthService from '@/server/auth/service'
import { AuthError } from '@/server/auth/service'
import { verifyTurnstile } from '@/server/auth/turnstile'
import {
  signUpSchema,
  signInSchema,
  emailSchema,
  resetPasswordSchema,
  firstZodError,
} from '@/lib/schemas/auth'

export type ActionResult =
  | { ok: true; redirect?: string }
  | { ok: false; error: string; code?: string }

const isProd = process.env.NODE_ENV === 'production'

function cookieOptions(expiresAt: number) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    expires: new Date(expiresAt),
  }
}

async function requestMeta() {
  const h = await headers()
  return {
    userAgent: h.get('user-agent'),
    ip: h.get('cf-connecting-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  }
}

function toError(error: unknown): ActionResult {
  if (error instanceof AuthError) return { ok: false, error: error.message, code: error.code }
  console.error('Auth action failed:', error)
  return { ok: false, error: 'Something went wrong. Please try again.' }
}

export async function signUpAction(input: unknown, turnstileToken?: string): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) }

  const meta = await requestMeta()
  if (!(await verifyTurnstile(turnstileToken, meta.ip))) {
    return { ok: false, error: 'Bot check failed. Please retry.', code: 'turnstile' }
  }

  try {
    const { token, expiresAt } = await AuthService.signUp(parsed.data, meta)
    ;(await cookies()).set(SESSION_COOKIE, token, cookieOptions(expiresAt))
    return { ok: true, redirect: '/onboarding' }
  } catch (error) {
    return toError(error)
  }
}

export async function signInAction(input: unknown, turnstileToken?: string): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) }

  const meta = await requestMeta()
  if (!(await verifyTurnstile(turnstileToken, meta.ip))) {
    return { ok: false, error: 'Bot check failed. Please retry.', code: 'turnstile' }
  }

  try {
    const { token, expiresAt } = await AuthService.signIn(parsed.data, meta)
    ;(await cookies()).set(SESSION_COOKIE, token, cookieOptions(expiresAt))
    return { ok: true, redirect: '/dashboard' }
  } catch (error) {
    return toError(error)
  }
}

export async function signOutAction(): Promise<ActionResult> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  await invalidateSession(token)
  store.delete(SESSION_COOKIE)
  return { ok: true, redirect: '/' }
}

export async function requestPasswordResetAction(input: unknown): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) }
  try {
    await AuthService.requestPasswordReset(parsed.data.email)
    // Always succeed to avoid leaking which emails exist.
    return { ok: true }
  } catch (error) {
    return toError(error)
  }
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstZodError(parsed.error) }
  try {
    await AuthService.resetPassword(parsed.data.token, parsed.data.password)
    return { ok: true, redirect: '/login?reset=1' }
  } catch (error) {
    return toError(error)
  }
}
