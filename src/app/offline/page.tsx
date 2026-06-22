'use client'

import { Button } from '@/components/ui'

export default function OfflinePage() {
  return (
    <main className="page-shell flex items-center justify-center">
      <div className="page-container flex max-w-md flex-col items-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-background/10">
          <i className="ri-wifi-off-line text-3xl text-brand-background" aria-hidden="true"></i>
        </div>
        <h1 className="mb-3 text-2xl font-bold text-brand-background">You’re offline</h1>
        <p className="mb-6 text-sm text-brand-background/70">
          It looks like your internet connection dropped. Some things may not load until you’re back
          online - your place here will be waiting when you return.
        </p>
        <Button
          onClick={() => window.location.reload()}
          leadingIcon={<i className="ri-refresh-line" aria-hidden="true" />}
        >
          Try again
        </Button>
      </div>
    </main>
  )
}
