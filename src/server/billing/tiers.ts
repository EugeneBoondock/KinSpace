export type Tier = 'free' | 'plus' | 'pro' | 'organisation'

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
  organisation: {
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

export type PlanBadge = {
  label: string
  tone: 'plus' | 'pro' | 'organisation'
  icon: string
}

export type PlanEntitlements = {
  badge: PlanBadge | null
  profileTools: string[]
  spaceTools: string[]
  groupTools: string[]
  organisationSeats: number | null
  prioritySupport: boolean
}

export type PlanDisplay = {
  id: Tier
  name: string
  tagline: string
  /** Monthly price in ZAR cents (0 = free). */
  priceCents: number
  highlights: string[]
  entitlements: PlanEntitlements
  /** Env var holding the legacy Paystack plan code for this tier. */
  planCodeEnv?: 'PAYSTACK_PLAN_PLUS' | 'PAYSTACK_PLAN_PRO' | 'PAYSTACK_PLAN_ORGANISATION'
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
    entitlements: {
      badge: null,
      profileTools: ['Public community profile'],
      spaceTools: ['Basic My Space profile'],
      groupTools: ['Join public groups'],
      organisationSeats: null,
      prioritySupport: false,
    },
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
    entitlements: {
      badge: { label: 'Plus member', tone: 'plus', icon: 'ri-sparkling-line' },
      profileTools: ['Plus member badge', 'Private saved resource library'],
      spaceTools: ['Personal motto', 'Pinned note', 'Custom vibe tag'],
      groupTools: ['Join private support spaces'],
      organisationSeats: null,
      prioritySupport: false,
    },
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
    entitlements: {
      badge: { label: 'Verified facilitator', tone: 'pro', icon: 'ri-shield-star-line' },
      profileTools: ['Verified facilitator badge', 'Facilitator profile signal', 'Support circle host identity'],
      spaceTools: ['Custom My Space background', 'Expanded pinned note', 'Profile vibe styling'],
      groupTools: ['Support circles', 'Group check-ins', 'Engagement analytics'],
      organisationSeats: null,
      prioritySupport: false,
    },
  },
  {
    id: 'organisation',
    name: 'KinSpace Organisation',
    tagline: 'For clinics, nonprofits, and care teams.',
    priceCents: 69900,
    planCodeEnv: 'PAYSTACK_PLAN_ORGANISATION',
    highlights: [
      'Everything in Pro, unlimited',
      'Verified organisation badge',
      'Branded profile and My Space tools',
      '8 facilitator seats for support circles',
      'Program and resource showcase',
      'Priority research and community safety requests',
    ],
    entitlements: {
      badge: { label: 'Verified organisation', tone: 'organisation', icon: 'ri-verified-badge-line' },
      profileTools: ['Verified organisation badge', 'Program showcase', 'Team and resource links'],
      spaceTools: [
        'Branded My Space background',
        'Program and resource showcase',
        'Pinned organisation note',
      ],
      groupTools: ['8 facilitator seats', 'Organisation support circles', 'Priority safety review'],
      organisationSeats: 8,
      prioritySupport: true,
    },
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

export function tierFromInput(value: unknown): Tier {
  return value === 'plus' || value === 'pro' || value === 'organisation' ? value : 'free'
}

export function planEntitlementsForTier(tier: Tier): PlanEntitlements {
  return planForTier(tier).entitlements
}

export function publicPlanBadgeForTier(tier: Tier): PlanBadge | null {
  return planEntitlementsForTier(tier).badge
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
