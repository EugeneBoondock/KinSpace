'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import PageFrame from '@/components/PageFrame'
import BottomNav from '@/components/BottomNav'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { cn } from '@/lib/cn'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  Field,
  Input,
  LinkButton,
  Skeleton,
  SwitchRow,
  Textarea,
} from '@/components/ui'

type ConditionOption = { id: string; name: string }

type TreatmentRow = {
  key: string
  name: string
  effectiveness: number | null
  sideEffects: string[]
}

type ConditionReportPayload = {
  conditionSlug: string
  ageOfOnset?: number | null
  symptoms?: string[]
  triggers?: string[]
  comorbidities?: string[]
  tests?: string[]
  treatments?: { name: string; effectiveness: number | null; side_effects?: string[] }[]
  note?: string | null
  isSearchVisible?: boolean
  completionState?: 'complete'
}

type EditableConditionReport = {
  id: string
  age_of_onset?: number | null
  symptoms?: string[]
  triggers?: string[]
  comorbidities?: string[]
  tests?: string[]
  treatments?: Array<{ name?: string | null; effectiveness?: number | null; side_effects?: string[] | null }>
  note?: string | null
  is_search_visible?: boolean
  completion_state?: string
}

const EFFECTIVENESS_LEVELS = [1, 2, 3, 4, 5] as const

const selectClasses =
  'h-11 w-full rounded-xl border border-brand-line-strong bg-brand-ink/[0.04] px-4 text-sm ' +
  'text-brand-ink transition-colors focus:outline-none focus:border-brand-accent2/55 ' +
  'focus:ring-2 focus:ring-brand-accent2/15 disabled:opacity-50'

function makeRowKey(): string {
  return `treatment-${Math.random().toString(36).slice(2, 10)}`
}

function emptyTreatmentRow(): TreatmentRow {
  return { key: makeRowKey(), name: '', effectiveness: null, sideEffects: [] }
}

function treatmentRowsFromReport(reportTreatments?: EditableConditionReport['treatments']): TreatmentRow[] {
  const rows = (reportTreatments ?? [])
    .map((treatment) => ({
      key: makeRowKey(),
      name: String(treatment.name ?? '').trim(),
      effectiveness: typeof treatment.effectiveness === 'number' ? treatment.effectiveness : null,
      sideEffects: Array.isArray(treatment.side_effects)
        ? treatment.side_effects.map((item) => String(item).trim()).filter(Boolean)
        : [],
    }))
    .filter((row) => row.name.length > 0)

  return rows.length > 0 ? rows : [emptyTreatmentRow()]
}

/**
 * Chip / tag input: type a label, press Enter to add a removable pill.
 * Stores a string[]. Duplicate and empty labels are ignored.
 */
