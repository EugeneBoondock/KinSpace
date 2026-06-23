'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { DatabaseService } from '@/lib/database'
import { cn } from '@/lib/cn'
import { Badge, Button, Card, CardTitle, Input, LinkButton, Skeleton, Textarea } from '@/components/ui'

type EmergencyFlag = { id: string; label: string; kind: 'medical' | 'crisis' }
type CommonSymptom = { slug: string; name: string }
type Candidate = {
  slug: string
  name: string
  category: string | null
  matched_symptoms: string[]
  match_count: number
  total_reported: number
  match_strength: number
}
type Result = {
  triage: 'crisis' | 'urgent' | 'see-clinician'
  crisis: boolean
  red_flags: string[]
  reported: string[]
  candidates: Candidate[]
  next_steps: string[]
  disclaimer: string
}
type Step = 'emergency' | 'symptoms' | 'results'

function CrisisBlock() {
  return (
    <div role="alert" className="rounded-2xl border border-brand-crisis/40 bg-brand-crisis/10 p-5">
      <p className="flex items-center gap-2 text-base font-bold text-brand-crisis">
        <i className="ri-alarm-warning-line" aria-hidden="true" /> Please reach a person right now
      </p>
      <p className="mt-2 text-sm leading-relaxed text-brand-ink/80">
        What you flagged can&rsquo;t wait, and you deserve real support immediately. You are not a burden, and you don&rsquo;t have to hold this alone.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <a href="tel:0800567567" className="btn-accent text-center">Call SADAG 0800 567 567 (24/7)</a>
        <a href="tel:0800121314" className="btn-secondary text-center">Suicide line 0800 12 13 14</a>
        <LinkButton href="/crisis" variant="ghost">All crisis lines</LinkButton>
      </div>
    </div>
  )
}

function UrgentBlock({ redFlags }: { redFlags: string[] }) {
  return (
    <div role="alert" className="rounded-2xl border border-brand-crisis/40 bg-brand-crisis/10 p-5">
      <p className="flex items-center gap-2 text-base font-bold text-brand-crisis">
        <i className="ri-first-aid-kit-line" aria-hidden="true" /> This may need urgent care
      </p>
      {redFlags.length > 0 && (
        <p className="mt-1 text-sm text-brand-ink/70">You flagged: {redFlags.join(', ')}.</p>
      )}
      <p className="mt-2 text-sm leading-relaxed text-brand-ink/80">
        Please seek urgent or emergency care now rather than waiting. If it&rsquo;s severe or getting worse, call your local emergency number.
      </p>
      <div className="mt-4">
        <LinkButton href="/crisis" variant="accent">Emergency & crisis numbers</LinkButton>
      </div>
    </div>
  )
}

const CATEGORY_TONE: Record<string, 'violet' | 'blue' | 'terracotta' | 'gold' | 'sage'> = {
  mental: 'violet', neurological: 'violet', infectious: 'blue', respiratory: 'blue', sleep: 'blue',
  disability: 'blue',
  pain: 'terracotta', musculoskeletal: 'terracotta', cardiovascular: 'terracotta', blood: 'terracotta',
  metabolic: 'gold', chronic: 'gold', autoimmune: 'sage', cancer: 'sage',
}

