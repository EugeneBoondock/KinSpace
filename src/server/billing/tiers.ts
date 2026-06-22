export type Tier = 'free' | 'plus' | 'pro'

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
    // Counted per SESSION, not per message — a session can have many messages.
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

export function planForTier(tier: Tier): PlanDisplay {
  return PLANS.find((p) => p.id === tier) ?? PLANS[0]
}
