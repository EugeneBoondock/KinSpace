import { eq } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor, normalizeKeywords } from './_shared'
import { groupMembers, profiles } from '@/server/db/schema'

/** Build the actor's personal keyword set from their health profile. */
function profileKeywords(profile: Record<string, unknown> | null | undefined): string[] {
  if (!profile) return []
  return normalizeKeywords(
    profile.conditions as string[] | undefined,
    profile.comorbidities as string[] | undefined,
    profile.medications as string[] | undefined,
    profile.interests as string[] | undefined,
    profile.mentalHealthGoals as string[] | undefined,
    profile.onboardingStatus as string | undefined)
}

/**
 * "For you", surfaces groups and resources that match the actor's own health
 * profile (conditions, comorbidities, meds, goals) so an arriving user instantly
 * sees people and reading that fit them, and feels less alone.
 *
 * Read-only and purely additive: it never restricts what the rest of the
 * platform shows. Returns empty arrays when the user hasn't shared a profile.
 */
export async function getForYou(ctx: Ctx, limitEach = 4) {
  const userId = requireActor(ctx)
  const profile = await ctx.db.query.profiles.findFirst({ where: eq(profiles.userId, userId) })
  const keywords = profileKeywords(profile)
  if (keywords.length === 0) return { keywords: [], groups: [], resources: [] }

  const [allGroups, membershipRows, allResources] = await Promise.all([
    ctx.db.query.groups.findMany({ limit: 200 }),
    ctx.db.query.groupMembers.findMany({ where: eq(groupMembers.userId, userId) }),
    ctx.db.query.resources.findMany({ limit: 300 }),
  ])
  const joined = new Set(membershipRows.map((row) => row.groupId))

  const matchedGroups = allGroups
    .filter((group) => !joined.has(group.id))
    .map((group) => {
      const haystack = normalizeKeywords(group.name, group.description, group.category, group.tags as string[] | undefined)
      const hits = keywords.filter((keyword) => haystack.includes(keyword)).length
      return { group, hits }
    })
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits || (b.group.membersCount ?? 0) - (a.group.membersCount ?? 0))
    .slice(0, limitEach)
    .map(({ group, hits }) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      category: group.category,
      type: group.type,
      members_count: group.membersCount,
      tags: group.tags ?? [],
      match_count: hits,
    }))

  const matchedResources = allResources
    .filter((resource) => resource.status === 'published')
    .map((resource) => {
      const haystack = normalizeKeywords(
        resource.title,
        resource.excerpt,
        resource.topic,
        resource.category,
        resource.tags as string[] | undefined)
      const hits = keywords.filter((keyword) => haystack.includes(keyword)).length
      return { resource, hits }
    })
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limitEach)
    .map(({ resource, hits }) => ({
      id: resource.slug,
      title: resource.title,
      excerpt: resource.excerpt,
      category: resource.category,
      type: resource.type,
      url: resource.url,
      tags: resource.tags ?? [],
      match_count: hits,
    }))

  return { keywords, groups: matchedGroups, resources: matchedResources }
}
