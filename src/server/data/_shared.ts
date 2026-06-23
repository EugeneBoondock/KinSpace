import { eq, inArray } from 'drizzle-orm'
import type { Database } from '../db/client'
import { profiles } from '../db/schema'
import type { Profile } from '../db/schema/identity'
import { toDate, normalizeKeywords, formatRelativeTime } from '@/lib/platform'

/** Context every data function receives: the D1 client + the authenticated actor (or null for public reads). */
export type Ctx = { db: Database; userId: string | null }

export function requireActor(ctx: Ctx): string {
  if (!ctx.userId) throw new Error('UNAUTHENTICATED')
  return ctx.userId
}

/**
 * PUBLIC profile shape. This is the ONLY profile data that may be sent to other
 * users (post authors, group members, search, etc.). Private/health fields
 * (conditions, medications, mood, emergency contacts, age, location, …) are
 * NEVER included, they are only returned to the profile's owner via getProfile.
 */
export type PublicProfile = {
  id: string
  userId: string
  username: string
  fullName: string | null
  pseudonym: string | null
  isAnonymous: boolean
  avatarUrl: string | null
  coverImageUrl: string | null
  bio: string | null
  pronouns: string | null
  onboardingComplete: boolean
  followers: number
  following: number
  postsCount: number
  spaceTheme: string
  spaceAccent: string
  spaceFont: string
  spaceMotto: string | null
  spaceVibe: string | null
  spacePinnedNote: string | null
  createdAt: Date
}

export function toPublicProfile(row: Profile): PublicProfile {
  return {
    id: row.userId,
    userId: row.userId,
    username: row.username,
    fullName: row.isAnonymous ? null : row.fullName,
    pseudonym: row.pseudonym,
    isAnonymous: row.isAnonymous,
    avatarUrl: row.avatarUrl,
    coverImageUrl: row.coverImageUrl,
    bio: row.bio,
    pronouns: row.pronouns,
    onboardingComplete: row.onboardingComplete,
    followers: row.followers,
    following: row.following,
    postsCount: row.postsCount,
    spaceTheme: row.spaceTheme,
    spaceAccent: row.spaceAccent,
    spaceFont: row.spaceFont,
    spaceMotto: row.spaceMotto,
    spaceVibe: row.spaceVibe,
    spacePinnedNote: row.spacePinnedNote,
    createdAt: row.createdAt,
  }
}

export type ProfileSummary = PublicProfile

/** Hydrates a PUBLIC profile (post authors, members, etc.). Never leaks private fields. */
export async function getProfileSummary(
  db: Database,
  userId: string | null | undefined): Promise<PublicProfile | null> {
  if (!userId) return null
  const row = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) })
  if (!row) return null
  return toPublicProfile(row)
}

/** Batched PUBLIC profile hydration, returns a Map keyed by userId. */
export async function getProfileSummaries(
  db: Database,
  userIds: Array<string | null | undefined>): Promise<Map<string, PublicProfile>> {
  const ids = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))))
  const map = new Map<string, PublicProfile>()
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const rows = await db.query.profiles.findMany({ where: inArray(profiles.userId, chunk) })
    for (const row of rows) map.set(row.userId, toPublicProfile(row))
  }
  return map
}

/** Full profile rows, keyed by userId, INTERNAL ONLY (e.g. server-side scoring). Never serialize to a client. */
export async function getFullProfilesByIds(
  db: Database,
  userIds: Array<string | null | undefined>): Promise<Map<string, Profile>> {
  const ids = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))))
  const map = new Map<string, Profile>()
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const rows = await db.query.profiles.findMany({ where: inArray(profiles.userId, chunk) })
    for (const row of rows) map.set(row.userId, row)
  }
  return map
}

export function sortByNewest<T extends Record<string, unknown>>(rows: T[], field = 'createdAt'): T[] {
  return rows.sort(
    (a, b) =>
      (toDate(b[field] as never) ?? new Date(0)).getTime() - (toDate(a[field] as never) ?? new Date(0)).getTime())
}

export function sortByOldest<T extends Record<string, unknown>>(rows: T[], field = 'createdAt'): T[] {
  return rows.sort(
    (a, b) =>
      (toDate(a[field] as never) ?? new Date(0)).getTime() - (toDate(b[field] as never) ?? new Date(0)).getTime())
}

export { toDate, normalizeKeywords, formatRelativeTime }
