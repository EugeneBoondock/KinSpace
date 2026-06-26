import { and, eq, isNull, or } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor } from './_shared'
import { getCareProgram } from './care-program'
import { getSocialStarter } from './cohort'
import {
  chatMessages,
  connectionRequests,
  notifications,
} from '@/server/db/schema'
import { buildPlatformPulse } from '@/lib/platform-pulse'

export async function getPlatformPulse(ctx: Ctx, _userId?: string) {
  const userId = requireActor(ctx)
  const [notificationRows, messageRows, strandRows, starter, careProgram] = await Promise.all([
    ctx.db.query.notifications.findMany({
      where: and(eq(notifications.userId, userId), isNull(notifications.readAt)),
    }),
    ctx.db.query.chatMessages.findMany({ where: eq(chatMessages.receiverId, userId) }),
    ctx.db.query.connectionRequests.findMany({
      where: or(eq(connectionRequests.requesterId, userId), eq(connectionRequests.targetUserId, userId)),
    }),
    getSocialStarter(ctx, userId, { limit: 6 }),
    getCareProgram(ctx, userId),
  ])

  const liveness = (starter as {
    liveness?: {
      close_matches_count?: number
      available_supporters_count?: number
      open_lanterns_count?: number
      recent_posts_count?: number
      upcoming_activities_count?: number
    }
  }).liveness ?? {}

  return buildPlatformPulse({
    unreadNotifications: notificationRows.length,
    unreadMessages: messageRows.filter((row) => (row.roomId ?? '').startsWith('dm:') && !row.readAt).length,
    pendingStrands: strandRows.filter((row) => row.targetUserId === userId && row.status === 'pending').length,
    openLanterns: liveness.open_lanterns_count ?? 0,
    availableSupporters: liveness.available_supporters_count ?? 0,
    closeMatches: liveness.close_matches_count ?? 0,
    recentPosts: liveness.recent_posts_count ?? 0,
    upcomingActivities: liveness.upcoming_activities_count ?? 0,
    careReadiness: careProgram.readiness_score,
    careStageLabel: careProgram.stage_label,
  })
}
