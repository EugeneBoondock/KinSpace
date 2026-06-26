import type { Metadata } from 'next'
import BottomNav from '@/components/BottomNav'
import { Badge, Button, Card, LinkButton } from '@/components/ui'
import { requireUser } from '@/server/auth/current-user'
import { getGuideCreditBalance, getQuota, getSubscription } from '@/server/billing/repo'
import { GUIDE_CREDIT_PACKS, PLANS, type Tier, planForTier } from '@/server/billing/tiers'
import { CreditCheckoutButton, PlanCheckoutButton, SubscriptionManageButton } from './PlanActions'

export const metadata: Metadata = {
  title: 'Plan - KinSpace',
  description: 'Manage your KinSpace plan, cancellation, and Guide credits.',
}

function money(cents: number): string {
  if (cents === 0) return 'Free'
  return `R${(cents / 100).toFixed(0)}`
}

function dateLabel(value: Date | null): string {
  if (!value) return 'Not set'
  return value.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function quotaLabel(remaining: number, limit: number): string {
  if (!Number.isFinite(limit)) return 'Unlimited'
  return `${remaining} of ${limit} left`
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  const [subscription, guideQuota, askQuota, researchQuota, guideCredits] = await Promise.all([
    getSubscription(user.userId),
    getQuota(user.userId, 'ai_therapy'),
    getQuota(user.userId, 'ai_ask'),
    getQuota(user.userId, 'ai_research'),
    getGuideCreditBalance(user.userId),
  ])
  const params = searchParams ? await searchParams : {}
  const checkout = Array.isArray(params.checkout) ? params.checkout[0] : params.checkout
  const activePlan = planForTier(subscription.tier)
  const cancelledAtProvider =
    subscription.paymentProvider === 'payfast' && subscription.providerSubscriptionStatus === 'cancelled'

  return (
    <main className="page-shell min-h-screen">
      <div className="page-container max-w-6xl space-y-6">
        {checkout === 'complete' && (
          <Card className="border-brand-accent3/40 bg-brand-accent3/[0.08]">
            <div className="flex items-start gap-3">
              <i className="ri-checkbox-circle-line mt-0.5 text-xl text-brand-accent3" aria-hidden="true" />
              <div>
                <p className="font-semibold text-brand-ink">Payment received</p>
                <p className="mt-1 text-sm text-brand-ink/60">
                  Your plan or credits will update when the secure payment notice arrives.
                </p>
              </div>
            </div>
          </Card>
        )}

        {checkout === 'cancelled' && (
          <Card className="border-brand-accent2/40 bg-brand-accent2/[0.08]">
            <div className="flex items-start gap-3">
              <i className="ri-information-line mt-0.5 text-xl text-brand-accent2" aria-hidden="true" />
              <div>
                <p className="font-semibold text-brand-ink">Checkout cancelled</p>
                <p className="mt-1 text-sm text-brand-ink/60">No payment was made.</p>
              </div>
            </div>
          </Card>
        )}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <Badge tone={subscription.status === 'active' ? 'success' : 'neutral'}>
                  {subscription.status === 'active' ? 'Active' : subscription.status}
                </Badge>
                <h1 className="mt-3 text-3xl font-bold text-brand-ink">Your plan</h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-ink/60">
                  Manage billing, cancel access renewal, or add Guide credits for extra sessions.
                </p>
              </div>
              <div className="rounded-2xl border border-brand-line bg-brand-surface-raised p-4 md:min-w-60">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-ink/45">Current plan</p>
                <p className="mt-2 text-2xl font-bold text-brand-ink">{activePlan.name}</p>
                <p className="mt-1 text-sm text-brand-ink/55">
                  {money(activePlan.priceCents)}
                  {activePlan.priceCents > 0 ? ' per month' : ''}
                </p>
                <p className="mt-3 text-xs text-brand-ink/50">Renews or ends: {dateLabel(subscription.currentPeriodEnd)}</p>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-ink/45">Guide credits</p>
            <p className="mt-2 text-4xl font-bold text-brand-ink">{guideCredits}</p>
            <p className="mt-1 text-sm text-brand-ink/60">Credits are used only after monthly free sessions run out.</p>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <p className="text-sm font-semibold text-brand-ink">Guide sessions</p>
            <p className="mt-2 text-2xl font-bold text-brand-ink">{quotaLabel(guideQuota.remaining, guideQuota.limit)}</p>
            <p className="mt-1 text-xs text-brand-ink/55">Each new Guide session counts once. Messages inside it are included.</p>
          </Card>
          <Card>
            <p className="text-sm font-semibold text-brand-ink">Ask answers</p>
            <p className="mt-2 text-2xl font-bold text-brand-ink">{quotaLabel(askQuota.remaining, askQuota.limit)}</p>
            <p className="mt-1 text-xs text-brand-ink/55">For symptom, treatment, and resource questions.</p>
          </Card>
          <Card>
            <p className="text-sm font-semibold text-brand-ink">Research articles</p>
            <p className="mt-2 text-2xl font-bold text-brand-ink">{quotaLabel(researchQuota.remaining, researchQuota.limit)}</p>
            <p className="mt-1 text-xs text-brand-ink/55">For deeper AI research requests.</p>
          </Card>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-brand-ink">Change plan</h2>
              <p className="mt-1 text-sm text-brand-ink/60">Choose monthly access that fits how you use KinSpace.</p>
            </div>
            <LinkButton href="/pricing" variant="ghost" size="sm">
              Compare public pricing
            </LinkButton>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {PLANS.map((plan) => {
              const isCurrent = plan.id === subscription.tier
              return (
                <Card key={plan.id} className={isCurrent ? 'border-brand-accent2/50 bg-brand-accent2/[0.08]' : ''}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-brand-ink">{plan.name}</h3>
                      <p className="mt-1 text-sm text-brand-ink/55">{plan.tagline}</p>
                    </div>
                    {isCurrent && <Badge tone="success">Current</Badge>}
                  </div>
                  <p className="mt-4 text-3xl font-bold text-brand-ink">
                    {money(plan.priceCents)}
                    {plan.priceCents > 0 && <span className="text-sm font-medium text-brand-ink/45"> per month</span>}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {plan.highlights.slice(0, 5).map((item) => (
                      <li key={item} className="flex gap-2 text-sm leading-relaxed text-brand-ink/65">
                        <i className="ri-check-line mt-0.5 text-brand-accent3" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    {isCurrent ? (
                      <Button type="button" variant="secondary" fullWidth disabled>
                        Current plan
                      </Button>
                    ) : plan.id === 'free' ? (
                      <SubscriptionManageButton action="cancel" label="Move to Free at period end" />
                    ) : (
                      <PlanCheckoutButton tier={plan.id as Tier} label={`Choose ${plan.name}`} />
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.6fr)]">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-brand-ink">Guide credit packs</h2>
                <p className="mt-1 text-sm text-brand-ink/60">Top up without changing your plan.</p>
              </div>
              <Badge tone="info">One credit equals one new session</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {GUIDE_CREDIT_PACKS.map((pack) => (
                <div key={pack.id} className="rounded-2xl border border-brand-line bg-brand-surface-raised p-4">
                  <p className="font-bold text-brand-ink">{pack.name}</p>
                  <p className="mt-1 text-sm text-brand-ink/55">{pack.description}</p>
                  <p className="mt-4 text-2xl font-bold text-brand-ink">{money(pack.priceCents)}</p>
                  <div className="mt-4">
                    <CreditCheckoutButton packId={pack.id} label="Buy credits" />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-bold text-brand-ink">Manage subscription</h2>
            <p className="mt-2 text-sm leading-relaxed text-brand-ink/60">
              Cancelling keeps your paid access until the current period ends. Credits stay on your account.
            </p>
            <div className="mt-4 space-y-3">
              {subscription.tier === 'free' ? (
                <Button type="button" variant="secondary" fullWidth disabled>
                  No paid plan
                </Button>
              ) : subscription.cancelAtPeriodEnd ? (
                <>
                  <Badge tone="warning">Cancellation scheduled</Badge>
                  {cancelledAtProvider ? (
                    <p className="text-sm leading-relaxed text-brand-ink/60">
                      Choose a paid plan again when you want renewal to restart.
                    </p>
                  ) : (
                    <SubscriptionManageButton action="resume" label="Keep my plan" />
                  )}
                </>
              ) : (
                <SubscriptionManageButton action="cancel" label="Cancel subscription" />
              )}
            </div>
          </Card>
        </section>
      </div>
      <BottomNav />
    </main>
  )
}
