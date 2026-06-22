import { eq, and, desc } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor, getProfileSummary } from './_shared'
import { angels, angelSoulRelationships, mentors } from '@/server/db/schema'

/**
 * Available angels for a soul to pick from. Mirrors the legacy Firestore read:
 * load every angel, hydrate the public profile, then filter to available angels
 * (excluding the requesting user), drop any at capacity, and sort by rating desc.
 *
 * `excludeUserId` is a read filter (about OTHER users), so it stays an arg.
 */
export async function getAvailableAngels(ctx: Ctx, excludeUserId?: string) {
  const rows = await ctx.db.query.angels.findMany()

  const hydrated = await Promise.all(
    rows.map(async (angel) => {
      const profile = await getProfileSummary(ctx.db, angel.userId)
      return { ...angel, id: angel.id, profile }
    }))

  return hydrated
    .filter((angel) => Boolean(angel.isAvailable) && angel.userId !== excludeUserId)
    .filter((angel) => (angel.currentSouls ?? 0) < (angel.maxSouls ?? 0))
    .sort((first, second) => (second.rating ?? 0) - (first.rating ?? 0))
}

/**
 * Active angel relationships for a given soul, each hydrated with its angel
 * (and that angel's public profile). If the referenced angel row is missing,
 * the relationship is returned bare, exactly as the original did.
 */
export async function getUserAngels(ctx: Ctx, _soulId?: string) {
  // A user's support relationships are private, scope to the authenticated user.
  const soulId = requireActor(ctx)
  const relationships = await ctx.db.query.angelSoulRelationships.findMany({
    where: and(
      eq(angelSoulRelationships.soulId, soulId),
      eq(angelSoulRelationships.relationshipStatus, 'active')),
  })

  return Promise.all(
    relationships.map(async (relationship) => {
      const angel = await ctx.db.query.angels.findFirst({
        where: eq(angels.id, relationship.angelId),
      })
      if (!angel) return { ...relationship, id: relationship.id }

      const profile = await getProfileSummary(ctx.db, angel.userId)

      return {
        ...relationship,
        id: relationship.id,
        angel: {
          ...angel,
          id: angel.id,
          profile,
        },
      }
    }))
}

/**
 * A soul chooses an angel. Write, the soul is the authenticated actor
 * (`ctx.userId`), never the `soulId` arg. If a relationship between this soul
 * and angel already exists, its id is returned (no duplicate, no extra
 * increment). Otherwise a new active relationship is created and the angel's
 * `currentSouls` counter is bumped atomically.
 */
export async function chooseAngel(ctx: Ctx, _soulId: string, angelId: string) {
  const actorId = requireActor(ctx)

  const existing = await ctx.db.query.angelSoulRelationships.findFirst({
    where: and(
      eq(angelSoulRelationships.soulId, actorId),
      eq(angelSoulRelationships.angelId, angelId)),
  })

  if (existing) return existing.id

  const id = crypto.randomUUID()
  await ctx.db.insert(angelSoulRelationships).values({
    id,
    soulId: actorId,
    angelId,
    relationshipStatus: 'active',
    lastCheckin: null,
    nextCheckin: null,
  })

  await ctx.db
    .update(angels)
    .set({ currentSouls: sql`${angels.currentSouls} + 1`, updatedAt: new Date() })
    .where(eq(angels.id, angelId))

  return id
}

/**
 * All mentors, each hydrated with its public profile, sorted by rating desc.
 */
export async function getMentors(ctx: Ctx) {
  const rows = await ctx.db.query.mentors.findMany({ orderBy: [desc(mentors.rating)] })

  return Promise.all(
    rows.map(async (mentor) => {
      const profile = await getProfileSummary(ctx.db, mentor.userId)
      return { ...mentor, id: mentor.id, profile }
    }))
}

/**
 * The authenticated user volunteers as an angel (a peer supporter). Upserts one
 * angel row per user; re-submitting updates the listing and re-opens availability.
 * Actor comes from the session, the client `_userId` arg is ignored.
 */
export async function becomeAngel(
  ctx: Ctx,
  _userId: string,
  data: {
    specialty?: string
    supportStyle?: string
    bio?: string
    maxSouls?: number
    experienceYears?: number
    responseTime?: string
  }) {
  const userId = requireActor(ctx)
  const values = {
    specialty: data.specialty?.trim() || null,
    supportStyle: data.supportStyle?.trim() || null,
    bio: data.bio?.trim() || null,
    maxSouls: typeof data.maxSouls === 'number' ? Math.max(1, Math.min(20, data.maxSouls)) : 3,
    experienceYears: typeof data.experienceYears === 'number' ? Math.max(0, data.experienceYears) : 0,
    responseTime: data.responseTime?.trim() || null,
    isAvailable: true,
    updatedAt: new Date(),
  }
  const existing = await ctx.db.query.angels.findFirst({ where: eq(angels.userId, userId) })
  if (existing) {
    await ctx.db.update(angels).set(values).where(eq(angels.id, existing.id))
    return { id: existing.id, created: false }
  }
  const id = crypto.randomUUID()
  await ctx.db.insert(angels).values({ id, userId, ...values })
  return { id, created: true }
}

/** Step down as an angel (hide from the list without deleting the relationship history). */
export async function resignAngel(ctx: Ctx) {
  const userId = requireActor(ctx)
  await ctx.db.update(angels).set({ isAvailable: false, updatedAt: new Date() }).where(eq(angels.userId, userId))
  return { ok: true }
}

/**
 * The authenticated user volunteers as a mentor. Upserts one mentor row per user.
 * Actor comes from the session, the client `_userId` arg is ignored.
 */
export async function becomeMentor(
  ctx: Ctx,
  _userId: string,
  data: { expertise?: string[]; bio?: string; experienceYears?: number; credentials?: string[] }) {
  const userId = requireActor(ctx)
  const clean = (list?: string[]) =>
    Array.from(new Set((list ?? []).map((s) => String(s).trim()).filter(Boolean)))
  const values = {
    expertise: clean(data.expertise),
    bio: data.bio?.trim() || null,
    experienceYears: typeof data.experienceYears === 'number' ? Math.max(0, data.experienceYears) : 0,
    credentials: clean(data.credentials),
    isAvailable: true,
    updatedAt: new Date(),
  }
  const existing = await ctx.db.query.mentors.findFirst({ where: eq(mentors.userId, userId) })
  if (existing) {
    await ctx.db.update(mentors).set(values).where(eq(mentors.id, existing.id))
    return { id: existing.id, created: false }
  }
  const id = crypto.randomUUID()
  await ctx.db.insert(mentors).values({ id, userId, ...values })
  return { id, created: true }
}

/** Whether the authenticated user is currently listed as an angel and/or mentor. */
export async function getMySupporterRoles(ctx: Ctx) {
  const userId = requireActor(ctx)
  const [angel, mentor] = await Promise.all([
    ctx.db.query.angels.findFirst({ where: eq(angels.userId, userId) }),
    ctx.db.query.mentors.findFirst({ where: eq(mentors.userId, userId) }),
  ])
  return {
    is_angel: Boolean(angel && angel.isAvailable),
    is_mentor: Boolean(mentor && mentor.isAvailable),
  }
}
