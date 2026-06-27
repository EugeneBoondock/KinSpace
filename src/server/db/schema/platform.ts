import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { pk, createdAt, updatedAt, timestamp, bool, json } from '../columns'
import { users } from './identity'

// ── Subscriptions & monetisation ────────────────────────────────────────────

export const subscriptions = sqliteTable('subscriptions', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** 'free' | 'plus' | 'pro' | 'organisation' */
  tier: text('tier').notNull().default('free'),
  /** 'active' | 'trialing' | 'past_due' | 'canceled' | 'none' */
  status: text('status').notNull().default('none'),
  paystackCustomerCode: text('paystack_customer_code'),
  paystackSubscriptionCode: text('paystack_subscription_code'),
  paystackEmailToken: text('paystack_email_token'),
  paymentProvider: text('payment_provider'),
  providerCustomerId: text('provider_customer_id'),
  providerSubscriptionId: text('provider_subscription_id'),
  providerSubscriptionStatus: text('provider_subscription_status'),
  providerReference: text('provider_reference'),
  planCode: text('plan_code'),
  currentPeriodEnd: timestamp('current_period_end'),
  trialEndsAt: timestamp('trial_ends_at'),
  cancelAtPeriodEnd: bool('cancel_at_period_end').notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

/** Per-user monthly usage counters for metered/gated AI features. */
export const usageCounters = sqliteTable(
  'usage_counters',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** YYYY-MM */
    period: text('period').notNull(),
    /** 'therapy' | 'ask' | 'research' */
    feature: text('feature').notNull(),
    count: integer('count').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('usage_counters_uniq').on(t.userId, t.period, t.feature)],
)

export const aiCreditBalances = sqliteTable('ai_credit_balances', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  feature: text('feature').notNull().default('ai_therapy'),
  credits: integer('credits').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const aiCreditPurchases = sqliteTable(
  'ai_credit_purchases',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    feature: text('feature').notNull().default('ai_therapy'),
    credits: integer('credits').notNull(),
    amountCents: integer('amount_cents').notNull(),
    provider: text('provider').notNull().default('payfast'),
    providerReference: text('provider_reference').notNull(),
    status: text('status').notNull().default('complete'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('ai_credit_provider_ref_idx').on(t.provider, t.providerReference),
    index('ai_credit_user_idx').on(t.userId),
  ],
)

/** Per-call AI cost ledger for spend monitoring and caps. */
export const aiCostLogs = sqliteTable(
  'ai_cost_logs',
  {
    id: pk(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    feature: text('feature').notNull(),
    model: text('model'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    /** Cost in micro-USD (USD * 1_000_000) to keep integer precision. */
    costMicros: integer('cost_micros').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('ai_cost_user_idx').on(t.userId), index('ai_cost_created_idx').on(t.createdAt)],
)

// ── Moderation & trust ──────────────────────────────────────────────────────

export const reports = sqliteTable(
  'reports',
  {
    id: pk(),
    reporterId: text('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 'post' | 'comment' | 'user' | 'message' | 'question' | 'answer' */
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    targetOwnerId: text('target_owner_id'),
    /** 'harassment' | 'spam' | 'self_harm' | 'misinformation' | 'nsfw' | 'other' */
    reason: text('reason').notNull(),
    detail: text('detail'),
    /** 'open' | 'reviewing' | 'actioned' | 'dismissed' */
    status: text('status').notNull().default('open'),
    resolvedBy: text('resolved_by'),
    resolutionNote: text('resolution_note'),
    createdAt: createdAt(),
    resolvedAt: timestamp('resolved_at'),
  },
  (t) => [index('reports_status_idx').on(t.status), index('reports_target_idx').on(t.targetType, t.targetId)],
)

export const userBlocks = sqliteTable(
  'user_blocks',
  {
    id: pk(),
    blockerId: text('blocker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: text('blocked_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('user_blocks_uniq').on(t.blockerId, t.blockedId)],
)

export const mutedTopics = sqliteTable(
  'muted_topics',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    topic: text('topic').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('muted_topics_uniq').on(t.userId, t.topic)],
)

export const notifications = sqliteTable(
  'notifications',
  {
    id: pk(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    data: json<Record<string, unknown>>('data'),
    readAt: timestamp('read_at'),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId)],
)

// ── Growth: referrals & audit ───────────────────────────────────────────────

export const referrals = sqliteTable(
  'referrals',
  {
    id: pk(),
    code: text('code').notNull().unique(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    claimedBy: text('claimed_by').references(() => users.id, { onDelete: 'set null' }),
    rewardType: text('reward_type').notNull().default('plus_month'),
    status: text('status').notNull().default('active'),
    createdAt: createdAt(),
    claimedAt: timestamp('claimed_at'),
  },
  (t) => [index('referrals_code_idx').on(t.code)],
)

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: pk(),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    meta: json<Record<string, unknown>>('meta'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_actor_idx').on(t.actorId), index('audit_created_idx').on(t.createdAt)],
)
