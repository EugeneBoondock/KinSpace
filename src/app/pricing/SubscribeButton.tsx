'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'
import { startCheckoutAction } from '@/app/actions/billing'
import type { BillingPeriod, Tier } from '@/server/billing/tiers'

export function SubscribeButton({ tier, period = 'monthly', label }: { tier: Tier; period?: BillingPeriod; label: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
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
    <div className="w-full">
      <Button onClick={handleClick} isLoading={loading} fullWidth variant="accent">
        {label}
      </Button>
      {error && (
        <p className="mt-2 text-center text-xs text-red-300">
          {error}{' '}
          {error.toLowerCase().includes('sign in') && (
            <a href="/signup" className="underline">
              Create an account
            </a>
          )}
        </p>
      )}
    </div>
  )
}
