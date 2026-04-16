'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'

type Condition = Record<string, unknown> & { id: string }
type Treatment = Record<string, unknown> & { id: string }

const TREATMENT_KINDS = [
  { id: 'medication', label: 'Medication' },
  { id: 'therapy', label: 'Therapy' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'supplement', label: 'Supplement' },
  { id: 'device', label: 'Device' },
]

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
      <div className="page-grid">
        <section className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
            Share experience
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">What helped you?</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#eedfc8]/60">
            Your rating helps someone else trying to figure out what to try next. You can share
            anonymously. Be honest &mdash; both the wins and the side effects matter.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="card space-y-5">
          <div>
            <label className="text-sm font-semibold text-[#eedfc8]">Condition</label>
            <select
              value={selectedCondition}
              onChange={(event) => setSelectedCondition(event.target.value)}
              className="input-field mt-2"
            >
              <option value="">Pick a condition</option>
              {conditionOptions.map((condition) => (
                <option key={condition.id} value={condition.id}>
                  {condition.name as string}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[#eedfc8]/45">
              Don&apos;t see yours?{' '}
              <Link href="/conditions" className="text-[#D19A58]">
                Browse the directory
              </Link>{' '}
              &mdash; we&apos;re growing it weekly.
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-[#eedfc8]">Treatment</label>
            <select
              value={selectedTreatment}
              onChange={(event) => setSelectedTreatment(event.target.value)}
              className="input-field mt-2"
            >
              <option value="">Pick a treatment (or add new below)</option>
              {treatmentOptions.map((treatment) => (
                <option key={treatment.id} value={treatment.id}>
                  {treatment.name as string} ({(treatment.kind as string) ?? 'treatment'})
                </option>
              ))}
            </select>

            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_9rem]">
              <input
                value={newTreatmentName}
                onChange={(event) => setNewTreatmentName(event.target.value)}
                placeholder="Or add a new treatment name"
                className="input-field"
                disabled={Boolean(selectedTreatment)}
              />
              <select
                value={newTreatmentKind}
                onChange={(event) => setNewTreatmentKind(event.target.value)}
                className="input-field"
                disabled={Boolean(selectedTreatment)}
              >
                {TREATMENT_KINDS.map((kind) => (
                  <option key={kind.id} value={kind.id}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-[#eedfc8]">
                Effectiveness ({effectiveness}/5)
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={effectiveness}
                onChange={(event) => setEffectiveness(Number(event.target.value))}
                className="mt-2 w-full"
              />
              <p className="text-xs text-[#eedfc8]/45">
                1 = didn&apos;t help, 5 = life-changing
              </p>
            </div>
            <div>
              <label className="text-sm font-semibold text-[#eedfc8]">
                Side effects ({sideEffects}/5)
              </label>
              <input
                type="range"
                min={0}
                max={5}
                value={sideEffects}
                onChange={(event) => setSideEffects(Number(event.target.value))}
                className="mt-2 w-full"
              />
              <p className="text-xs text-[#eedfc8]/45">
                0 = none, 5 = severe
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-[#eedfc8]">How long did you try it?</label>
            <input
              type="number"
              min={0}
              value={durationWeeks}
              onChange={(event) =>
                setDurationWeeks(event.target.value === '' ? '' : Number(event.target.value))
              }
              placeholder="Weeks"
              className="input-field mt-2 max-w-40"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-[#eedfc8]">Your story (optional)</label>
            <textarea
              value={story}
              onChange={(event) => setStory(event.target.value)}
              placeholder="What worked, what didn't, what you'd want someone else to know..."
              className="input-field mt-2 h-32 resize-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[#eedfc8]/70">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(event) => setIsAnonymous(event.target.checked)}
            />
            Share anonymously
          </label>

          {error && (
            <div className="rounded-2xl bg-[#B85C3A]/20 px-4 py-2 text-sm text-[#B85C3A]">{error}</div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary flex-1 !py-3 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex-1 !py-3 text-sm disabled:opacity-50"
            >
              {submitting ? 'Sharing...' : 'Share experience'}
            </button>
          </div>
        </form>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
