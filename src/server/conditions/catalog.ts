import { and, eq } from 'drizzle-orm'
import type { Ctx } from '@/server/data/_shared'
import { conditions, researchRequests } from '@/server/db/schema'

type ExistingCondition = Pick<typeof conditions.$inferSelect, 'slug' | 'name' | 'aliases' | 'category' | 'description'>

type EnsureConditionCatalogResult = {
  createdConditionSlugs: string[]
  queuedResearchSlugs: string[]
}

const MAX_CONDITION_NAME_LENGTH = 120

const DISABILITY_TERMS = [
  'access need',
  'amputation',
  'blind',
  'cerebral palsy',
  'deaf',
  'disability',
  'disabled',
  'hearing loss',
  'limb difference',
  'low vision',
  'mobility',
  'spinal cord injury',
  'visual impairment',
  'wheelchair',
]

function stripDiacritics(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
}

function listStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean)
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean)
    }
  }
  return []
}

export function normalizeConditionCatalogName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (trimmed.length < 2) return null
  return trimmed.slice(0, MAX_CONDITION_NAME_LENGTH)
}

export function slugForConditionCatalogName(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function conditionTerms(row: ExistingCondition): string[] {
  return [row.slug, row.name, ...listStrings(row.aliases)]
    .map((value) => slugForConditionCatalogName(String(value)))
    .filter(Boolean)
}

function inferCategory(name: string): string {
  const normalized = ` ${stripDiacritics(name).toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `
  if (DISABILITY_TERMS.some((term) => normalized.includes(` ${term} `))) return 'disability'
  return 'community'
}

function researchRequestForCondition(name: string): string {
  return [
    `Write a KinSpace research article about ${name}.`,
    'Include current medical evidence, disability and access context, daily-life impact, treatments, care options, and questions readers can bring to a clinician.',
  ].join(' ')
}

async function queueResearchRequest(ctx: Ctx, userId: string, name: string): Promise<boolean> {
  const request = researchRequestForCondition(name)
  const existing = await ctx.db.query.researchRequests
    .findFirst({
      where: and(eq(researchRequests.status, 'pending'), eq(researchRequests.request, request)),
    })
    .catch(() => null)
  if (existing) return false

  try {
    await ctx.db.insert(researchRequests).values({
      id: crypto.randomUUID(),
      userId,
      request,
      status: 'pending',
    })
    return true
  } catch {
    return false
  }
}

export async function ensureConditionCatalogEntries(
  ctx: Ctx,
  userId: string,
  labels: unknown[],
): Promise<EnsureConditionCatalogResult> {
  const normalized = new Map<string, string>()
  for (const raw of labels) {
    const name = normalizeConditionCatalogName(raw)
    if (!name) continue
    const slug = slugForConditionCatalogName(name)
    if (!slug || normalized.has(slug)) continue
    normalized.set(slug, name)
  }
  if (normalized.size === 0) return { createdConditionSlugs: [], queuedResearchSlugs: [] }

  const existingRows = (await ctx.db.query.conditions.findMany({ limit: 2000 }).catch(() => [])) as ExistingCondition[]
  const existingTerms = new Set(existingRows.flatMap(conditionTerms))
  const createdConditionSlugs: string[] = []
  const queuedResearchSlugs: string[] = []

  for (const [slug, name] of normalized) {
    if (existingTerms.has(slug)) continue
    try {
      await ctx.db.insert(conditions).values({
        slug,
        name,
        aliases: [],
        description:
          'Added by a KinSpace member. Research coverage is being prepared with medical evidence, lived experience, disability context, and access needs in mind.',
        category: inferCategory(name),
      })
    } catch {
      existingTerms.add(slug)
      continue
    }
    existingTerms.add(slug)
    createdConditionSlugs.push(slug)
    if (await queueResearchRequest(ctx, userId, name)) queuedResearchSlugs.push(slug)
  }

  return { createdConditionSlugs, queuedResearchSlugs }
}
