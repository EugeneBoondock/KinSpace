import { eq, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { users, profiles } from '../db/schema'
import type { User, Profile } from '../db/schema/identity'
import { getPlatformAvatarForSeed } from '@/lib/profile-avatars'

export type CreateUserInput = {
  email: string
  passwordHash?: string | null
  username: string
  fullName: string
  googleId?: string | null
  emailVerified?: boolean
  avatarUrl?: string | null
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  return getDb().query.users.findFirst({ where: eq(users.email, email.trim().toLowerCase()) })
}

export async function getUserById(id: string): Promise<User | undefined> {
  return getDb().query.users.findFirst({ where: eq(users.id, id) })
}

export async function getUserByGoogleId(googleId: string): Promise<User | undefined> {
  return getDb().query.users.findFirst({ where: eq(users.googleId, googleId) })
}

export async function getProfile(userId: string): Promise<Profile | undefined> {
  return getDb().query.profiles.findFirst({ where: eq(profiles.userId, userId) })
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const row = await getDb()
    .query.profiles.findFirst({ where: sql`lower(${profiles.username}) = ${username.trim().toLowerCase()}` })
  return Boolean(row)
}

export async function ensureUniqueUsername(base: string): Promise<string> {
  const cleaned = base.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'friend'
  if (!(await isUsernameTaken(cleaned))) return cleaned
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${cleaned}_${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 30)
    if (!(await isUsernameTaken(candidate))) return candidate
  }
  return `${cleaned}_${crypto.randomUUID().slice(0, 8)}`.slice(0, 30)
}

export async function createUserWithProfile(
  input: CreateUserInput,
): Promise<{ userId: string; username: string }> {
  const db = getDb()
  const userId = crypto.randomUUID()
  const username = await ensureUniqueUsername(input.username)
  const avatarUrl = input.avatarUrl ?? getPlatformAvatarForSeed(userId).src

  await db.insert(users).values({
    id: userId,
    email: input.email.trim().toLowerCase(),
    passwordHash: input.passwordHash ?? null,
    googleId: input.googleId ?? null,
    emailVerified: input.emailVerified ?? false,
  })

  try {
    await db.insert(profiles).values({
      userId,
      username,
      fullName: input.fullName,
      avatarUrl,
    })
  } catch (error) {
    await db.delete(users).where(eq(users.id, userId)).catch(() => undefined)
    throw error
  }

  return { userId, username }
}

export async function setEmailVerified(userId: string): Promise<void> {
  await getDb()
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, userId))
}

export async function setPasswordHash(userId: string, passwordHash: string): Promise<void> {
  await getDb()
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId))
}

export async function linkGoogleId(userId: string, googleId: string): Promise<void> {
  await getDb().update(users).set({ googleId, updatedAt: new Date() }).where(eq(users.id, userId))
}

export async function touchLastLogin(userId: string): Promise<void> {
  await getDb().update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId))
}
