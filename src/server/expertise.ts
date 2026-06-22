import { eq, inArray } from 'drizzle-orm'
import type { Database } from './db/client'
import { profiles, groupMembers } from './db/schema'
import { normalizeKeywords } from './data/_shared'
import { createNotification } from './notify'

const MAX_RECIPIENTS = 5
const MIN_OVERLAP = 2
const CANDIDATE_LIMIT = 500

/**
 * Ping people whose lived experience matches a new post, so they can offer help.
 * INTERNAL (not in the RPC registry) — only called server-side from post creation
 * after the actor is authenticated, so it can't be used to spam.
 *
 * Matching: overlap between the post's keywords (content + tags) and a candidate's
 * conditions/comorbidities/interests/goals. Requires a meaningful overlap and caps
 * recipients so this stays a gentle nudge, not a firehose. Best-effort throughout.
 */
export async function notifyMatchingExperts(
  db: Database,
  opts: { authorId: string; postId: string; groupId?: string | null; content: string; tags: string[] },
): Promise<void> {
  try {
    const keywords = new Set(normalizeKeywords(opts.content, opts.tags))
    if (keywords.size === 0) return

    // Candidate pool: a group post stays within its members; a public post draws
    // from a bounded slice of the community.
    let candidates: Array<typeof profiles.$inferSelect>
    if (opts.groupId) {
      const members = await db.query.groupMembers.findMany({ where: eq(groupMembers.groupId, opts.groupId) })
      const ids = members.filter((m) => m.status !== 'banned' && m.userId !== opts.authorId).map((m) => m.userId)
      if (ids.length === 0) return
      candidates = await db.query.profiles.findMany({ where: inArray(profiles.userId, ids) })
    } else {
      candidates = await db.query.profiles.findMany({ limit: CANDIDATE_LIMIT })
    }

    const scored = candidates
      .filter((profile) => profile.userId !== opts.authorId && profile.notifyMatches !== false)
      .map((profile) => {
        const expertise = normalizeKeywords(
          profile.conditions as string[] | undefined,
          profile.comorbidities as string[] | undefined,
          profile.interests as string[] | undefined,
          profile.mentalHealthGoals as string[] | undefined,
        )
        const hits = expertise.filter((keyword) => keywords.has(keyword)).length
        return { userId: profile.userId, hits }
      })
      .filter((entry) => entry.hits >= MIN_OVERLAP)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, MAX_RECIPIENTS)

    await Promise.all(
      scored.map((entry) =>
        createNotification(db, entry.userId, {
          type: 'expertise',
          title: 'Someone shared something you might understand',
          body: 'A new post lines up with what you have experience in — your reply could really help.',
          data: { post_id: opts.postId, group_id: opts.groupId ?? null, from_user_id: opts.authorId },
        }),
      ),
    )
  } catch {
    // Never let expertise routing break posting.
  }
}
