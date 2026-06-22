'use client'

import { Suspense, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { signInAction } from '@/app/actions/auth'
import AuthShell from '@/components/auth/AuthShell'
import { Button, Field, Input, Alert } from '@/components/ui'

function LoginInner() {
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(params.get('error'))
  const [loading, setLoading] = useState(false)
  const justReset = params.get('reset') === '1'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    const result = await signInAction({ email, password })
    if (result.ok) {
      // Full navigation so the server-set session cookie is read by AuthContext.
      window.location.href = result.redirect ?? '/dashboard'
      return
    }
    setError(result.error)
    setLoading(false)
  }

  return (
    <AuthShell mode="login" title="Welcome back" subtitle="Sign in to continue your journey.">
      {justReset && (
        <Alert tone="success" className="mb-4">
          Your password was updated. Sign in with your new password.
        </Alert>
      )}
      {error && (
        <Alert tone="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
          />
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-xs font-medium text-brand-accent2 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" fullWidth size="lg" isLoading={loading}>
          Sign in
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-brand-ink/40">
        <div className="h-px flex-1 bg-brand-line" />
        <span>or continue with</span>
        <div className="h-px flex-1 bg-brand-line" />
      </div>

      <a
        href="/api/auth/google"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-brand-line-strong text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-ink/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/40"
      >
        <i className="ri-google-fill text-lg" aria-hidden="true" /> Continue with Google
      </a>

      <p className="mt-6 text-center text-sm text-brand-ink/60 sm:hidden">
        New to KinSpace?{' '}
        <Link href="/signup" className="font-semibold text-brand-accent2 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}
