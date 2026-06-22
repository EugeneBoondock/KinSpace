import { and, eq, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { subscriptions, usageCounters, users } from '../db/schema'
import { type Tier, type Feature, getLimit, isUnlimited, LIMITS, UNLIMITED } from './tiers'

/** Admins are never rate-limited on paid features. */
async function isAdminUser(userId: string): Promise<boolean> {
  const row = await getDb().query.users.findFirst({ where: eq(users.id, userId) })
  return row?.role === 'admin'
}

export type SubscriptionState = {
  tier: Tier
  status: string
  trialEndsAt: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
}

const DEFAULT_STATE: SubscriptionState = {
  tier: 'free',
  status: 'none',
  trialEndsAt: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
}

export async function getSubscription(userId: string): Promise<SubscriptionState> {
  const row = await getDb().query.subscriptions.findFirst({ where: eq(subscriptions.userId, userId) })
  if (!row) return DEFAULT_STATE

  // Expired non-renewing subscription falls back to free.
  const periodEnded = row.currentPeriodEnd ? row.currentPeriodEnd.getTime() < Date.now() : false
  const effectiveTier: Tier = row.status === 'active' || row.status === 'trialing' || !periodEnded
    ? (row.tier as Tier)
    : 'free'

  return {
    tier: effectiveTier,
    status: row.status,
    trialEndsAt: row.trialEndsAt,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  }
}

export async function getTier(userId: string): Promise<Tier> {
  return (await getSubscription(userId)).tier
}

function currentPeriod(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

export type QuotaResult = { allowed: boolean; remaining: number; limit: number; tier: Tier }

/** Reads current usage for a feature without consuming. */
export async function getQuota(userId: string, feature: Feature): Promise<QuotaResult> {
  const tier = await getTier(userId)
  if (await isAdminUser(userId)) {
    return { allowed: true, remaining: Number.MAX_SAFE_INTEGER, limit: UNLIMITED, tier }
  }
  const limit = getLimit(tier, feature)
  if (isUnlimited(limit)) return { allowed: true, remaining: Number.MAX_SAFE_INTEGER, limit, tier }
  const used = await currentUsage(userId, feature)
  return { allowed: used < limit, remaining: Math.max(0, limit - used), limit, tier }
}

async function currentUsage(userId: string, feature: Feature): Promise<number> {
  const row = await getDb()
    .query.usageCounters.findFirst({
      where: and(
        eq(usageCounters.userId, userId),
        eq(usageCounters.period, currentPeriod()),
        eq(usageCounters.feature, feature),
      ),
    })
  return row?.count ?? 0
}

/**
 * Atomically checks the quota and consumes one unit if allowed. Returns false
 * (without consuming) when the cap is reached. Call before an AI request.
 */
export async function checkAndConsume(userId: string, feature: Feature): Promise<QuotaResult> {
  const quota = await getQuota(userId, feature)
  if (!quota.allowed) return quota

  const period = currentPeriod()
  await getDb()
    .insert(usageCounters)
    .values({ userId, period, feature, count: 1 })
    .onConflictDoUpdate({
      target: [usageCounters.userId, usageCounters.period, usageCounters.feature],
      set: { count: sql`${usageCounters.count} + 1`, updatedAt: new Date() },
    })

  return { ...quota, remaining: Math.max(0, quota.remaining - 1) }
}

export type Entitlements = {
  tier: Tier
  limits: Record<Feature, number>
}

export async function getEntitlements(userId: string): Promise<Entitlements> {
  const tier = await getTier(userId)
  return { tier, limits: LIMITS[tier] }
}

// ── Subscription lifecycle (called by Paystack webhook + actions) ───────────

export async function upsertSubscription(
  userId: string,
  patch: Partial<{
    tier: Tier
    status: string
    paystackCustomerCode: string | null
    paystackSubscriptionCode: string | null
    paystackEmailToken: string | null
    planCode: string | null
    currentPeriodEnd: Date | null
    trialEndsAt: Date | null
    cancelAtPeriodEnd: boolean
  }>,
): Promise<void> {
  const db = getDb()
  const existing = await db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, userId) })
  if (existing) {
    await db.update(subscriptions).set({ ...patch, updatedAt: new Date() }).where(eq(subscriptions.userId, userId))
  } else {
    await db.insert(subscriptions).values({ userId, tier: 'free', status: 'none', ...patch })
  }
}

export async function getPaystackHandles(
  userId: string,
): Promise<{ code: string | null; token: string | null }> {
  const row = await getDb().query.subscriptions.findFirst({ where: eq(subscriptions.userId, userId) })
  return { code: row?.paystackSubscriptionCode ?? null, token: row?.paystackEmailToken ?? null }
}

export async function startTrial(userId: string, tier: Tier, days = 14): Promise<void> {
  const trialEndsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  await upsertSubscription(userId, { tier, status: 'trialing', trialEndsAt, currentPeriodEnd: trialEndsAt })
}
