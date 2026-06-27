import { and, eq, gt, sql } from 'drizzle-orm'
import { getDb } from '../db/client'
import { aiCreditBalances, aiCreditPurchases, subscriptions, usageCounters, users } from '../db/schema'
import {
  billingPeriodFromPlanCode,
  type BillingPeriod,
  type Tier,
  type Feature,
  getLimit,
  isUnlimited,
  LIMITS,
  UNLIMITED,
} from './tiers'
import { effectiveTierFromSubscription, featureUsageStatus } from './access'

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
  paymentProvider: string | null
  providerSubscriptionId: string | null
  providerSubscriptionStatus: string | null
  providerReference: string | null
  billingPeriod: BillingPeriod
}

const DEFAULT_STATE: SubscriptionState = {
  tier: 'free',
  status: 'none',
  trialEndsAt: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  paymentProvider: null,
  providerSubscriptionId: null,
  providerSubscriptionStatus: null,
  providerReference: null,
  billingPeriod: 'monthly',
}

export async function getSubscription(userId: string): Promise<SubscriptionState> {
  const row = await getDb().query.subscriptions.findFirst({ where: eq(subscriptions.userId, userId) })
  if (!row) return DEFAULT_STATE

  const effectiveTier = effectiveTierFromSubscription(row)

  return {
    tier: effectiveTier,
    status: row.status,
    trialEndsAt: row.trialEndsAt,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    paymentProvider: row.paymentProvider,
    providerSubscriptionId: row.providerSubscriptionId,
    providerSubscriptionStatus: row.providerSubscriptionStatus,
    providerReference: row.providerReference,
    billingPeriod: billingPeriodFromPlanCode(row.planCode),
  }
}

export async function getTier(userId: string): Promise<Tier> {
  return (await getSubscription(userId)).tier
}

