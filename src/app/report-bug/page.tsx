'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import PageFrame from '@/components/PageFrame'
import BottomNav from '@/components/BottomNav'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { formatRelativeTime } from '@/lib/platform'
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Skeleton, Textarea } from '@/components/ui'

type BugReport = {
  id: string
  title: string
  description: string
  page_url: string | null
  severity: string
  status: string
  created_at: string | number
}

const STATUS_TONE: Record<string, 'gold' | 'blue' | 'sage' | 'violet'> = {
  open: 'gold',
  investigating: 'violet',
  resolved: 'sage',
  closed: 'blue',
}
const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  investigating: 'Looking into it',
  resolved: 'Resolved',
  closed: 'Closed',
}

export default function ReportBugPage() {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [where, setWhere] = useState('')
  const [severity, setSeverity] = useState('normal')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const [mine, setMine] = useState<BugReport[] | null>(null)

  const loadMine = useCallback(async () => {
    if (!user) return
    try {
      const rows = (await DatabaseService.getMyBugReports()) as BugReport[]
      setMine(Array.isArray(rows) ? rows : [])
    } catch {
      setMine([])
    }
  }, [user])

  useEffect(() => {
    loadMine()
  }, [loadMine])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) {
      setError('Please describe the bug in a sentence.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await DatabaseService.reportBug({
        title: title.trim(),
        description: description.trim(),
        pageUrl: where.trim(),
        severity,
      })
      setTitle('')
      setDescription('')
      setWhere('')
      setSeverity('normal')
      setSubmitted(true)
      await loadMine()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your report. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageFrame containerClassName="max-w-2xl">
      <div className="space-y-6 pb-12">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink/45">Help us improve</p>
          <h1 className="text-2xl font-black tracking-tight text-brand-ink sm:text-3xl">Report a bug</h1>
          <p className="max-w-xl text-sm leading-relaxed text-brand-ink/65">
            Something not working right? Tell us what happened and we&rsquo;ll look into it. The more detail, the
            faster we can fix it.
          </p>
        </header>

        <Card>
          {submitted && (
            <Alert tone="success" className="mb-4">
              Thank you, your report is in. You can track its status below.
            </Alert>
          )}
          {error && (
            <Alert tone="error" className="mb-4">
              {error}
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="What went wrong?" htmlFor="bug-title">
              <Input
                id="bug-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onFocus={() => setSubmitted(false)}
                placeholder="e.g. My avatar doesn't show on my posts"
                required
              />
            </Field>
            <Field label="More detail" htmlFor="bug-desc" hint="What did you expect, and what happened instead? Steps to reproduce help a lot.">
              <Textarea
                id="bug-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe what you were doing when it happened…"
                className="resize-none"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Where did it happen?" htmlFor="bug-where" hint="Optional">
                <Input id="bug-where" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="e.g. the Groups page" />
              </Field>
              <Field label="How much does it affect you?" htmlFor="bug-sev">
                <select
                  id="bug-sev"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="input-field h-11 w-full"
                >
                  <option value="low">Minor, just a bit annoying</option>
                  <option value="normal">Normal, gets in the way</option>
                  <option value="high">Serious, I can&rsquo;t use a feature</option>
                </select>
              </Field>
            </div>
            <Button type="submit" size="lg" isLoading={submitting} leadingIcon={<i className="ri-bug-line" aria-hidden="true" />}>
              Send report
            </Button>
          </form>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-brand-ink">Your reports</h2>
          {mine === null ? (
            <div className="space-y-2">
              <Skeleton className="h-16 rounded-2xl" />
              <Skeleton className="h-16 rounded-2xl" />
            </div>
          ) : mine.length === 0 ? (
            <EmptyState
              icon={<i className="ri-bug-line text-3xl" aria-hidden="true" />}
              title="No reports yet"
              description="Anything you report will show up here so you can follow along."
            />
          ) : (
            <div className="space-y-2">
              {mine.map((b) => (
                <Card key={b.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-brand-ink">{b.title}</p>
                    {b.description && <p className="mt-0.5 line-clamp-2 text-xs text-brand-ink/55">{b.description}</p>}
                    <p className="mt-1 text-xs text-brand-ink/40">{formatRelativeTime(b.created_at)}</p>
                  </div>
                  <Badge tone={STATUS_TONE[b.status] ?? 'gold'} className="shrink-0">
                    {STATUS_LABEL[b.status] ?? b.status}
                  </Badge>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
