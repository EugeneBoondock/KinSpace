'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { signUpAction } from '@/app/actions/auth'
import AuthShell from '@/components/auth/AuthShell'
import { Button, Field, Input, Alert } from '@/components/ui'

export default function SignupPage() {
  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const update = (key: keyof typeof form) => (e: { target: { value: string } }) => {
    let val = e.target.value
    if (key === 'username') {
      val = val.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
    }
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    const result = await signUpAction(form)
    if (result.ok) {
      // Full navigation so the server-set session cookie is read by AuthContext.
      window.location.href = result.redirect ?? '/onboarding'
      return
    }
    setError(result.error)
    setLoading(false)
  }

  return (
    <AuthShell mode="signup" title="Create your space" subtitle="Free to join. You choose what to share.">
      {error && (
        <Alert tone="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="What should we call you?" htmlFor="fullName">
          <Input id="fullName" autoComplete="name" required value={form.fullName} onChange={update('fullName')} placeholder="Your name or a nickname" />
        </Field>
        <Field label="Username" htmlFor="username" hint="Letters, numbers and underscores. This is how others find you.">
          <Input id="username" autoComplete="username" required value={form.username} onChange={update('username')} placeholder="e.g. river_walker" />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={update('email')} placeholder="you@example.com" />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <Input id="password" type="password" autoComplete="new-password" required value={form.password} onChange={update('password')} placeholder="Create a password" />
        </Field>
        <Button type="submit" fullWidth size="lg" isLoading={loading}>
          Create account
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

      <p className="mt-4 text-center text-xs text-brand-ink/45">
        By joining you agree to our{' '}
        <Link href="/terms" className="underline">Terms</Link> and{' '}
        <Link href="/community-guidelines" className="underline">community guidelines</Link>. KinSpace offers peer
        support, not medical advice.
      </p>

      <p className="mt-5 text-center text-sm text-brand-ink/60 sm:hidden">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand-accent2 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
