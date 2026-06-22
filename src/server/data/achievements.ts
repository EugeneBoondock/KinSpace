import { eq, or } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor } from './_shared'
import {
  moodCheckins,
  communityPosts,
  postComments,
  postReactions,
  postLikes,
  connectionRequests,
  conditionReports,
  therapySessions,
  gameScores,
  achievementUnlocks,
} from '@/server/db/schema'
import { computeAchievements, computeStreak, type AchievementStats } from '@/lib/achievements'
import { createNotification } from '@/server/notify'

/**
 * Derive a user's achievements + streak + level entirely from existing D1 rows.
 * No new write tables, no KV, read-only and free-tier safe. Check-in streak is
 * private, so it is only computed when the viewer is the owner; public badges
 * (posts, support given, connections) still show for other viewers.
 */
export async function getAchievements(ctx: Ctx, userId?: string) {
  const actor = requireActor(ctx)
  const target = userId || actor
  const isOwner = target === actor

  const [checkins, posts, comments, reactions, likes, conns, reports, sessions, games] = await Promise.all([
    isOwner ? ctx.db.query.moodCheckins.findMany({ where: eq(moodCheckins.userId, target) }) : Promise.resolve([]),
    ctx.db.query.communityPosts.findMany({ where: eq(communityPosts.userId, target) }),
    ctx.db.query.postComments.findMany({ where: eq(postComments.userId, target) }),
    ctx.db.query.postReactions.findMany({ where: eq(postReactions.userId, target) }),
    ctx.db.query.postLikes.findMany({ where: eq(postLikes.userId, target) }),
    ctx.db.query.connectionRequests.findMany({
      where: or(eq(connectionRequests.requesterId, target), eq(connectionRequests.targetUserId, target)),
    }),
    ctx.db.query.conditionReports.findMany({ where: eq(conditionReports.userId, target) }),
    ctx.db.query.therapySessions.findMany({ where: eq(therapySessions.userId, target) }),
    ctx.db.query.gameScores.findMany({ where: eq(gameScores.userId, target) }),
  ])

  const todayUtc = new Date().toISOString().slice(0, 10)
  const checkinDays = checkins.map((row) => String(row.day ?? '').slice(0, 10)).filter(Boolean)

  const stats: AchievementStats = {
    checkinStreak: isOwner ? computeStreak(checkinDays, todayUtc) : 0,
    totalCheckins: checkinDays.length,
    posts: posts.filter((row) => !row.isDeleted).length,
    comments: comments.filter((row) => !row.isDeleted).length,
    supportsGiven: reactions.length + likes.length,
    connections: conns.filter((row) => row.status === 'accepted').length,
    contributions: reports.length,
    sessions: sessions.length,
    gamesPlayed: games.length,
  }

  return { ...computeAchievements(stats), is_owner: isOwner }
}

/**
 * Record first-time badge/level unlocks in the ledger and return only the ones
 * just crossed, so the client can celebrate them once. Idempotent via the unique
 * (user, badge) index. Fires a gentle notification per new unlock.
 */
export async function syncAchievementUnlocks(
  ctx: Ctx): Promise<{ freshly_unlocked: Array<{ badge_id: string; name: string; tier: string }> }> {
  const userId = requireActor(ctx)
  const summary = await getAchievements(ctx)

  const earned: Array<{ id: string; name: string; tier: string }> = summary.badges
    .filter((badge) => badge.earned)
    .map((badge) => ({ id: badge.id, name: badge.name, tier: badge.tier }))
  earned.push({ id: `level:${summary.level}`, name: `Level ${summary.level}: ${summary.level_title}`, tier: 'gold' })

  const existing = await ctx.db.query.achievementUnlocks.findMany({
    where: eq(achievementUnlocks.userId, userId),
  })
  const known = new Set(existing.map((row) => row.badgeId))

  const freshly_unlocked: Array<{ badge_id: string; name: string; tier: string }> = []
  for (const item of earned) {
    if (known.has(item.id)) continue
    await ctx.db
      .insert(achievementUnlocks)
      .values({ id: crypto.randomUUID(), userId, badgeId: item.id, tier: item.tier })
      .onConflictDoNothing()
    await createNotification(ctx.db, userId, {
      type: 'achievement',
      title: `Achievement unlocked: ${item.name}`,
      data: { badge_id: item.id, tier: item.tier },
    })
    freshly_unlocked.push({ badge_id: item.id, name: item.name, tier: item.tier })
  }

  return { freshly_unlocked }
}
