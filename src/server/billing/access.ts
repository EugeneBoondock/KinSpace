import type { Ctx } from '@/server/data/_shared'
import { aiCreditBalances, subscriptions, usageCounters, users } from '@/server/db/schema'
import { and, eq, gt, sql } from 'drizzle-orm'
import {
  getLimit,
  isUnlimited,
  tierFromInput,
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
  metered?: 'none' | 'quota' | 'credit'
}

function validTier(value: unknown): Tier {
  return tierFromInput(value)
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
  if (user?.role === 'admin') return 'organisation'
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

function currentPeriod(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

async function currentFeatureUsage(ctx: Ctx, feature: Feature): Promise<number> {
  if (!ctx.userId) throw new Error('UNAUTHENTICATED')
  const row = await ctx.db.query.usageCounters.findFirst({
    where: and(
      eq(usageCounters.userId, ctx.userId),
      eq(usageCounters.period, currentPeriod()),
      eq(usageCounters.feature, feature),
    ),
  })
  return row?.count ?? 0
}

async function consumeGuideCredit(ctx: Ctx): Promise<boolean> {
  if (!ctx.userId) throw new Error('UNAUTHENTICATED')
  const rows = await ctx.db
    .update(aiCreditBalances)
    .set({ credits: sql`max(0, ${aiCreditBalances.credits} - 1)`, updatedAt: new Date() })
    .where(and(eq(aiCreditBalances.userId, ctx.userId), gt(aiCreditBalances.credits, 0)))
    .returning({ credits: aiCreditBalances.credits })
  return Boolean(rows[0])
}

async function consumeQuotaSlot(ctx: Ctx, feature: Feature, limit: number): Promise<number | null> {
  if (!ctx.userId) throw new Error('UNAUTHENTICATED')
  const period = currentPeriod()
  const inserted = await ctx.db
    .insert(usageCounters)
    .values({ userId: ctx.userId, period, feature, count: 1 })
    .onConflictDoNothing({
      target: [usageCounters.userId, usageCounters.period, usageCounters.feature],
    })
    .returning({ count: usageCounters.count })
  if (inserted[0]) return Math.max(0, limit - inserted[0].count)

  const updated = await ctx.db
    .update(usageCounters)
    .set({ count: sql`${usageCounters.count} + 1`, updatedAt: new Date() })
    .where(and(
      eq(usageCounters.userId, ctx.userId),
      eq(usageCounters.period, period),
      eq(usageCounters.feature, feature),
      sql`${usageCounters.count} < ${limit}`,
    ))
    .returning({ count: usageCounters.count })

  return updated[0] ? Math.max(0, limit - updated[0].count) : null
}

export async function consumeFeatureQuota(ctx: Ctx, feature: Feature): Promise<FeatureUsageStatus> {
  const tier = await getBackendTier(ctx)
  const limit = getLimit(tier, feature)
  if (isUnlimited(limit)) {
    return { allowed: true, limit: UNLIMITED, remaining: Number.MAX_SAFE_INTEGER, metered: 'none' }
  }

  const used = await currentFeatureUsage(ctx, feature)
  const before = featureUsageStatus(tier, feature, used)
  if (!before.allowed) {
    if (feature === 'ai_therapy' && (await consumeGuideCredit(ctx))) {
      return { allowed: true, limit, remaining: 0, metered: 'credit' }
    }
    throw new Error('PLAN_REQUIRED')
  }

  const remaining = await consumeQuotaSlot(ctx, feature, limit)
  if (remaining === null) {
    if (feature === 'ai_therapy' && (await consumeGuideCredit(ctx))) {
      return { allowed: true, limit, remaining: 0, metered: 'credit' }
    }
    throw new Error('PLAN_REQUIRED')
  }

  return { allowed: true, limit, remaining, metered: 'quota' }
}

export async function refundConsumedFeatureQuota(
  ctx: Ctx,
  feature: Feature,
  usage: FeatureUsageStatus | null | undefined,
): Promise<void> {
  if (!ctx.userId || !usage?.allowed) return

  if (usage.metered === 'quota') {
    await ctx.db
      .update(usageCounters)
      .set({ count: sql`max(0, ${usageCounters.count} - 1)`, updatedAt: new Date() })
      .where(and(
        eq(usageCounters.userId, ctx.userId),
        eq(usageCounters.period, currentPeriod()),
        eq(usageCounters.feature, feature),
        gt(usageCounters.count, 0),
      ))
      .returning({ count: usageCounters.count })
    return
  }

  if (usage.metered === 'credit' && feature === 'ai_therapy') {
    await ctx.db
      .insert(aiCreditBalances)
      .values({ userId: ctx.userId, feature, credits: 1 })
      .onConflictDoUpdate({
        target: aiCreditBalances.userId,
        set: {
          credits: sql`${aiCreditBalances.credits} + 1`,
          updatedAt: new Date(),
        },
      })
  }
}
