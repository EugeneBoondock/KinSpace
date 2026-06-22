'use server'

import { requireUser, requireRole } from '@/server/auth/current-user'
import * as Mod from '@/server/moderation/repo'
import { reportSchema, blockSchema, muteTopicSchema } from '@/lib/schemas/moderation'

export type Result = { ok: true } | { ok: false; error: string }

async function withUser<T>(fn: (userId: string) => Promise<T>): Promise<Result> {
  let user
  try {
    user = await requireUser()
  } catch {
    return { ok: false, error: 'Please sign in first.' }
  }
  try {
    await fn(user.userId)
    return { ok: true }
  } catch (error) {
    console.error('Moderation action failed:', error)
    return { ok: false, error: 'Something went wrong. Please try again.' }
  }
}

export async function reportAction(input: unknown): Promise<Result> {
  const parsed = reportSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Please choose a reason.' }
  return withUser((userId) => Mod.createReport(userId, parsed.data).then(() => undefined))
}

export async function blockUserAction(input: unknown): Promise<Result> {
  const parsed = blockSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid user.' }
  return withUser((userId) => Mod.blockUser(userId, parsed.data.targetUserId))
}

export async function unblockUserAction(input: unknown): Promise<Result> {
  const parsed = blockSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid user.' }
  return withUser((userId) => Mod.unblockUser(userId, parsed.data.targetUserId))
}

export async function muteTopicAction(input: unknown): Promise<Result> {
  const parsed = muteTopicSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid topic.' }
  return withUser((userId) => Mod.muteTopic(userId, parsed.data.topic))
}

export async function unmuteTopicAction(input: unknown): Promise<Result> {
  const parsed = muteTopicSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid topic.' }
  return withUser((userId) => Mod.unmuteTopic(userId, parsed.data.topic))
}

// ── Admin / moderator ───────────────────────────────────────────────────────

export async function resolveReportAction(
  reportId: string,
  decision: 'actioned' | 'dismissed',
  options?: { targetType?: string; targetId?: string; note?: string },
): Promise<Result> {
  let mod
  try {
    mod = await requireRole('moderator')
  } catch {
    return { ok: false, error: 'You do not have permission.' }
  }
  try {
    if (decision === 'actioned' && options?.targetType && options?.targetId) {
      await Mod.takedownContent(options.targetType, options.targetId)
    }
    await Mod.resolveReport(reportId, mod.userId, decision, options?.note)
    return { ok: true }
  } catch (error) {
    console.error('resolveReport failed:', error)
    return { ok: false, error: 'Could not resolve the report.' }
  }
}

export async function suspendUserAction(userId: string, reason: string): Promise<Result> {
  try {
    await requireRole('admin')
  } catch {
    return { ok: false, error: 'Admins only.' }
  }
  await Mod.suspendUser(userId, reason)
  return { ok: true }
}

export async function setUserRoleAction(
  userId: string,
  role: 'user' | 'moderator' | 'admin',
): Promise<Result> {
  try {
    await requireRole('admin')
  } catch {
    return { ok: false, error: 'Admins only.' }
  }
  await Mod.setUserRole(userId, role)
  return { ok: true }
}
