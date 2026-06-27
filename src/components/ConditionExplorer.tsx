'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { DatabaseService } from '@/lib/database'
import { formatCompactNumber } from '@/lib/platform'
import { cn } from '@/lib/cn'
import { Badge, Card, LinkButton, Skeleton } from '@/components/ui'

// ── Types (the live, anonymous data the explorer reads) ─────────────────────
type Condition = {
  id: string
  name: string
  category?: string | null
  aliases?: string[] | null
  summary?: string | null
  description?: string | null
  activity_count?: number
}
type Treatment = { name: string; effectiveness: number; slug: string; reportCount: number }
type FeaturedBundle = { condition: Condition; treatments: Treatment[] }

// ── Category → colour (the connective tissue across the page) ────────────────
const CATEGORY_VAR: Record<string, string> = {
  mental: 'var(--accent-4)',
  neurological: 'var(--accent-4)',
  infectious: 'var(--accent-5)',
  respiratory: 'var(--accent-5)',
  sleep: 'var(--accent-5)',
  disability: 'var(--accent-5)',
  pain: 'var(--accent-1)',
  musculoskeletal: 'var(--accent-1)',
  cardiovascular: 'var(--accent-1)',
  blood: 'var(--accent-1)',
  metabolic: 'var(--accent-2)',
  chronic: 'var(--accent-2)',
  autoimmune: 'var(--accent-3)',
  cancer: 'var(--accent-3)',
}
const categoryColorVar = (category?: string | null): string =>
  CATEGORY_VAR[String(category ?? '').toLowerCase()] ?? 'var(--accent-3)'

type BadgeTone = 'violet' | 'blue' | 'terracotta' | 'gold' | 'sage'
const CATEGORY_TONE: Record<string, BadgeTone> = {
  mental: 'violet',
  neurological: 'violet',
  infectious: 'blue',
  respiratory: 'blue',
  sleep: 'blue',
  disability: 'blue',
  pain: 'terracotta',
  musculoskeletal: 'terracotta',
  cardiovascular: 'terracotta',
  blood: 'terracotta',
  metabolic: 'gold',
  chronic: 'gold',
  autoimmune: 'sage',
  cancer: 'sage',
}
const categoryTone = (category?: string | null): BadgeTone =>
  CATEGORY_TONE[String(category ?? '').toLowerCase()] ?? 'sage'

// Seed chips: deliberately mix mental-health staples with African/SA-prevalent
// conditions so a visitor sees on first glance this isn't a Western-only app.
const SEED_CHIPS = ['Depression', 'HIV', 'Migraine', 'IBS', 'Sickle cell']

const ROTATION_MS = 5000

// ── Reduced-motion (respects OS setting + the app's stored preference) ───────
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const read = () =>
      setReduced(mq.matches || document.documentElement.dataset.reducedMotion === 'true')
    read()
    mq.addEventListener('change', read)
    return () => mq.removeEventListener('change', read)
  }, [])
  return reduced
}

// ── Effectiveness meter (grows from 0 on mount, re-tweens on change) ─────────
function EffectivenessMeter({ value, color, reduced }: { value: number; color: string; reduced: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  const [width, setWidth] = useState(reduced ? pct : 0)
  useEffect(() => {
    if (reduced) {
      setWidth(pct)
      return
    }
    const id = requestAnimationFrame(() => setWidth(pct))
    return () => cancelAnimationFrame(id)
  }, [pct, reduced])
  return (
    <div
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 effectiveness`}
      className="h-2 w-full overflow-hidden rounded-full bg-brand-ink/[0.08]"
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${width}%`, background: color, transition: reduced ? undefined : 'width 480ms ease-out' }}
      />
    </div>
  )
}

function normalizeTreatments(raw: unknown): Treatment[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      const row = entry as Record<string, unknown>
      const treatment = (row.treatment ?? {}) as Record<string, unknown>
      const name = String(treatment.name ?? row.name ?? '').trim()
      const slug = String(treatment.slug ?? row.treatment_slug ?? row.slug ?? '')
      const effectiveness = Number(row.effectiveness_avg ?? row.effectivenessAvg ?? 0)
      const reportCount = Number(
        row.effectiveness_count ?? row.effectivenessCount ?? row.report_count ?? row.reportCount ?? 0,
      )
      return { name, slug, effectiveness, reportCount: Number.isFinite(reportCount) ? reportCount : 0 }
    })
    .filter((t) => t.name.length > 0)
    .slice(0, 3)
}

