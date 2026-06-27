'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'
import {
  cancelSubscriptionAction,
  resumeSubscriptionAction,
  startCheckoutAction,
  startGuideCreditsCheckoutAction,
} from '@/app/actions/billing'
import type { BillingPeriod, Tier } from '@/server/billing/tiers'

type CheckoutKind = `plan:${Tier}` | `credits:${string}` | 'cancel' | 'resume'

export function PlanCheckoutButton({
  tier,
  period = 'monthly',
  label,
  variant = 'accent',
}: {
  tier: Tier
  period?: BillingPeriod
  label: string
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost'
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setLoading(true)
    setError(null)
    const result = await startCheckoutAction(tier, period)
    if (result.ok) {
      window.location.href = result.authorizationUrl
      return
    }
    setError(result.error)
    setLoading(false)
  }

  return (
    <div>
      <Button type="button" variant={variant} onClick={submit} isLoading={loading} fullWidth>
        {label}
      </Button>
      {error && <p className="mt-2 text-xs text-brand-crisis">{error}</p>}
    </div>
  )
}

export function CreditCheckoutButton({ packId, label }: { packId: string; label: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setLoading(true)
    setError(null)
    const result = await startGuideCreditsCheckoutAction(packId)
    if (result.ok) {
      window.location.href = result.authorizationUrl
      return
    }
    setError(result.error)
    setLoading(false)
  }

  return (
    <div>
      <Button type="button" variant="secondary" onClick={submit} isLoading={loading} fullWidth>
        {label}
      </Button>
      {error && <p className="mt-2 text-xs text-brand-crisis">{error}</p>}
    </div>
  )
}

export function SubscriptionManageButton({
  action,
  label,
}: {
  action: Extract<CheckoutKind, 'cancel' | 'resume'>
  label: string
}) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function submit() {
    setLoading(true)
    setMessage(null)
    const result = action === 'cancel' ? await cancelSubscriptionAction() : await resumeSubscriptionAction()
    if (result.ok) {
      window.location.reload()
      return
    }
    setMessage(result.error)
    setLoading(false)
  }

  return (
    <div>
      <Button
        type="button"
        variant={action === 'cancel' ? 'danger' : 'secondary'}
        onClick={submit}
        isLoading={loading}
        fullWidth
      >
        {label}
      </Button>
      {message && <p className="mt-2 text-xs text-brand-crisis">{message}</p>}
    </div>
  )
}
