'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { Button, Card, Field, Label, Input, Textarea, Alert } from '@/components/ui'

type Condition = Record<string, unknown> & { id: string }
type Treatment = Record<string, unknown> & { id: string }

const TREATMENT_KINDS = [
  { id: 'medication', label: 'Medication' },
  { id: 'therapy', label: 'Therapy' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'supplement', label: 'Supplement' },
  { id: 'device', label: 'Device' },
]

const selectClasses =
  'h-11 w-full rounded-xl border border-brand-background/15 bg-brand-background/[0.08] px-4 text-sm text-brand-background transition-colors focus:border-brand-background/40 focus:outline-none focus:ring-2 focus:ring-brand-background/10 disabled:opacity-50'

export default function ShareExperiencePage() {
  const router = useRouter()
  const params = useSearchParams()
  const preselectedCondition = params.get('condition') ?? ''
  const preselectedTreatment = params.get('treatment') ?? ''
  const { user, loading: authLoading } = useAuth()

  const [conditions, setConditions] = useState<Condition[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [selectedCondition, setSelectedCondition] = useState(preselectedCondition)
  const [selectedTreatment, setSelectedTreatment] = useState(preselectedTreatment)
  const [newTreatmentName, setNewTreatmentName] = useState('')
  const [newTreatmentKind, setNewTreatmentKind] = useState<string>('medication')
  const [effectiveness, setEffectiveness] = useState(3)
  const [sideEffects, setSideEffects] = useState(1)
  const [durationWeeks, setDurationWeeks] = useState<number | ''>('')
  const [story, setStory] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, router, user])

  useEffect(() => {
    Promise.all([DatabaseService.getConditions(), DatabaseService.getTreatments()]).then(
      ([conditionsData, treatmentsData]) => {
        setConditions(conditionsData as Condition[])
        setTreatments(treatmentsData as Treatment[])
      },
    )
  }, [])

  const conditionOptions = useMemo(
    () =>
      conditions
        .slice()
        .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [conditions],
  )
  const treatmentOptions = useMemo(
    () =>
      treatments
        .slice()
        .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [treatments],
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!user) return
    setError(null)

    if (!selectedCondition) {
      setError('Please pick a condition.')
      return
    }

    let treatmentSlug = selectedTreatment
    if (!treatmentSlug) {
      if (!newTreatmentName.trim()) {
        setError('Pick a treatment or add a new one.')
        return
      }
      setSubmitting(true)
      const { id } = await DatabaseService.createTreatment(user.userId, {
        name: newTreatmentName.trim(),
        kind: newTreatmentKind,
      })
      treatmentSlug = id
    }

    setSubmitting(true)
    try {
      await DatabaseService.createExperience(user.userId, {
        condition_slug: selectedCondition,
        treatment_slug: treatmentSlug,
        effectiveness,
        side_effects: sideEffects,
        duration_weeks: typeof durationWeeks === 'number' ? durationWeeks : undefined,
        story: story.trim(),
        is_anonymous: isAnonymous,
      })
      router.push(`/conditions/${selectedCondition}`)
    } catch (submissionError) {
      console.error('Failed to save experience:', submissionError)
      setError('Something went wrong saving your experience. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageFrame>
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent2">
            Share experience
          </p>
          <h1 className="text-2xl font-bold text-brand-background sm:text-3xl">What helped you?</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-brand-background/65">
            Your rating helps someone else trying to figure out what to try next. You can share
            anonymously. Be honest &mdash; both the wins and the side effects matter.
          </p>
        </header>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="condition">Condition</Label>
              <select
                id="condition"
                value={selectedCondition}
                onChange={(event) => setSelectedCondition(event.target.value)}
                className={selectClasses}
              >
                <option value="" className="bg-brand-primary">
                  Pick a condition
                </option>
                {conditionOptions.map((condition) => (
                  <option key={condition.id} value={condition.id} className="bg-brand-primary">
                    {condition.name as string}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-brand-background/50">
                Don&apos;t see yours?{' '}
                <Link href="/conditions" className="font-medium text-brand-accent2">
                  Browse the directory
                </Link>{' '}
                &mdash; we&apos;re growing it weekly.
              </p>
            </div>

            <div className="space-y-3">
              <Field label="Treatment" htmlFor="treatment">
                <select
                  id="treatment"
                  value={selectedTreatment}
                  onChange={(event) => setSelectedTreatment(event.target.value)}
                  className={selectClasses}
                >
                  <option value="" className="bg-brand-primary">
                    Pick a treatment (or add new below)
                  </option>
                  {treatmentOptions.map((treatment) => (
                    <option key={treatment.id} value={treatment.id} className="bg-brand-primary">
                      {treatment.name as string} ({(treatment.kind as string) ?? 'treatment'})
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
                <Input
                  value={newTreatmentName}
                  onChange={(event) => setNewTreatmentName(event.target.value)}
                  placeholder="Or add a new treatment name"
                  aria-label="New treatment name"
                  disabled={Boolean(selectedTreatment)}
                />
                <select
                  value={newTreatmentKind}
                  onChange={(event) => setNewTreatmentKind(event.target.value)}
                  className={selectClasses}
                  aria-label="New treatment type"
                  disabled={Boolean(selectedTreatment)}
                >
                  {TREATMENT_KINDS.map((kind) => (
                    <option key={kind.id} value={kind.id} className="bg-brand-primary">
                      {kind.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <Label htmlFor="effectiveness">Effectiveness ({effectiveness}/5)</Label>
                <input
                  id="effectiveness"
                  type="range"
                  min={1}
                  max={5}
                  value={effectiveness}
                  onChange={(event) => setEffectiveness(Number(event.target.value))}
                  className="mt-1 w-full accent-brand-accent2"
                />
                <p className="mt-1 text-xs text-brand-background/50">
                  1 = didn&apos;t help, 5 = life-changing
                </p>
              </div>
              <div>
                <Label htmlFor="side-effects">Side effects ({sideEffects}/5)</Label>
                <input
                  id="side-effects"
                  type="range"
                  min={0}
                  max={5}
                  value={sideEffects}
                  onChange={(event) => setSideEffects(Number(event.target.value))}
                  className="mt-1 w-full accent-brand-accent1"
                />
                <p className="mt-1 text-xs text-brand-background/50">0 = none, 5 = severe</p>
              </div>
            </div>

            <Field label="How long did you try it?" htmlFor="duration" hint="In weeks">
              <Input
                id="duration"
                type="number"
                min={0}
                value={durationWeeks}
                onChange={(event) =>
                  setDurationWeeks(event.target.value === '' ? '' : Number(event.target.value))
                }
                placeholder="Weeks"
                className="max-w-40"
              />
            </Field>

            <Field label="Your story (optional)" htmlFor="story">
              <Textarea
                id="story"
                value={story}
                onChange={(event) => setStory(event.target.value)}
                placeholder="What worked, what didn't, what you'd want someone else to know..."
                className="h-32 resize-none"
              />
            </Field>

            <label className="flex items-center gap-2 text-sm text-brand-background/70">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(event) => setIsAnonymous(event.target.checked)}
                className="h-4 w-4 rounded border-brand-background/30 accent-brand-accent2"
              />
              Share anonymously
            </label>

            {error && <Alert tone="error">{error}</Alert>}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="secondary" fullWidth onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" fullWidth isLoading={submitting} disabled={submitting}>
                {submitting ? 'Sharing...' : 'Share experience'}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
