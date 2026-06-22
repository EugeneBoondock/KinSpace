'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Spinner } from '@/components/ui'

export default function TherapistRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/therapy')
  }, [router])

  return (
    <main className="page-shell">
      <div className="page-container flex min-h-[60vh] items-center justify-center">
        <Card className="flex flex-col items-center text-center" role="status" aria-live="polite">
          <Spinner className="h-8 w-8 text-brand-accent2" />
          <p className="mt-3 text-sm text-brand-background/60">
            Opening your guided support room…
          </p>
        </Card>
      </div>
    </main>
  )
}
