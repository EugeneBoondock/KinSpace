import { eq, and } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import type { Ctx } from './_shared'
import {
  requireActor,
  getProfileSummary,
  sortByNewest,
  toDate,
} from './_shared'
import {
  resources,
  resourceContributions,
  resourceContributionVotes,
  savedResources,
} from '@/server/db/schema'

/** Single resource/article by slug. Returns the row with id = slug, or null. */
export async function getResource(ctx: Ctx, slug: string) {
  const row = await ctx.db.query.resources.findFirst({ where: eq(resources.slug, slug) })
  if (!row) return null
  return { id: row.slug, ...row }
}

type ResourceInput = {
  title: string
  excerpt: string
  url?: string | null
  source?: string | null
  category: string
  type: string
  tags?: string[]
}

/**
 * Support directory locations, optionally filtered by type, sorted by rating
 * (highest first). Mirrors DatabaseService.getSupportLocations.
 */
export async function getSupportLocations(ctx: Ctx, type?: string) {
  const rows = await ctx.db.query.supportLocations.findMany()
  return rows
    .filter((location) => !type || location.type === type)
    .sort((first, second) => ((second.rating ?? 0) - (first.rating ?? 0)))
}

/**
 * Resource library with optional category/type/featured filters, newest first.
 * The legacy code exposed the doc id; here the primary key is `slug`, so we
 * surface `id: slug` while spreading all row fields. Mirrors
 * DatabaseService.getResources.
 */
export async function getResources(
  ctx: Ctx,
  filters?: { category?: string; type?: string; featured?: boolean },
) {
  const rows = await ctx.db.query.resources.findMany()
  const items = rows
    .filter((resource) => !filters?.category || resource.category === filters.category)
    .filter((resource) => !filters?.type || resource.type === filters.type)
    .filter((resource) => !filters?.featured || resource.featured === true)
    .map((row) => ({ id: row.slug, ...row }))
  return sortByNewest(items)
}

export async function getSavedResourceIds(ctx: Ctx, _userId?: string) {
  const actorId = requireActor(ctx)
  const rows = await ctx.db.query.savedResources.findMany({
    where: eq(savedResources.userId, actorId),
  })
  return rows.map((row) => row.resourceId)
}

export async function toggleSavedResource(ctx: Ctx, _userId: string, resourceId: string) {
  const actorId = requireActor(ctx)
  const resource = await ctx.db.query.resources.findFirst({
    where: eq(resources.slug, resourceId),
  })
  if (!resource) throw new Error('Resource not found')

  const existing = await ctx.db.query.savedResources.findFirst({
    where: and(eq(savedResources.userId, actorId), eq(savedResources.resourceId, resourceId)),
  })

  if (existing) {
    await ctx.db.delete(savedResources).where(eq(savedResources.id, existing.id))
    return { saved: false }
  }

  await ctx.db.insert(savedResources).values({
    id: crypto.randomUUID(),
    userId: actorId,
    resourceId,
  })
  return { saved: true }
}

/**
 * Adds a crowd-sourced contribution to a resource and bumps its counter.
 * Auth comes from ctx (never the passed userId). Mirrors
 * DatabaseService.addResourceContribution.
 */
export async function addResourceContribution(
  ctx: Ctx,
  resourceId: string,
  _userId: string,
  data: {
    kind: 'experience' | 'source' | 'note'
    content: string
    url?: string | null
    is_anonymous?: boolean
  },
) {
  const actorId = requireActor(ctx)
  if (!(data.content ?? '').trim()) throw new Error('Contribution cannot be empty')

  const id = crypto.randomUUID()
  await ctx.db.insert(resourceContributions).values({
    id,
    resourceId,
    userId: actorId,
    kind: data.kind,
    content: data.content.trim(),
    url: data.url ?? null,
    upvotes: 0,
    isAnonymous: Boolean(data.is_anonymous),
  })

  await ctx.db
    .update(resources)
    .set({
      contributionsCount: sql`${resources.contributionsCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(resources.slug, resourceId))

  return { id }
}

/**
 * Lists a resource's contributions, hydrating the author profile for
 * non-anonymous entries, sorted by upvotes then recency. Mirrors
 * DatabaseService.getResourceContributions.
 */
export async function getResourceContributions(ctx: Ctx, resourceId: string, limit = 40) {
  const rows = await ctx.db.query.resourceContributions.findMany({
    where: eq(resourceContributions.resourceId, resourceId),
  })

  const items = await Promise.all(
    rows.map(async (row) => {
      const profile = row.isAnonymous ? null : await getProfileSummary(ctx.db, row.userId)
      return { ...row, profile }
    }),
  )

  return items
    .sort((a, b) => {
      const aVotes = a.upvotes ?? 0
      const bVotes = b.upvotes ?? 0
      if (bVotes !== aVotes) return bVotes - aVotes
      return (
        (toDate(b.createdAt) ?? new Date(0)).getTime() -
        (toDate(a.createdAt) ?? new Date(0)).getTime()
      )
    })
    .slice(0, limit)
}

/**
 * Toggles the actor's upvote on a contribution (one vote per user via the
 * unique index) and keeps the denormalized counter in sync. Auth comes from
 * ctx. Mirrors DatabaseService.upvoteContribution.
 */
export async function upvoteContribution(ctx: Ctx, _userId: string, contributionId: string) {
  const actorId = requireActor(ctx)

  const existing = await ctx.db.query.resourceContributionVotes.findFirst({
    where: and(
      eq(resourceContributionVotes.contributionId, contributionId),
      eq(resourceContributionVotes.userId, actorId),
    ),
  })

  if (existing) {
    await ctx.db.delete(resourceContributionVotes).where(eq(resourceContributionVotes.id, existing.id))
    await ctx.db
      .update(resourceContributions)
      .set({ upvotes: sql`${resourceContributions.upvotes} - 1` })
      .where(eq(resourceContributions.id, contributionId))
    return { voted: false }
  }

  await ctx.db.insert(resourceContributionVotes).values({
    id: crypto.randomUUID(),
    contributionId,
    userId: actorId,
  })
  await ctx.db
    .update(resourceContributions)
    .set({ upvotes: sql`${resourceContributions.upvotes} + 1` })
    .where(eq(resourceContributions.id, contributionId))
  return { voted: true }
}

/**
 * Creates a community-submitted resource. The legacy collection used an
 * auto-generated doc id; the D1 table is keyed by `slug`, so we mint a unique
 * slug and return it as `id` to preserve the old contract. Auth comes from
 * ctx. Mirrors DatabaseService.createResource.
 */
export async function createResource(ctx: Ctx, _userId: string, data: ResourceInput) {
  const actorId = requireActor(ctx)

  const now = new Date()
  const slug = crypto.randomUUID()
  await ctx.db.insert(resources).values({
    slug,
    title: data.title,
    excerpt: data.excerpt,
    url: data.url || null,
    source: data.source || 'Community submitted',
    category: data.category,
    type: data.type,
    tags: data.tags || [],
    featured: false,
    submittedBy: actorId,
    status: 'published',
    publishedAt: now,
  })

  return { id: slug }
}