/**
 * Cochrane-style confidence read on a treatment's evidence, derived purely from
 * the member-report sample size — mirrors studyConfidenceLabel on the detail page
 * so the public preview and the full study agree. `dots` (0-3) drives a tiny
 * strength meter; count 0 means a clinical baseline with no member reports yet.
 */
function evidenceMeta(count: number): { label: string; dots: number } {
  if (count <= 0) return { label: 'Clinical baseline', dots: 0 }
  if (count >= 20) return { label: 'Well reported', dots: 3 }
  if (count >= 5) return { label: 'Growing signal', dots: 2 }
  return { label: 'Early signal', dots: 1 }
}

/**
 * The live "what actually works" condition explorer, type a condition, see its
 * real top treatments ranked by effectiveness, no account needed. Lifted off the
 * landing page so it can be the hero of the dedicated /conditions page.
 */
export default function ConditionExplorer() {
  const reduced = useReducedMotion()

  const [conditions, setConditions] = useState<Condition[]>([])
  const [featured, setFeatured] = useState<FeaturedBundle[]>([])
  const [dataState, setDataState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [rotIndex, setRotIndex] = useState(0)
  const [onDemand, setOnDemand] = useState<Record<string, Treatment[]>>({})

  const inlineInputRef = useRef<HTMLInputElement | null>(null)

  // Fetch the live, anonymous data (never blocks first paint, shell renders first).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [insightsRaw, condsRaw] = await Promise.all([
          DatabaseService.getFeaturedInsights(6),
          DatabaseService.getConditions(),
        ])
        if (cancelled) return
        const conds = (Array.isArray(condsRaw) ? condsRaw : []) as Condition[]
        const bundles: FeaturedBundle[] = (Array.isArray(insightsRaw) ? insightsRaw : [])
          .map((entry) => {
            const e = entry as Record<string, unknown>
            const condition = (e.condition ?? {}) as Condition
            const treatments = normalizeTreatments(e.top_treatments ?? e.topTreatments)
            return { condition, treatments }
          })
          .filter((b) => b.condition && b.condition.id)
        setConditions(conds)
        setFeatured(bundles)
        setDataState('ready')
      } catch {
        if (!cancelled) setDataState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Desktop-only autofocus of the inline input (never pop a mobile keyboard).
  useEffect(() => {
    if (dataState !== 'ready') return
    if (typeof window === 'undefined') return
    if (window.matchMedia('(min-width: 1024px)').matches) inlineInputRef.current?.focus()
  }, [dataState])

  // Empty-query "breathing" rotation through the featured conditions.
  useEffect(() => {
    if (reduced || query.trim() || focused || featured.length < 2) return
    const id = setInterval(() => setRotIndex((i) => (i + 1) % featured.length), ROTATION_MS)
    return () => clearInterval(id)
  }, [reduced, query, focused, featured.length])

  const trimmed = query.trim().toLowerCase()

  // Fuzzy match over the conditions payload (reuses the directory's haystack).
  const matched = useMemo(() => {
    if (!trimmed) return null
    return (
      conditions.find((c) => {
        const aliases = Array.isArray(c.aliases) ? c.aliases.join(' ') : ''
        const haystack = `${c.name} ${aliases} ${c.summary ?? c.description ?? ''}`.toLowerCase()
        return haystack.includes(trimmed)
      }) ?? null
    )
  }, [trimmed, conditions])

  const featuredById = useMemo(() => {
    const map = new Map<string, FeaturedBundle>()
    for (const b of featured) map.set(b.condition.id, b)
    return map
  }, [featured])

  // Which condition is in the answer card right now.
  const activeCondition: Condition | null = trimmed
    ? matched
    : featured[rotIndex]?.condition ?? null

  // Its treatments: from the featured bundle, else fetched on demand.
  const activeTreatments: Treatment[] | undefined = activeCondition
    ? featuredById.get(activeCondition.id)?.treatments ?? onDemand[activeCondition.id]
    : undefined

  // Fetch treatments on demand for a matched condition not in the featured set.
  useEffect(() => {
    if (!activeCondition) return
    if (featuredById.has(activeCondition.id) || onDemand[activeCondition.id]) return
    let cancelled = false
    const id = activeCondition.id
    ;(async () => {
      try {
        const raw = await DatabaseService.getTopTreatments(id, 3)
        if (!cancelled) setOnDemand((prev) => ({ ...prev, [id]: normalizeTreatments(raw) }))
      } catch {
        if (!cancelled) setOnDemand((prev) => ({ ...prev, [id]: [] }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeCondition, featuredById, onDemand])

  const closestNames = useMemo(() => {
    if (!trimmed || matched) return []
    const head = trimmed.slice(0, 3)
    return conditions
      .filter((c) => c.name.toLowerCase().includes(head))
      .slice(0, 3)
      .map((c) => c.name)
  }, [trimmed, matched, conditions])

  const totalActivity = useMemo(
    () => featured.reduce((sum, b) => sum + Number(b.condition.activity_count ?? 0), 0),
    [featured])

  const pickCondition = useCallback((name: string) => setQuery(name), [])

  const inlineWidthCh = Math.max(6, Math.min(18, query.length || 7))
  const noMatch = Boolean(trimmed) && !matched

  return (
    <div className="space-y-10">
      {/* THE PROMPT + LIVE ANSWER */}
      <section className="relative">
        <div
          aria-hidden="true"
          className="breathing-gradient pointer-events-none absolute right-[6%] top-0 h-[360px] w-[360px] rounded-full bg-brand-accent2 opacity-[0.06] blur-[120px]"
        />
        <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[1.1fr_22rem]">
          {/* Left, the prompt */}
          <div className="text-center lg:text-left">
            <span className="eyebrow inline-flex items-center gap-2">
              <i className="ri-shield-check-line text-brand-accent3" aria-hidden="true" />
              Evidence-based · refined by member reports
            </span>

            <h1 className="mt-4 text-3xl font-black leading-[1.08] tracking-tight text-brand-ink sm:text-4xl">
              What actually works for{' '}
              <span className="relative hidden align-baseline lg:inline-flex">
                <input
                  ref={inlineInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  aria-label="Type a condition to see what helps"
                  placeholder="migraine"
                  autoComplete="off"
                  spellCheck={false}
                  style={{ width: `${inlineWidthCh}ch` }}
                  className="border-0 border-b-2 border-brand-accent2 bg-transparent font-black text-brand-ink caret-brand-accent2 placeholder:text-brand-ink/40 focus:border-brand-accent2 focus:outline-none"
                />
              </span>
              <span className="lg:hidden">your health</span>
              <span className="text-brand-ink">?</span>
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-brand-ink/70 lg:mx-0">
              Type a condition or disability. See the real top treatments, ranked by effectiveness, right now, no account
              needed.
            </p>

            {/* Mobile search field (the inline input is desktop-only) */}
            <div className="mt-5 lg:hidden">
              <label htmlFor="condition-explorer-search" className="sr-only">
                Search conditions
              </label>
              <div className="relative">
                <i
                  className="ri-search-line pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-ink/40"
                  aria-hidden="true"
                />
                <input
                  id="condition-explorer-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="Search a condition or disability..."
                  autoComplete="off"
                  className="input-field h-12 w-full pl-11"
                />
              </div>
            </div>

            {/* Try chips, proof of breadth (mental + African/SA conditions) */}
            <div className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
              {SEED_CHIPS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => pickCondition(label)}
                  className="card-hover rounded-full bg-brand-surface-strong px-3 py-1.5 text-sm text-brand-ink/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/40"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Escape hatch for visitors who can't name their condition */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm lg:justify-start">
              <span className="text-brand-ink/55">Not sure where to start?</span>
              <Link href="/symptom-checker" className="inline-flex items-center gap-1.5 text-brand-accent3 hover:underline">
                <i className="ri-stethoscope-line" aria-hidden="true" /> Check a symptom
              </Link>
              <Link href="/therapy" className="inline-flex items-center gap-1.5 text-brand-accent4 hover:underline">
                <i className="ri-message-3-line" aria-hidden="true" /> Talk to the AI guide
              </Link>
            </div>
          </div>

          {/* Right, the live answer card (the proof) */}
          <div className="lg:w-full">
            <AnswerCard
              state={dataState}
              condition={activeCondition}
              treatments={activeTreatments}
              reduced={reduced}
              noMatch={noMatch}
              closestNames={closestNames}
              onPick={pickCondition}
              totalConditions={conditions.length}
            />
          </div>
        </div>
      </section>

      {/* HOW WE RANK, the honesty section */}
      <section className="rounded-3xl border border-brand-line bg-brand-surface-raised px-5 py-8 sm:px-8">
        <h2 className="text-xl font-bold text-brand-ink sm:text-2xl">How we rank what works</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { icon: 'ri-microscope-line', tint: 'tint-sage', title: 'Evidence first', body: 'We start from systematic reviews and clinical evidence, the Cochrane-style baseline.' },
            { icon: 'ri-team-line', tint: 'tint-gold', title: 'Refined by members', body: 'Real people report what helped and what didn’t, like StuffThatWorks, but honestly labelled.' },
            { icon: 'ri-links-line', tint: 'tint-violet', title: 'Always shows its work', body: 'Every ranking links to its full study page with side-effects, triggers, and diagnostic-test profiles.' },
          ].map((card) => (
            <Card key={card.title}>
              <div className={cn('icon-chip mb-3', card.tint)}>
                <i className={card.icon} aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-brand-ink">{card.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-brand-ink/65">{card.body}</p>
            </Card>
          ))}
        </div>
        <p className="mt-5 text-sm text-brand-ink/55">
          Information, not medical advice. Always talk to a clinician.
        </p>
        {totalActivity > 0 && (
          <p className="mt-2 text-sm text-brand-ink/60">
            <span className="stat-figure">{formatCompactNumber(totalActivity)}</span> member reports and counting
          </p>
        )}
      </section>
    </div>
  )
}

// ── The live answer card ────────────────────────────────────────────────────
function AnswerCard({
  state,
  condition,
  treatments,
  reduced,
  noMatch,
  closestNames,
  onPick,
  totalConditions,
}: {
  state: 'loading' | 'ready' | 'error'
  condition: Condition | null
  treatments: Treatment[] | undefined
  reduced: boolean
  noMatch: boolean
  closestNames: string[]
  onPick: (name: string) => void
  totalConditions: number
}) {
  if (state === 'error') {
    return (
      <Card className="safe-glass">
        <p className="text-sm text-brand-ink/70">
          We couldn&rsquo;t load the live studies just now.
        </p>
      </Card>
    )
  }

  if (noMatch) {
    return (
      <Card className="safe-glass">
        <p className="text-sm font-semibold text-brand-ink">We do not have a public study for that yet.</p>
        {closestNames.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-brand-ink/55">Did you mean:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {closestNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onPick(name)}
                  className="rounded-full bg-brand-surface-strong px-3 py-1.5 text-sm text-brand-ink/80 card-hover"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="mt-4 text-xs text-brand-ink/55">Scroll down to browse the full directory.</p>
      </Card>
    )
  }

  if (state !== 'ready' || !condition) {
    return (
      <Card className="safe-glass">
        <Skeleton className="h-5 w-32" />
        <div className="mt-5 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-6 h-10 w-full rounded-full" />
      </Card>
    )
  }

  const color = categoryColorVar(condition.category)
  const rows = treatments
  const studyCountLabel =
    totalConditions > 0 ? `${formatCompactNumber(totalConditions)} condition and disability studies` : 'condition and disability studies'

  return (
    <Card className="safe-glass">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-brand-ink">{condition.name}</h2>
        {condition.category && (
          <Badge tone={categoryTone(condition.category)} className="capitalize">
            {condition.category}
          </Badge>
        )}
      </div>

      {rows === undefined ? (
        <div className="mt-5 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-brand-ink/55">No ranked treatments yet, open the full study.</p>
      ) : (
        <ol className="mt-5 space-y-4">
          {rows.map((t, i) => {
            const ev = evidenceMeta(t.reportCount)
            return (
              <li key={t.slug || t.name}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-bold text-brand-accent2">#{i + 1}</span>
                    <span className="truncate text-brand-ink">{t.name}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-brand-accent2">{t.effectiveness.toFixed(1)}/5</span>
                </div>
                <div className="mt-1.5">
                  <EffectivenessMeter value={t.effectiveness} color={color} reduced={reduced} />
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-brand-ink/50">
                  <span className="inline-flex gap-0.5" aria-hidden="true">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className={`h-1 w-1 rounded-full ${d < ev.dots ? 'bg-brand-accent2' : 'bg-brand-ink/20'}`}
                      />
                    ))}
                  </span>
                  <span>
                    {ev.label}
                    {t.reportCount > 0 ? ` · ${t.reportCount} ${t.reportCount === 1 ? 'report' : 'reports'}` : ''}
                  </span>
                </p>
              </li>
            )
          })}
        </ol>
      )}

      <LinkButton href={`/conditions/${condition.id}`} variant="accent" fullWidth className="mt-6">
        See the full evidence page →
      </LinkButton>
      <p className="mt-2 text-xs text-brand-ink/50">
        Live from {studyCountLabel} · evidence-based, refined by member reports · not medical advice.
      </p>
    </Card>
  )
}
