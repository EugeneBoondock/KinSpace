import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/server/auth/constants'
import { validateSession } from '@/server/auth/session'

/**
 * Resolves the authenticated userId for an API route from the session cookie.
 * NEVER trust a client-supplied userId — always derive it here.
 */
export async function getSessionUserId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const session = await validateSession(token)
  return session?.userId ?? null
}

export class ApiAuthError extends Error {
  constructor() {
    super('UNAUTHENTICATED')
    this.name = 'ApiAuthError'
  }
}

/** Returns the userId or throws ApiAuthError (catch to return 401). */
export async function requireSessionUserId(request: NextRequest): Promise<string> {
  const userId = await getSessionUserId(request)
  if (!userId) throw new ApiAuthError()
  return userId
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
}
