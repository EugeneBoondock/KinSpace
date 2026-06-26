import type { Ctx } from '@/server/data/_shared'
import { subscriptions, users } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import {
  getLimit,
  isUnlimited,
  type Feature,
  type Tier,
  UNLIMITED,
} from './tiers'

type SubscriptionLike = {
  tier?: unknown
  status?: string | null
  trialEndsAt?: Date | string | number | null
  currentPeriodEnd?: Date | string | number | null
}

export type FeatureUsageStatus = {
  allowed: boolean
  limit: number
  remaining: number
}

function validTier(value: unknown): Tier {
  return value === 'plus' || value === 'pro' ? value : 'free'
}

function toTime(value: Date | string | number | null | undefined): number {
  if (!value) return 0
  const date = value instanceof Date ? value : new Date(value)
  const time = date.getTime()
  return Number.isFinite(time) ? time : 0
}

export function effectiveTierFromSubscription(
  row: SubscriptionLike | null | undefined,
  now = new Date(),
): Tier {
  if (!row) return 'free'
  const tier = validTier(row.tier)
  if (tier === 'free') return 'free'

  const nowTime = now.getTime()
  if (row.status === 'trialing') {
    return toTime(row.trialEndsAt) > nowTime ? tier : 'free'
  }

  if (row.status === 'active') {
    return toTime(row.currentPeriodEnd) > nowTime ? tier : 'free'
  }

  return 'free'
}

export function featureUsageStatus(tier: Tier, feature: Feature, used = 0): FeatureUsageStatus {
  const limit = getLimit(tier, feature)
  if (isUnlimited(limit)) {
    return { allowed: true, limit: UNLIMITED, remaining: Number.MAX_SAFE_INTEGER }
  }

  const normalizedUsed = Math.max(0, Math.floor(used))
  return {
    allowed: normalizedUsed < limit,
    limit,
    remaining: Math.max(0, limit - normalizedUsed),
  }
}

export async function getBackendTier(ctx: Ctx): Promise<Tier> {
  if (!ctx.userId) throw new Error('UNAUTHENTICATED')
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, ctx.userId) })
  if (user?.role === 'admin') return 'pro'
  const row = await ctx.db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, ctx.userId),
  })
  return effectiveTierFromSubscription(row)
}

export async function requireFeatureAccess(ctx: Ctx, feature: Feature): Promise<FeatureUsageStatus> {
  const tier = await getBackendTier(ctx)
  const status = featureUsageStatus(tier, feature, 0)
  if (!status.allowed) throw new Error('PLAN_REQUIRED')
  return status
}

export async function requireFeatureCapacity(ctx: Ctx, feature: Feature, used: number): Promise<FeatureUsageStatus> {
  const tier = await getBackendTier(ctx)
  const status = featureUsageStatus(tier, feature, used)
  if (!status.allowed) throw new Error('PLAN_REQUIRED')
  return status
}