function currentPeriod(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

export type UsageMeter = 'none' | 'quota' | 'credit'
export type QuotaResult = { allowed: boolean; remaining: number; limit: number; tier: Tier; metered?: UsageMeter }

/** Reads current usage for a feature without consuming. */
export async function getQuota(userId: string, feature: Feature): Promise<QuotaResult> {
  const tier = await getTier(userId)
  if (await isAdminUser(userId)) {
    return { allowed: true, remaining: Number.MAX_SAFE_INTEGER, limit: UNLIMITED, tier, metered: 'none' }
  }
  const used = await currentUsage(userId, feature)
  return { ...featureUsageStatus(tier, feature, used), tier }
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
  const tier = await getTier(userId)
  if (await isAdminUser(userId)) {
    return { allowed: true, remaining: Number.MAX_SAFE_INTEGER, limit: UNLIMITED, tier, metered: 'none' }
  }

  const limit = getLimit(tier, feature)
  if (isUnlimited(limit)) {
    return { allowed: true, remaining: Number.MAX_SAFE_INTEGER, limit, tier, metered: 'none' }
  }

  const used = await currentUsage(userId, feature)
  const before = featureUsageStatus(tier, feature, used)
  if (!before.allowed) {
    if (feature === 'ai_therapy' && (await consumeGuideCredit(userId))) {
      return { allowed: true, remaining: 0, limit, tier, metered: 'credit' }
    }
    return { ...before, tier }
  }

  const remaining = await consumeQuotaSlot(userId, feature, limit)
  if (remaining === null) {
    if (feature === 'ai_therapy' && (await consumeGuideCredit(userId))) {
      return { allowed: true, remaining: 0, limit, tier, metered: 'credit' }
    }
    return { allowed: false, remaining: 0, limit, tier }
  }

  return { allowed: true, remaining, limit, tier, metered: 'quota' }
}

async function consumeQuotaSlot(userId: string, feature: Feature, limit: number): Promise<number | null> {
  const period = currentPeriod()
  const db = getDb()
  const inserted = await db
    .insert(usageCounters)
    .values({ userId, period, feature, count: 1 })
    .onConflictDoNothing({
      target: [usageCounters.userId, usageCounters.period, usageCounters.feature],
    })
    .returning({ count: usageCounters.count })
  if (inserted[0]) return Math.max(0, limit - inserted[0].count)

  const updated = await db
    .update(usageCounters)
    .set({ count: sql`${usageCounters.count} + 1`, updatedAt: new Date() })
    .where(and(
      eq(usageCounters.userId, userId),
      eq(usageCounters.period, period),
      eq(usageCounters.feature, feature),
      sql`${usageCounters.count} < ${limit}`,
    ))
    .returning({ count: usageCounters.count })

  return updated[0] ? Math.max(0, limit - updated[0].count) : null
}

export async function getGuideCreditBalance(userId: string): Promise<number> {
  const row = await getDb().query.aiCreditBalances.findFirst({ where: eq(aiCreditBalances.userId, userId) })
  return Math.max(0, row?.credits ?? 0)
}

async function consumeGuideCredit(userId: string): Promise<boolean> {
  const rows = await getDb()
    .update(aiCreditBalances)
    .set({ credits: sql`max(0, ${aiCreditBalances.credits} - 1)`, updatedAt: new Date() })
    .where(and(eq(aiCreditBalances.userId, userId), gt(aiCreditBalances.credits, 0)))
    .returning({ credits: aiCreditBalances.credits })
  return Boolean(rows[0])
}

export async function refundConsumedUsageInDb(
  db: ReturnType<typeof getDb>,
  userId: string,
  feature: Feature,
  usage: QuotaResult | null | undefined,
): Promise<void> {
  if (!userId || !usage?.allowed) return

  if (usage.metered === 'quota') {
    await db
      .update(usageCounters)
      .set({ count: sql`max(0, ${usageCounters.count} - 1)`, updatedAt: new Date() })
      .where(and(
        eq(usageCounters.userId, userId),
        eq(usageCounters.period, currentPeriod()),
        eq(usageCounters.feature, feature),
        gt(usageCounters.count, 0),
      ))
      .returning({ count: usageCounters.count })
    return
  }

  if (usage.metered === 'credit' && feature === 'ai_therapy') {
    await db
      .insert(aiCreditBalances)
      .values({ userId, feature, credits: 1 })
      .onConflictDoUpdate({
        target: aiCreditBalances.userId,
        set: {
          credits: sql`${aiCreditBalances.credits} + 1`,
          updatedAt: new Date(),
        },
      })
  }
}

export async function refundConsumedUsage(
  userId: string,
  feature: Feature,
  usage: QuotaResult | null | undefined,
): Promise<void> {
  await refundConsumedUsageInDb(getDb(), userId, feature, usage)
}

export async function grantGuideCredits(
  userId: string,
  input: { credits: number; amountCents: number; providerReference: string; provider?: string },
): Promise<{ granted: boolean; balance: number }> {
  const credits = Math.max(0, Math.floor(input.credits))
  if (!userId || credits <= 0 || !input.providerReference) {
    return { granted: false, balance: await getGuideCreditBalance(userId) }
  }

  const provider = input.provider ?? 'payfast'
  const existing = await getDb().query.aiCreditPurchases.findFirst({
    where: and(
      eq(aiCreditPurchases.provider, provider),
      eq(aiCreditPurchases.providerReference, input.providerReference),
    ),
  })
  if (existing) return { granted: false, balance: await getGuideCreditBalance(userId) }

  await getDb().insert(aiCreditPurchases).values({
    id: crypto.randomUUID(),
    userId,
    feature: 'ai_therapy',
    credits,
    amountCents: input.amountCents,
    provider,
    providerReference: input.providerReference,
    status: 'complete',
  })

  await getDb()
    .insert(aiCreditBalances)
    .values({ userId, feature: 'ai_therapy', credits })
    .onConflictDoUpdate({
      target: aiCreditBalances.userId,
      set: {
        credits: sql`${aiCreditBalances.credits} + ${credits}`,
        updatedAt: new Date(),
      },
    })

  return { granted: true, balance: await getGuideCreditBalance(userId) }
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
    paymentProvider: string | null
    providerCustomerId: string | null
    providerSubscriptionId: string | null
    providerSubscriptionStatus: string | null
    providerReference: string | null
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

export async function getSubscriptionBillingHandle(
  userId: string,
): Promise<{
  provider: string | null
  providerSubscriptionId: string | null
  providerSubscriptionStatus: string | null
  legacyCode: string | null
  legacyToken: string | null
}> {
  const row = await getDb().query.subscriptions.findFirst({ where: eq(subscriptions.userId, userId) })
  return {
    provider: row?.paymentProvider ?? null,
    providerSubscriptionId: row?.providerSubscriptionId ?? null,
    providerSubscriptionStatus: row?.providerSubscriptionStatus ?? null,
    legacyCode: row?.paystackSubscriptionCode ?? null,
    legacyToken: row?.paystackEmailToken ?? null,
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