function ChipInput({
  label,
  hint,
  placeholder,
  values,
  onChange,
  inputId,
}: {
  label: string
  hint?: string
  placeholder?: string
  values: string[]
  onChange: (next: string[]) => void
  inputId: string
}) {
  const [draft, setDraft] = useState('')

  function commitDraft() {
    const trimmed = draft.trim()
    if (!trimmed) return
    const exists = values.some((value) => value.toLowerCase() === trimmed.toLowerCase())
    if (!exists) onChange([...values, trimmed])
    setDraft('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commitDraft()
    } else if (event.key === 'Backspace' && draft === '' && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  function removeAt(index: number) {
    onChange(values.filter((_, i) => i !== index))
  }

  return (
    <Field label={label} htmlFor={inputId} hint={values.length === 0 ? hint : undefined}>
      {values.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2" aria-label={`${label} added`}>
          {values.map((value, index) => (
            <li key={`${value}-${index}`}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-accent2/15 py-1 pl-3 pr-1.5 text-sm font-medium text-brand-accent2">
                {value}
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  aria-label={`Remove ${value}`}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-brand-accent2/80 transition-colors hover:bg-brand-accent2/20 hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/40"
                >
                  <i className="ri-close-line text-sm" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={inputId}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        placeholder={placeholder ?? 'Type a label and press Enter'}
      />
    </Field>
  )
}

function EffectivenessSelector({
  value,
  onChange,
  groupLabel,
}: {
  value: number | null
  onChange: (next: number) => void
  groupLabel: string
}) {
  return (
    <div role="radiogroup" aria-label={groupLabel} className="flex flex-wrap gap-2">
      {EFFECTIVENESS_LEVELS.map((level) => {
        const active = value === level
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${level} out of 5`}
            onClick={() => onChange(level)}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/40',
              active
                ? 'border-brand-accent2 bg-brand-accent2 text-white'
                : 'border-brand-line-strong bg-brand-ink/[0.03] text-brand-ink/70 hover:border-brand-accent2/50 hover:text-brand-ink',
            )}
          >
            {level}
          </button>
        )
      })}
    </div>
  )
}

function ContributeInner() {
  const searchParams = useSearchParams()
  const conditionParam = searchParams.get('condition') ?? ''
  const { user, loading: authLoading } = useAuth()

  const [conditions, setConditions] = useState<ConditionOption[]>([])
  const [conditionName, setConditionName] = useState<string | null>(null)
  const [selectedSlug, setSelectedSlug] = useState(conditionParam)
  const [loadingCondition, setLoadingCondition] = useState(Boolean(conditionParam))

  const [ageOfOnset, setAgeOfOnset] = useState<number | ''>('')
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [triggers, setTriggers] = useState<string[]>([])
  const [comorbidities, setComorbidities] = useState<string[]>([])
  const [tests, setTests] = useState<string[]>([])
  const [treatments, setTreatments] = useState<TreatmentRow[]>([emptyTreatmentRow()])
  const [note, setNote] = useState('')
  const [isSearchVisible, setIsSearchVisible] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)
  const [hasExistingReport, setHasExistingReport] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [savedAction, setSavedAction] = useState<'created' | 'updated'>('created')

  // When a ?condition=<slug> is present, resolve its display name for the header.
  useEffect(() => {
    if (!conditionParam) return
    let cancelled = false
    async function loadCondition() {
      try {
        const doc = (await DatabaseService.getCondition(conditionParam)) as
          | (ConditionOption & Record<string, unknown>)
          | null
        if (cancelled) return
        if (doc) {
          setConditionName(doc.name)
          setSelectedSlug(doc.id)
        }
      } catch (loadError) {
        console.error('Failed to load condition:', loadError)
      } finally {
        if (!cancelled) setLoadingCondition(false)
      }
    }
    loadCondition()
    return () => {
      cancelled = true
    }
  }, [conditionParam])

  // When no condition is preselected, let the member pick from the directory.
  useEffect(() => {
    if (conditionParam) return
    let cancelled = false
    async function loadConditions() {
      try {
        const list = (await DatabaseService.getConditions()) as Array<
          ConditionOption & Record<string, unknown>
        >
        if (!cancelled) {
          setConditions(list.map((item) => ({ id: item.id, name: item.name })))
        }
      } catch (loadError) {
        console.error('Failed to load conditions:', loadError)
      }
    }
    loadConditions()
    return () => {
      cancelled = true
    }
  }, [conditionParam])

  const sortedConditions = useMemo(
    () => conditions.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [conditions],
  )

  const headerName = conditionName ?? sortedConditions.find((c) => c.id === selectedSlug)?.name ?? null

  function resetReportFields() {
    setAgeOfOnset('')
    setSymptoms([])
    setTriggers([])
    setComorbidities([])
    setTests([])
    setTreatments([emptyTreatmentRow()])
    setNote('')
    setIsSearchVisible(false)
  }

  useEffect(() => {
    if (!user || !selectedSlug) {
      setHasExistingReport(false)
      return
    }

    let cancelled = false
    async function loadReport() {
      setLoadingReport(true)
      setError(null)
      try {
        const result = (await DatabaseService.getMyConditionReport(selectedSlug)) as
          | { report?: EditableConditionReport | null }
          | null
        if (cancelled) return

        const report = result?.report
        if (!report) {
          setHasExistingReport(false)
          resetReportFields()
          return
        }

        setHasExistingReport(true)
        setAgeOfOnset(typeof report.age_of_onset === 'number' ? report.age_of_onset : '')
        setSymptoms(Array.isArray(report.symptoms) ? report.symptoms : [])
        setTriggers(Array.isArray(report.triggers) ? report.triggers : [])
        setComorbidities(Array.isArray(report.comorbidities) ? report.comorbidities : [])
        setTests(Array.isArray(report.tests) ? report.tests : [])
        setTreatments(treatmentRowsFromReport(report.treatments))
        setNote(report.note ?? '')
        setIsSearchVisible(Boolean(report.is_search_visible))
      } catch (loadError) {
        console.error('Failed to load condition report:', loadError)
        if (!cancelled) setError('Something went wrong loading your saved report.')
      } finally {
        if (!cancelled) setLoadingReport(false)
      }
    }

    loadReport()
    return () => {
      cancelled = true
    }
  }, [user, selectedSlug])

  function updateTreatment(key: string, patch: Partial<TreatmentRow>) {
    setTreatments((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function addTreatment() {
    setTreatments((rows) => [...rows, emptyTreatmentRow()])
  }

  function removeTreatment(key: string) {
    setTreatments((rows) => {
      const next = rows.filter((row) => row.key !== key)
      return next.length > 0 ? next : [emptyTreatmentRow()]
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!user) return
    setError(null)

    if (!selectedSlug) {
      setError('Please choose a condition before submitting.')
      return
    }

    const cleanedTreatments = treatments
      .filter((row) => row.name.trim().length > 0)
      .map((row) => ({
        name: row.name.trim(),
        effectiveness: row.effectiveness,
        side_effects: row.sideEffects.length > 0 ? row.sideEffects : undefined,
      }))

    const payload: ConditionReportPayload = {
      conditionSlug: selectedSlug,
      ageOfOnset: ageOfOnset === '' ? null : ageOfOnset,
      symptoms: symptoms.length > 0 ? symptoms : undefined,
      triggers: triggers.length > 0 ? triggers : undefined,
      comorbidities: comorbidities.length > 0 ? comorbidities : undefined,
      tests: tests.length > 0 ? tests : undefined,
      treatments: cleanedTreatments.length > 0 ? cleanedTreatments : undefined,
      note: note.trim() ? note.trim() : null,
      isSearchVisible,
      completionState: 'complete',
    }

    setSubmitting(true)
    try {
      const action = hasExistingReport ? 'updated' : 'created'
      const result = (await DatabaseService.submitConditionReport(user.userId, payload)) as {
        ok: boolean
        conditionSlug: string
      }
      setSavedAction(action)
      setSavedSlug(result?.conditionSlug ?? selectedSlug)
      setHasExistingReport(true)
    } catch (submitError) {
      console.error('Failed to submit condition report:', submitError)
      setError('Something went wrong saving your contribution. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="space-y-5">
        <Card className="space-y-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </Card>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    )
  }

  if (!user) {
    return (
      <EmptyState
        icon={<i className="ri-shield-user-line text-4xl" aria-hidden="true" />}
        title="Sign in to contribute"
        description="Your structured report helps build the community study for this condition. Sign in to add yours."
        action={<LinkButton href="/login">Sign in</LinkButton>}
      />
    )
  }

  if (savedSlug) {
    return (
      <div className="space-y-5">
        <Alert tone="success" title={savedAction === 'updated' ? 'Report updated' : 'Thank you for contributing'}>
          {savedAction === 'updated'
            ? 'Your report has been updated. Community study totals use the latest version you saved.'
            : 'Your report has been added to the community study. Aggregated insights update as more members share.'}
        </Alert>
        <Card className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">
              {savedAction === 'updated'
                ? `${headerName ?? 'This condition'} has your latest report`
                : `${headerName ?? 'This condition'} just got a little clearer`}
            </CardTitle>
            <p className="mt-1 text-sm text-brand-ink/60">
              See how your experience compares with others tracking the same condition.
            </p>
          </div>
          <LinkButton
            href={`/conditions/${savedSlug}`}
            leadingIcon={<i className="ri-bar-chart-2-line" aria-hidden="true" />}
          >
            See the community study
          </LinkButton>
        </Card>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <header className="space-y-2">
        <p className="eyebrow">Contribute your experience</p>
        <h1 className="text-2xl font-bold text-brand-ink sm:text-3xl">
          {loadingCondition ? (
            <Skeleton className="h-8 w-2/3" />
          ) : headerName ? (
            <>
              {hasExistingReport ? 'Update your data on ' : 'Add your data on '}
              <span className="text-brand-accent2">{headerName}</span>
            </>
          ) : (
            'Contribute your experience'
          )}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-brand-ink/65">
          A few structured details about your experience power the aggregated study for this
          condition. Everything is optional except the condition itself. Share what you can.
        </p>
      </header>

      {loadingReport && (
        <Alert tone="advice" title="Loading your saved report">
          We are checking whether you already contributed for this condition.
        </Alert>
      )}

      {hasExistingReport && !loadingReport && (
        <Alert tone="advice" title="Editing your report">
          Changes replace your previous report for this condition.
        </Alert>
      )}

      {!conditionParam && (
        <Card>
          <CardTitle className="text-lg">Which condition is this about?</CardTitle>
          <div className="mt-3">
            <Field label="Condition" htmlFor="condition-select">
              <select
                id="condition-select"
                value={selectedSlug}
                onChange={(event) => {
                  setSavedSlug(null)
                  setSelectedSlug(event.target.value)
                }}
                className={selectClasses}
              >
                <option value="">Choose a condition</option>
                {sortedConditions.map((condition) => (
                  <option key={condition.id} value={condition.id}>
                    {condition.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Card>
      )}

      <Card>
        <CardTitle className="text-lg">Age of onset</CardTitle>
        <p className="mt-1 text-sm text-brand-ink/55">
          Roughly how old were you when symptoms began? (optional)
        </p>
        <div className="mt-3 max-w-40">
          <Input
            id="age-of-onset"
            type="number"
            min={0}
            max={120}
            value={ageOfOnset}
            onChange={(event) =>
              setAgeOfOnset(event.target.value === '' ? '' : Number(event.target.value))
            }
            placeholder="Age"
            aria-label="Age of onset"
          />
        </div>
      </Card>

      <Card>
        <CardTitle className="text-lg">Symptoms</CardTitle>
        <p className="mt-1 text-sm text-brand-ink/55">
          The symptoms you experience with this condition.
        </p>
        <div className="mt-3">
          <ChipInput
            inputId="symptoms-input"
            label="Symptoms"
            hint="e.g. Fatigue, Brain fog, Joint pain"
            placeholder="Add a symptom and press Enter"
            values={symptoms}
            onChange={setSymptoms}
          />
        </div>
      </Card>

      <Card>
        <CardTitle className="text-lg">Triggers</CardTitle>
        <p className="mt-1 text-sm text-brand-ink/55">
          Things that tend to set off or worsen your symptoms.
        </p>
        <div className="mt-3">
          <ChipInput
            inputId="triggers-input"
            label="Triggers"
            hint="e.g. Stress, Lack of sleep, Certain foods"
            placeholder="Add a trigger and press Enter"
            values={triggers}
            onChange={setTriggers}
          />
        </div>
      </Card>

      <Card>
        <CardTitle className="text-lg">Co-existing conditions</CardTitle>
        <p className="mt-1 text-sm text-brand-ink/55">
          Other conditions you also live with.
        </p>
        <div className="mt-3">
          <ChipInput
            inputId="comorbidities-input"
            label="Co-existing conditions"
            hint="e.g. Anxiety, IBS, Migraine"
            placeholder="Add a condition and press Enter"
            values={comorbidities}
            onChange={setComorbidities}
          />
        </div>
      </Card>

      <Card>
        <CardTitle className="text-lg">Diagnostic tests</CardTitle>
        <p className="mt-1 text-sm text-brand-ink/55">
          Tests or scans you had on the way to a diagnosis.
        </p>
        <div className="mt-3">
          <ChipInput
            inputId="tests-input"
            label="Diagnostic tests"
            hint="e.g. MRI, Blood panel, Biopsy"
            placeholder="Add a test and press Enter"
            values={tests}
            onChange={setTests}
          />
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">Treatments tried</CardTitle>
          <Badge tone="sage">{treatments.filter((row) => row.name.trim()).length} added</Badge>
        </div>
        <p className="mt-1 text-sm text-brand-ink/55">
          What you tried, how well it worked, and any side effects. Rows without a name are skipped.
        </p>

        <div className="mt-4 space-y-4">
          {treatments.map((row, index) => (
            <div
              key={row.key}
              className="rounded-2xl border border-brand-line bg-brand-ink/[0.02] p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-brand-ink/70">Treatment {index + 1}</p>
                <button
                  type="button"
                  onClick={() => removeTreatment(row.key)}
                  aria-label={`Remove treatment ${index + 1}`}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-brand-ink/50 transition-colors hover:bg-brand-crisis/10 hover:text-brand-crisis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-crisis/30"
                >
                  <i className="ri-delete-bin-line" aria-hidden="true" />
                  Remove
                </button>
              </div>

              <div className="mt-3 space-y-4">
                <Field label="Treatment name" htmlFor={`${row.key}-name`}>
                  <Input
                    id={`${row.key}-name`}
                    value={row.name}
                    onChange={(event) => updateTreatment(row.key, { name: event.target.value })}
                    placeholder="e.g. Sertraline, CBT, Magnesium"
                  />
                </Field>

                <div>
                  <p className="mb-1.5 block text-sm font-medium text-brand-ink/90">
                    Effectiveness{' '}
                    <span className="font-normal text-brand-ink/45">(1 = none, 5 = life-changing)</span>
                  </p>
                  <EffectivenessSelector
                    groupLabel={`Effectiveness for treatment ${index + 1}`}
                    value={row.effectiveness}
                    onChange={(level) => updateTreatment(row.key, { effectiveness: level })}
                  />
                </div>

                <ChipInput
                  inputId={`${row.key}-side-effects`}
                  label="Side effects"
                  hint="e.g. Nausea, Drowsiness"
                  placeholder="Add a side effect and press Enter"
                  values={row.sideEffects}
                  onChange={(next) => updateTreatment(row.key, { sideEffects: next })}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={addTreatment}
            leadingIcon={<i className="ri-add-line" aria-hidden="true" />}
          >
            Add treatment
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle className="text-lg">Anything else</CardTitle>
        <p className="mt-1 text-sm text-brand-ink/55">
          Context, what you wish you had known, or anything that does not fit above. (optional)
        </p>
        <div className="mt-3">
          <Field label="Notes" htmlFor="note">
            <Textarea
              id="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Share anything else that might help others..."
              className="h-32"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle className="text-lg">Report visibility</CardTitle>
        <p className="mt-1 text-sm text-brand-ink/55">
          By default your report only adds to anonymous totals.
        </p>
        <div className="mt-4 rounded-2xl border border-brand-line bg-brand-ink/[0.02] p-4">
          <SwitchRow
            checked={isSearchVisible}
            onCheckedChange={setIsSearchVisible}
            title="Show an anonymized summary in report search"
            description="Your name and profile stay hidden. Note text can help matching but is never shown."
          />
        </div>
      </Card>

      <Alert tone="advice">
        Contributions are member-reported experiences, not clinical evidence. KinSpace does not
        provide medical advice, always talk with your care team before making changes.
      </Alert>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="sticky bottom-4 z-10">
        <div className="rounded-2xl border border-brand-line bg-brand-surface/95 p-3 shadow-[var(--shadow-card)] backdrop-blur">
          <Button
            type="submit"
            fullWidth
            isLoading={submitting}
            disabled={submitting || loadingReport || !selectedSlug}
          >
            {submitting
              ? 'Saving your contribution...'
              : hasExistingReport
                ? 'Update contribution'
                : 'Submit contribution'}
          </Button>
        </div>
      </div>
    </form>
  )
}

export default function ContributePage() {
  return (
    <PageFrame containerClassName="max-w-3xl">
      <Suspense fallback={null}>
        <ContributeInner />
      </Suspense>
      <BottomNav />
    </PageFrame>
  )
}
