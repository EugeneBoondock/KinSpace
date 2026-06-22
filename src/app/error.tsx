'use client'

import { Alert, Button, LinkButton } from '@/components/ui'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="page-shell flex items-center justify-center">
      <div className="page-container flex max-w-md flex-col items-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-background/10">
          <i className="ri-error-warning-line text-3xl text-brand-accent1" aria-hidden="true"></i>
        </div>
        <h1 className="mb-3 text-2xl font-bold text-brand-background">Something went wrong</h1>
        <p className="mb-6 text-sm text-brand-background/70">
          This one’s on us - not on you. You can try again, and if it keeps happening, take a breath
          and come back in a little while.
        </p>
        <Alert tone="error" className="mb-6 w-full text-left">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </Alert>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset} leadingIcon={<i className="ri-refresh-line" aria-hidden="true" />}>
            Try again
          </Button>
          <LinkButton href="/" variant="secondary">
            Go home
          </LinkButton>
        </div>
      </div>
    </main>
  )
}
