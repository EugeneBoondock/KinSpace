import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { getEnv } from '../env'
import { sessions } from '../db/schema'
import { randomToken, sha256 } from './crypto'
import { SESSION_COOKIE, SESSION_TTL_MS } from './constants'

export { SESSION_COOKIE }
const KV_TTL_SECONDS = 60 * 60 // cache session lookups in KV for 1 hour

export type SessionRecord = { userId: string; expiresAt: number }

function kvKey(hashedId: string): string {
  return `session:${hashedId}`
}

/**
 * Creates a session. The raw token is returned (set as the cookie); only its
 * SHA-256 is persisted, so a DB/KV leak cannot be replayed as a live session.
 */
export async function createSession(
  userId: string,
  meta?: { userAgent?: string | null; ip?: string | null },
): Promise<{ token: string; expiresAt: number }> {
  const token = randomToken(32)
  const hashedId = await sha256(token)
  const expiresAt = Date.now() + SESSION_TTL_MS

  await getDb()
    .insert(sessions)
    .values({
      id: hashedId,
      userId,
      expiresAt: new Date(expiresAt),
      userAgent: meta?.userAgent ?? null,
      ip: meta?.ip ?? null,
    })

  await cacheSession(hashedId, { userId, expiresAt })
  return { token, expiresAt }
}

async function cacheSession(hashedId: string, record: SessionRecord): Promise<void> {
  try {
    await getEnv().KV.put(kvKey(hashedId), JSON.stringify(record), { expirationTtl: KV_TTL_SECONDS })
  } catch {
    // KV is a cache; D1 remains the source of truth.
  }
}

/** Validates a raw session token, returning the userId or null. */
export async function validateSession(token: string | undefined | null): Promise<SessionRecord | null> {
  if (!token) return null
  const hashedId = await sha256(token)

  // Fast path: KV cache.
  try {
    const cached = await getEnv().KV.get(kvKey(hashedId))
    if (cached) {
      const record = JSON.parse(cached) as SessionRecord
      if (record.expiresAt > Date.now()) return record
    }
  } catch {
    // fall through to D1
  }

  const db = getDb()
  const row = await db.query.sessions.findFirst({ where: eq(sessions.id, hashedId) })
  if (!row) return null
  const expiresAt = row.expiresAt.getTime()
  if (expiresAt <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, hashedId))
    return null
  }

  const record: SessionRecord = { userId: row.userId, expiresAt }
  await cacheSession(hashedId, record)
  return record
}

export async function invalidateSession(token: string | undefined | null): Promise<void> {
  if (!token) return
  const hashedId = await sha256(token)
  await getDb().delete(sessions).where(eq(sessions.id, hashedId))
  try {
    await getEnv().KV.delete(kvKey(hashedId))
  } catch {
    // ignore
  }
}

/** Revokes every session for a user (e.g. on password reset / account deletion). */
export async function invalidateAllSessions(userId: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.userId, userId))
  // KV cache entries expire within KV_TTL_SECONDS.
}
