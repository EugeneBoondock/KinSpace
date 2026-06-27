import type { Metadata } from 'next'
import { Badge, LinkButton } from '@/components/ui'
import { BILLING_PERIODS, PLANS, billingPeriodInfo, planPriceCents } from '@/server/billing/tiers'
import { SubscribeButton } from './SubscribeButton'

export const metadata: Metadata = {
  title: 'Pricing - KinSpace',
  description:
    'Start free. Upgrade to KinSpace Plus, Pro, or Organisation for AI support, badges, private tools, and support spaces.',
}

function priceLabel(cents: number): string {
  if (cents === 0) return 'Free'
  return `R${(cents / 100).toFixed(0)}`
}

export default function PricingPage() {
  return (
    <main className="page-shell">
      <div className="page-container max-w-7xl">
        <header className="py-8 text-center">
          <h1 className="text-3xl font-bold text-brand-background sm:text-4xl">Care that grows with you</h1>
          <p className="mx-auto mt-3 max-w-xl text-brand-background/70">
            KinSpace is free to join. Upgrade when you want unlimited support and your own private tools. Cancel anytime.
          </p>
        </header>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => {
            const featured = plan.id === 'plus'
            const planBadge = plan.entitlements.badge
            return (
              <div
                key={plan.id}
                className={
                  'flex flex-col rounded-3xl border p-6 ' +
                  (featured
                    ? 'border-brand-accent2/50 bg-brand-primary/70 shadow-xl ring-1 ring-brand-accent2/30'
                    : 'border-brand-background/10 bg-brand-primary/40')
                }
              >
                {featured && (
                  <span className="mb-3 w-fit rounded-full bg-brand-accent2/20 px-3 py-1 text-xs font-semibold text-brand-accent2">
                    Most loved
                  </span>
                )}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-xl font-bold text-brand-background">{plan.name}</h2>
                  {planBadge && (
                    <Badge tone={plan.id === 'organisation' ? 'violet' : 'sage'}>
                      <i className={planBadge.icon} aria-hidden="true" />
                      {planBadge.label}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-brand-background/60">{plan.tagline}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  {plan.priceCents > 0 && <span className="text-sm text-brand-background/50">from</span>}
                  <span className="text-3xl font-bold text-brand-background">{priceLabel(plan.priceCents)}</span>
                  {plan.priceCents > 0 && <span className="text-sm text-brand-background/50">per month</span>}
                </div>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-brand-background/80">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent2" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 011.4-1.4l2.8 2.8 6.8-6.8a1 1 0 011.4 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {plan.id === 'free' ? (
                    <LinkButton href="/signup" variant="secondary" fullWidth>
                      Get started free
                    </LinkButton>
                  ) : (
                    <div className="space-y-2">
                      {BILLING_PERIODS.map((period) => {
                        const periodInfo = billingPeriodInfo(period.id)
                        return (
                          <div
                            key={period.id}
                            className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.04] p-3"
                          >
                            <div className="mb-2 flex items-baseline justify-between gap-3">
                              <span className="text-sm font-semibold text-brand-background">{periodInfo.label}</span>
                              <span className="text-sm text-brand-background/60">
                                {priceLabel(planPriceCents(plan, period.id))} {periodInfo.suffix}
                              </span>
                            </div>
                            <SubscribeButton
                              tier={plan.id}
                              period={period.id}
                              label={`Choose ${periodInfo.label.toLowerCase()}`}
                            />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-8 text-center text-sm text-brand-background/55">
          Prices in ZAR. Monthly, quarterly, and annual billing available. Secure payments by PayFast. Already joined?{' '}
          <a href="/plan" className="underline">
            Manage your plan
          </a>
          .
        </p>
      </div>
    </main>
  )
}
