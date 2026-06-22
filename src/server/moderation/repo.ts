import { and, eq, desc, inArray } from 'drizzle-orm'
import { getDb } from '../db/client'
import { reports, userBlocks, mutedTopics, users, communityPosts, postComments } from '../db/schema'
import type { ReportInput } from '@/lib/schemas/moderation'

// ── Reports ─────────────────────────────────────────────────────────────────

export async function createReport(reporterId: string, input: ReportInput): Promise<{ id: string }> {
  const id = crypto.randomUUID()
  await getDb().insert(reports).values({
    id,
    reporterId,
    targetType: input.targetType,
    targetId: input.targetId,
    targetOwnerId: input.targetOwnerId ?? null,
    reason: input.reason,
    detail: input.detail ?? null,
    status: 'open',
  })
  return { id }
}

export async function listReports(status = 'open', limit = 100) {
  return getDb().query.reports.findMany({
    where: eq(reports.status, status),
    orderBy: desc(reports.createdAt),
    limit,
  })
}

export async function resolveReport(
  reportId: string,
  resolverId: string,
  status: 'actioned' | 'dismissed',
  note?: string,
): Promise<void> {
  await getDb()
    .update(reports)
    .set({ status, resolvedBy: resolverId, resolutionNote: note ?? null, resolvedAt: new Date() })
    .where(eq(reports.id, reportId))
}

/** Soft-deletes the reported content (post/comment) as a moderator action. */
export async function takedownContent(targetType: string, targetId: string): Promise<void> {
  const db = getDb()
  if (targetType === 'post') {
    await db.update(communityPosts).set({ isDeleted: true, updatedAt: new Date() }).where(eq(communityPosts.id, targetId))
  } else if (targetType === 'comment') {
    await db.update(postComments).set({ isDeleted: true, updatedAt: new Date() }).where(eq(postComments.id, targetId))
  }
}

// ── Blocks ──────────────────────────────────────────────────────────────────

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  if (blockerId === blockedId) return
  await getDb()
    .insert(userBlocks)
    .values({ blockerId, blockedId })
    .onConflictDoNothing({ target: [userBlocks.blockerId, userBlocks.blockedId] })
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await getDb()
    .delete(userBlocks)
    .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)))
}

/**
 * Returns the set of userIds this user should not see and who should not see
 * them — i.e. people they blocked plus people who blocked them. Used to filter
 * feeds, comments, and connection candidates.
 */
export async function getMutualBlockedIds(userId: string): Promise<Set<string>> {
  const db = getDb()
  const [blocked, blockedBy] = await Promise.all([
    db.query.userBlocks.findMany({ where: eq(userBlocks.blockerId, userId) }),
    db.query.userBlocks.findMany({ where: eq(userBlocks.blockedId, userId) }),
  ])
  return new Set([...blocked.map((b) => b.blockedId), ...blockedBy.map((b) => b.blockerId)])
}

// ── Muted topics ────────────────────────────────────────────────────────────

export async function muteTopic(userId: string, topic: string): Promise<void> {
  await getDb()
    .insert(mutedTopics)
    .values({ userId, topic: topic.trim().toLowerCase() })
    .onConflictDoNothing({ target: [mutedTopics.userId, mutedTopics.topic] })
}

export async function unmuteTopic(userId: string, topic: string): Promise<void> {
  await getDb()
    .delete(mutedTopics)
    .where(and(eq(mutedTopics.userId, userId), eq(mutedTopics.topic, topic.trim().toLowerCase())))
}

export async function getMutedTopics(userId: string): Promise<string[]> {
  const rows = await getDb().query.mutedTopics.findMany({ where: eq(mutedTopics.userId, userId) })
  return rows.map((r) => r.topic)
}

// ── Admin user actions ──────────────────────────────────────────────────────

export async function setUserRole(userId: string, role: 'user' | 'moderator' | 'admin'): Promise<void> {
  await getDb().update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId))
}

export async function suspendUser(userId: string, reason: string): Promise<void> {
  await getDb()
    .update(users)
    .set({ status: 'suspended', suspendedReason: reason, updatedAt: new Date() })
    .where(eq(users.id, userId))
}

export async function reinstateUser(userId: string): Promise<void> {
  await getDb()
    .update(users)
    .set({ status: 'active', suspendedReason: null, updatedAt: new Date() })
    .where(eq(users.id, userId))
}

export { inArray }
