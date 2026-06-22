'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { requestPasswordResetAction } from '@/app/actions/auth'
import { Button, Card, Field, Input, Alert } from '@/components/ui'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    const result = await requestPasswordResetAction({ email })
    setLoading(false)
    if (result.ok) setSent(true)
    else setError(result.error)
  }

  return (
    <main className="page-shell">
      <div className="page-container max-w-md">
        <div className="mx-auto mt-6 w-full">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-brand-background">Reset your password</h1>
            <p className="mt-1 text-sm text-brand-background/60">We’ll email you a secure link to choose a new one.</p>
          </div>

          <Card>
            {sent ? (
              <Alert tone="success">
                If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox (and spam).
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <Alert tone="error">{error}</Alert>}
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
                <Button type="submit" fullWidth isLoading={loading}>
                  Send reset link
                </Button>
              </form>
            )}
          </Card>

          <p className="mt-5 text-center text-sm text-brand-background/60">
            <Link href="/login" className="font-semibold text-brand-accent2 hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
