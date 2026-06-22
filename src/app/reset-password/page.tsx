'use client'

import { Suspense, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { resetPasswordAction } from '@/app/actions/auth'
import { Button, Card, Field, Input, Alert } from '@/components/ui'

function ResetInner() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    const result = await resetPasswordAction({ token, password })
    if (result.ok) {
      router.push(result.redirect ?? '/login?reset=1')
      return
    }
    setError(result.error)
    setLoading(false)
  }

  return (
    <main className="page-shell">
      <div className="page-container max-w-md">
        <div className="mx-auto mt-6 w-full">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-brand-background">Choose a new password</h1>
          </div>
          <Card>
            {!token ? (
              <Alert tone="error">
                This reset link is missing or invalid. Please{' '}
                <Link href="/forgot-password" className="underline">
                  request a new one
                </Link>
                .
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <Alert tone="error">{error}</Alert>}
                <Field label="New password" htmlFor="password" hint="At least 8 characters.">
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </Field>
                <Button type="submit" fullWidth isLoading={loading}>
                  Update password
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </main>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  )
}