export default function SymptomCheckerPage() {
  const [step, setStep] = useState<Step>('emergency')
  const [flags, setFlags] = useState<EmergencyFlag[]>([])
  const [commonSymptoms, setCommonSymptoms] = useState<CommonSymptom[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [checkedFlags, setCheckedFlags] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Array<{ value: string; label: string }>>([])
  const [custom, setCustom] = useState('')
  const [note, setNote] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    DatabaseService.getSymptomCheckOptions()
      .then((res) => {
        const data = res as { emergency_flags?: EmergencyFlag[]; common_symptoms?: CommonSymptom[] }
        setFlags(Array.isArray(data?.emergency_flags) ? data.emergency_flags : [])
        setCommonSymptoms(Array.isArray(data?.common_symptoms) ? data.common_symptoms : [])
      })
      .catch((error) => console.error('Failed to load symptom-check options:', error))
      .finally(() => setLoadingOptions(false))
  }, [])

  const selectedValues = useMemo(() => new Set(selected.map((s) => s.value)), [selected])

  const toggleFlag = (id: string) =>
    setCheckedFlags((cur) => {
      const next = new Set(cur)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const toggleSymptom = (value: string, label: string) =>
    setSelected((cur) => (cur.some((s) => s.value === value) ? cur.filter((s) => s.value !== value) : [...cur, { value, label }]))
  const addCustom = () => {
    const label = custom.trim()
    if (label && !selected.some((s) => s.label.toLowerCase() === label.toLowerCase())) {
      setSelected((cur) => [...cur, { value: label, label }])
      setCustom('')
    }
  }

  const run = async (extra?: { flagsOnly?: boolean }) => {
    if (running) return
    setRunning(true)
    try {
      const res = await DatabaseService.getSymptomCheck({
        symptoms: extra?.flagsOnly ? [] : selected.map((s) => s.value),
        redFlags: [...checkedFlags],
        note: note.trim() || undefined,
      })
      setResult(res as Result)
      setStep('results')
    } catch (error) {
      console.error('Symptom check failed:', error)
    } finally {
      setRunning(false)
    }
  }

  const continueFromEmergency = () => {
    if (checkedFlags.size > 0) void run({ flagsOnly: true })
    else setStep('symptoms')
  }

  const reset = () => {
    setStep('emergency')
    setCheckedFlags(new Set())
    setSelected([])
    setNote('')
    setResult(null)
  }

  return (
    <PageFrame containerClassName="max-w-2xl">
      <div className="space-y-5">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink/45">Symptom check</p>
          <h1 className="text-2xl font-bold text-brand-ink sm:text-3xl">Let&rsquo;s make sense of it together</h1>
          <p className="max-w-xl text-sm leading-relaxed text-brand-ink/65">
            A guided way to organize what you&rsquo;re feeling, so you and a clinician can talk about it clearly.
            This is <span className="font-semibold text-brand-ink/80">not a diagnosis</span>.
          </p>
        </header>

        {/* STEP 1, emergency screen (safety first) */}
        {step === 'emergency' && (
          <Card className="space-y-4">
            <div>
              <CardTitle className="text-lg">First, a quick safety check</CardTitle>
              <p className="mt-1 text-sm text-brand-ink/65">Is any of this happening right now?</p>
            </div>
            {loadingOptions ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}</div>
            ) : (
              <div className="space-y-2">
                {flags.map((flag) => {
                  const checked = checkedFlags.has(flag.id)
                  return (
                    <button
                      key={flag.id}
                      type="button"
                      onClick={() => toggleFlag(flag.id)}
                      aria-pressed={checked}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                        checked ? 'border-brand-crisis/50 bg-brand-crisis/10 text-brand-ink' : 'border-brand-line bg-brand-ink/[0.03] text-brand-ink/80 hover:bg-brand-ink/[0.06]')}
                    >
                      <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', checked ? 'border-brand-crisis bg-brand-crisis text-white' : 'border-brand-line-strong')}>
                        {checked && <i className="ri-check-line text-xs" aria-hidden="true" />}
                      </span>
                      {flag.label}
                    </button>
                  )
                })}
              </div>
            )}
            <Button onClick={continueFromEmergency} disabled={loadingOptions || running} fullWidth>
              {checkedFlags.size > 0 ? 'Get help now' : 'None of these, continue'}
            </Button>
          </Card>
        )}

        {/* STEP 2, symptom selection */}
        {step === 'symptoms' && (
          <Card className="space-y-4">
            <div>
              <CardTitle className="text-lg">What are you feeling?</CardTitle>
              <p className="mt-1 text-sm text-brand-ink/65">Tap everything that fits. Add your own if it&rsquo;s not here.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {commonSymptoms.map((s) => {
                const active = selectedValues.has(s.slug)
                return (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => toggleSymptom(s.slug, s.name)}
                    aria-pressed={active}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/40',
                      active ? 'bg-brand-accent2 text-white' : 'bg-brand-ink/[0.06] text-brand-ink/75 hover:bg-brand-ink/[0.1]')}
                  >
                    {s.name}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2">
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
                placeholder="Add another symptom…"
                aria-label="Add another symptom"
                className="h-10"
              />
              <Button type="button" variant="secondary" onClick={addCustom} disabled={!custom.trim()}>Add</Button>
            </div>
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.map((s) => (
                  <Badge key={s.value} tone="gold">
                    {s.label}
                    <button type="button" onClick={() => toggleSymptom(s.value, s.label)} className="ml-1.5 text-brand-ink/50 hover:text-brand-ink" aria-label={`Remove ${s.label}`}>×</button>
                  </Badge>
                ))}
              </div>
            )}
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              aria-label="Anything else"
              placeholder="Anything else worth noting? (optional), when it started, how it feels…"
              className="resize-none"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => run()} disabled={running || selected.length === 0} fullWidth>
                {running ? 'Looking…' : 'See possibilities'}
              </Button>
              <Button variant="secondary" onClick={() => setStep('emergency')}>Back</Button>
            </div>
            <p className="text-xs text-brand-ink/45">Nothing here is saved or shared. It&rsquo;s just to help you think it through.</p>
          </Card>
        )}

        {/* STEP 3, results */}
        {step === 'results' && result && (
          <div className="space-y-4">
            {result.triage === 'crisis' && <CrisisBlock />}
            {result.triage === 'urgent' && <UrgentBlock redFlags={result.red_flags} />}

            {result.triage === 'see-clinician' && (
              <>
                {result.candidates.length > 0 ? (
                  <Card className="space-y-3">
                    <CardTitle className="text-lg">Where these patterns show up</CardTitle>
                    <p className="text-sm text-brand-ink/60">
                      Conditions where members commonly log the symptoms you picked. This is a starting point to explore, not a diagnosis.
                    </p>
                    <div className="space-y-2">
                      {result.candidates.map((c) => (
                        <Link
                          key={c.slug}
                          href={`/conditions/${c.slug}`}
                          className="card-hover block rounded-2xl border border-brand-line bg-brand-ink/[0.03] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-brand-ink">{c.name}</span>
                            {c.category && <Badge tone={CATEGORY_TONE[c.category] ?? 'sage'} className="capitalize">{c.category}</Badge>}
                          </div>
                          <p className="mt-1 text-xs text-brand-ink/55">
                            Matches {c.match_count} of your {c.total_reported}: {c.matched_symptoms.join(', ')}
                          </p>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-ink/[0.08]">
                            <div className="h-full rounded-full bg-brand-accent2" style={{ width: `${c.match_strength}%` }} />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </Card>
                ) : (
                  <Card>
                    <CardTitle className="text-lg">We couldn&rsquo;t match these &mdash; that doesn&rsquo;t mean they&rsquo;re nothing</CardTitle>
                    <p className="mt-1 text-sm text-brand-ink/65">
                      Not finding a studied condition says nothing about how serious this is. A clinician is the best next step, and if anything worsens, please seek care right away.
                    </p>
                  </Card>
                )}
              </>
            )}

            <Card className="space-y-2">
              <CardTitle className="text-base">Next steps</CardTitle>
              <ul className="space-y-1.5">
                {result.next_steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-brand-ink/75">
                    <i className="ri-arrow-right-s-line mt-0.5 shrink-0 text-brand-accent2" aria-hidden="true" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-2">
                <LinkButton href="/ask" variant="secondary" size="sm" leadingIcon={<i className="ri-questionnaire-line" aria-hidden="true" />}>Ask a question</LinkButton>
                <LinkButton href="/support" variant="secondary" size="sm" leadingIcon={<i className="ri-hand-heart-line" aria-hidden="true" />}>Talk to someone</LinkButton>
                <LinkButton href="/conditions" variant="ghost" size="sm">Browse conditions</LinkButton>
              </div>
            </Card>

            <p className="px-1 text-xs leading-relaxed text-brand-ink/45">{result.disclaimer}</p>
            <Button variant="secondary" onClick={reset} fullWidth>Start over</Button>
          </div>
        )}
      </div>

      <BottomNav />
    </PageFrame>
  )
}
