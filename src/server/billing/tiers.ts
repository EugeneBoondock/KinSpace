export type Tier = 'free' | 'plus' | 'pro'

export type BillingPeriod = 'monthly' | 'quarterly' | 'annual'

export type BillingPeriodDisplay = {
  id: BillingPeriod
  label: string
  suffix: string
  months: number
  payfastFrequency: '3' | '4' | '6'
}

export const BILLING_PERIODS: BillingPeriodDisplay[] = [
  { id: 'monthly', label: 'Monthly', suffix: 'per month', months: 1, payfastFrequency: '3' },
  { id: 'quarterly', label: 'Quarterly', suffix: 'per quarter', months: 3, payfastFrequency: '4' },
  { id: 'annual', label: 'Annual', suffix: 'per year', months: 12, payfastFrequency: '6' },
]

export type Feature =
  | 'ai_therapy'
  | 'ai_ask'
  | 'ai_research'
  | 'journal'
  | 'saved_resources'
  | 'support_circles'
  | 'group_analytics'

export const UNLIMITED = Number.POSITIVE_INFINITY

/** Monthly limits per tier. UNLIMITED = no cap; 0 = not available on this tier. */
export const LIMITS: Record<Tier, Record<Feature, number>> = {
  free: {
    // Counted per SESSION, not per message. A session can have many messages.
    ai_therapy: 4,
    ai_ask: 10,
    ai_research: 2,
    journal: 0,
    saved_resources: 20,
    support_circles: 0,
    group_analytics: 0,
  },
  plus: {
    ai_therapy: UNLIMITED,
    ai_ask: 100,
    ai_research: 20,
    journal: UNLIMITED,
    saved_resources: UNLIMITED,
    support_circles: 0,
    group_analytics: 0,
  },
  pro: {
    ai_therapy: UNLIMITED,
    ai_ask: UNLIMITED,
    ai_research: UNLIMITED,
    journal: UNLIMITED,
    saved_resources: UNLIMITED,
    support_circles: UNLIMITED,
    group_analytics: UNLIMITED,
  },
}

export function getLimit(tier: Tier, feature: Feature): number {
  return LIMITS[tier]?.[feature] ?? 0
}

export function isUnlimited(value: number): boolean {
  return value === UNLIMITED
}

export function hasFeature(tier: Tier, feature: Feature): boolean {
  return getLimit(tier, feature) > 0
}

export type PlanDisplay = {
  id: Tier
  name: string
  tagline: string
  /** Monthly price in ZAR cents (0 = free). */
  priceCents: number
  highlights: string[]
  /** Env var holding the Paystack plan code for this tier (monthly). */
  planCodeEnv?: 'PAYSTACK_PLAN_PLUS' | 'PAYSTACK_PLAN_PRO'
}

export type GuideCreditPack = {
  id: 'guide_5' | 'guide_15' | 'guide_40'
  name: string
  credits: number
  priceCents: number
  description: string
}

export const PLANS: PlanDisplay[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Find your footing.',
    priceCents: 0,
    highlights: [
      'Join the community & support groups',
      'Browse conditions, treatments & research',
      '4 AI Guide sessions / month',
      '10 AI health questions / month',
      'Daily mood check-ins',
    ],
  },
  {
    id: 'plus',
    name: 'KinSpace Plus',
    tagline: 'Go deeper, every day.',
    priceCents: 9900,
    planCodeEnv: 'PAYSTACK_PLAN_PLUS',
    highlights: [
      'Unlimited AI Guide sessions',
      '100 AI questions & 20 deep-research articles / month',
      'Personal healing journal',
      'Symptom & treatment trackers',
      'Private saved resources',
      'Weekly personalised digest',
    ],
  },
  {
    id: 'pro',
    name: 'KinSpace Pro',
    tagline: 'For care partners & facilitators.',
    priceCents: 24900,
    planCodeEnv: 'PAYSTACK_PLAN_PRO',
    highlights: [
      'Everything in Plus, unlimited',
      'Create & manage support circles',
      'Group check-ins & engagement analytics',
      'Private community spaces',
      'Verified facilitator badge',
    ],
  },
]

export const GUIDE_CREDIT_PACKS: GuideCreditPack[] = [
  {
    id: 'guide_5',
    name: '5 Guide credits',
    credits: 5,
    priceCents: 3900,
    description: 'A light top-up for a few extra sessions.',
  },
  {
    id: 'guide_15',
    name: '15 Guide credits',
    credits: 15,
    priceCents: 9900,
    description: 'Good for a month with a few deeper talks.',
  },
  {
    id: 'guide_40',
    name: '40 Guide credits',
    credits: 40,
    priceCents: 19900,
    description: 'For members who want extra room without a plan change.',
  },
]

export function planForTier(tier: Tier): PlanDisplay {
  return PLANS.find((p) => p.id === tier) ?? PLANS[0]
}

export function guideCreditPack(packId: string): GuideCreditPack | null {
  return GUIDE_CREDIT_PACKS.find((pack) => pack.id === packId) ?? null
}

export function billingPeriodFromInput(value: unknown): BillingPeriod {
  return value === 'quarterly' || value === 'annual' ? value : 'monthly'
}

export function billingPeriodInfo(period: BillingPeriod): BillingPeriodDisplay {
  return BILLING_PERIODS.find((item) => item.id === period) ?? BILLING_PERIODS[0]
}

export function billingPeriodMonths(period: BillingPeriod): number {
  return billingPeriodInfo(period).months
}

export function billingPeriodPayfastFrequency(period: BillingPeriod): '3' | '4' | '6' {
  return billingPeriodInfo(period).payfastFrequency
}

export function planPriceCents(plan: PlanDisplay, period: BillingPeriod): number {
  return plan.priceCents * billingPeriodMonths(period)
}

export function billingPeriodPlanCode(period: BillingPeriod): string {
  return `payfast:${period}`
}

export function billingPeriodFromPlanCode(planCode: string | null | undefined): BillingPeriod {
  const value = String(planCode ?? '').trim().toLowerCase()
  if (!value.startsWith('payfast:')) return 'monthly'
  return billingPeriodFromInput(value.slice('payfast:'.length))
}

export function billingPeriodEndFrom(start: Date, period: BillingPeriod): Date {
  const end = new Date(start)
  end.setUTCMonth(end.getUTCMonth() + billingPeriodMonths(period))
  return end
}
