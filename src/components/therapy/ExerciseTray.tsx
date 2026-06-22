'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TherapyTheme } from '@/lib/therapy-config'

type Props = {
  theme: TherapyTheme
  onClose: () => void
  onComplete?: (note: string) => void
}

type View = 'menu' | 'breathing' | 'grounding' | 'thoughts'

const PHASE_MS = 4000
const BREATHING_PHASES = ['Breathe in', 'Hold', 'Breathe out', 'Hold'] as const
const CYCLES_FOR_REFLECTION = 4

const GROUNDING_STEPS = [
  { sense: 'see', count: 5, prompt: 'Name 5 things you can see', icon: 'ri-eye-line' },
  { sense: 'hear', count: 4, prompt: 'Name 4 things you can hear', icon: 'ri-ear-line' },
  { sense: 'touch', count: 3, prompt: 'Name 3 things you can touch', icon: 'ri-hand-heart-line' },
  { sense: 'smell', count: 2, prompt: 'Name 2 things you can smell', icon: 'ri-flower-line' },
  { sense: 'taste', count: 1, prompt: 'Name 1 thing you can taste', icon: 'ri-cup-line' },
] as const

export default function ExerciseTray({ theme, onClose, onComplete }: Props) {
  const [view, setView] = useState<View>('menu')

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const heading =
    view === 'breathing'
      ? 'Box breathing'
      : view === 'grounding'
        ? '5-4-3-2-1 grounding'
        : view === 'thoughts'
          ? 'Thought record'
          : 'Take a moment'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Guided self-help exercises"
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border p-6 shadow-2xl"
        style={{ background: theme.cardBackground, borderColor: 'rgba(238,223,200,0.16)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {view !== 'menu' && (
              <button
                type="button"
                onClick={() => setView('menu')}
                className="flex h-8 w-8 items-center justify-center rounded-full transition hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                style={{ background: theme.accentSoft, color: theme.accent }}
                aria-label="Back to exercises"
              >
                <i className="ri-arrow-left-line" aria-hidden="true" />
              </button>
            )}
            <h2 className="truncate text-lg font-semibold" style={{ color: theme.headingColor }}>
              {heading}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
            style={{ background: 'rgba(238,223,200,0.08)', color: theme.bodyColor }}
            aria-label="Close exercises"
          >
            <i className="ri-close-line text-xl" aria-hidden="true" />
          </button>
        </div>

        {view === 'menu' && <Menu theme={theme} onPick={setView} />}
        {view === 'breathing' && <Breathing theme={theme} />}
        {view === 'grounding' && <Grounding theme={theme} onComplete={onComplete} onClose={onClose} />}
        {view === 'thoughts' && <Thoughts theme={theme} onComplete={onComplete} onClose={onClose} />}
      </div>
    </div>
  )
}

// ── Menu ────────────────────────────────────────────────────────────

function Menu({ theme, onPick }: { theme: TherapyTheme; onPick: (view: View) => void }) {
  const cards: { id: Exclude<View, 'menu'>; icon: string; title: string; blurb: string }[] = [
    { id: 'breathing', icon: 'ri-lungs-line', title: 'Box breathing', blurb: 'Slow, paced 4-4-4-4 breaths to settle your body.' },
    { id: 'grounding', icon: 'ri-eye-line', title: '5-4-3-2-1 grounding', blurb: 'Use your senses to land back in the present.' },
    { id: 'thoughts', icon: 'ri-brain-line', title: 'Thought record', blurb: 'Gently work a hard thought into a kinder one.' },
  ]
  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: theme.bodyColor }}>
        Pick something small to do right now. There&apos;s no rush.
      </p>
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => onPick(card.id)}
          className="flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
          style={{ borderColor: 'rgba(238,223,200,0.12)', background: theme.accentSoft }}
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl"
            style={{ background: theme.accent, color: theme.userBubbleText }}
          >
            <i className={card.icon} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold" style={{ color: theme.headingColor }}>
              {card.title}
            </span>
            <span className="mt-0.5 block text-sm" style={{ color: theme.bodyColor }}>
              {card.blurb}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}

// ── Breathing ───────────────────────────────────────────────────────

function Breathing({ theme }: { theme: TherapyTheme }) {
  const [running, setRunning] = useState(false)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [cycles, setCycles] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!running) {
      clear()
      return
    }
    intervalRef.current = setInterval(() => {
      setPhaseIndex((current) => {
        const next = (current + 1) % BREATHING_PHASES.length
        if (next === 0) setCycles((value) => value + 1)
        return next
      })
    }, PHASE_MS)
    return clear
  }, [running, clear])

  useEffect(() => clear, [clear])

  function toggle() {
    if (running) {
      setRunning(false)
    } else {
      setPhaseIndex(0)
      setRunning(true)
    }
  }

  const phaseLabel = BREATHING_PHASES[phaseIndex]
  // Expanded on inhale (0) and the hold after it (1); contracted on exhale (2) and the hold after (3).
  const expanded = phaseIndex === 0 || phaseIndex === 1
  const scale = !running ? 0.7 : expanded ? 1 : 0.55

  return (
    <div className="flex flex-col items-center gap-5 py-2">
      <div className="relative flex h-56 w-56 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: theme.accent,
            opacity: 0.85,
            transform: `scale(${scale})`,
            transition: `transform ${PHASE_MS}ms ease-in-out, opacity ${PHASE_MS}ms ease-in-out`,
          }}
          aria-hidden="true"
        />
        <span
          className="relative text-center text-base font-semibold uppercase tracking-[0.18em]"
          style={{ color: theme.userBubbleText }}
        >
          {running ? phaseLabel : 'Ready'}
        </span>
      </div>

      <p aria-live="polite" className="text-center text-sm" style={{ color: theme.bodyColor }}>
        {running
          ? `${phaseLabel} · 4 seconds · cycle ${cycles + 1}`
          : 'In for 4, hold 4, out for 4, hold 4. Follow the circle.'}
      </p>

      {cycles >= CYCLES_FOR_REFLECTION && (
        <p className="text-center text-sm font-medium" style={{ color: theme.accent }}>
          Notice how your body feels now.
        </p>
      )}

      <button
        type="button"
        onClick={toggle}
        className="rounded-2xl px-6 py-3 text-sm font-semibold shadow-md transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
        style={{ background: theme.accent, color: theme.userBubbleText }}
        aria-pressed={running}
      >
        {running ? 'Pause' : 'Start'}
      </button>
    </div>
  )
}

// ── Grounding ───────────────────────────────────────────────────────

function Grounding({
  theme,
  onComplete,
  onClose,
}: {
  theme: TherapyTheme
  onComplete?: (note: string) => void
  onClose: () => void
}) {
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [answers, setAnswers] = useState<string[]>(() => GROUNDING_STEPS.map(() => ''))

  const total = GROUNDING_STEPS.length

  function handleAnswer(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value
    setAnswers((current) => current.map((answer, index) => (index === step ? value : answer)))
  }

  function next() {
    if (step < total - 1) {
      setStep((current) => current + 1)
    } else {
      setDone(true)
    }
  }

  function finish() {
    onComplete?.('Grounded with 5-4-3-2-1.')
    onClose()
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-5 py-4 text-center">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
          style={{ background: theme.accentSoft, color: theme.accent }}
        >
          <i className="ri-checkbox-circle-line" aria-hidden="true" />
        </span>
        <p className="text-lg font-semibold" style={{ color: theme.headingColor }}>
          Done, you&apos;re here, in this moment.
        </p>
        <button
          type="button"
          onClick={finish}
          className="rounded-2xl px-6 py-3 text-sm font-semibold shadow-md transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
          style={{ background: theme.accent, color: theme.userBubbleText }}
        >
          Finish
        </button>
      </div>
    )
  }

  const current = GROUNDING_STEPS[step]
  return (
    <div className="flex flex-col gap-4">
      <ProgressDots theme={theme} total={total} active={step} />
      <div className="flex items-center gap-2">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg"
          style={{ background: theme.accentSoft, color: theme.accent }}
        >
          <i className={current.icon} aria-hidden="true" />
        </span>
        <p className="text-base font-medium" style={{ color: theme.headingColor }}>
          {current.prompt}
        </p>
      </div>
      <input
        type="text"
        value={answers[step]}
        onChange={handleAnswer}
        placeholder="Type whatever comes to mind…"
        aria-label={current.prompt}
        className="w-full rounded-2xl border bg-transparent px-4 py-3 text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
        style={{ borderColor: 'rgba(238,223,200,0.2)', color: theme.headingColor }}
      />
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setStep((value) => Math.max(0, value - 1))}
          disabled={step === 0}
          className="rounded-2xl px-5 py-2.5 text-sm font-medium transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
          style={{ background: 'rgba(238,223,200,0.08)', color: theme.bodyColor }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={next}
          className="rounded-2xl px-6 py-2.5 text-sm font-semibold shadow-md transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
          style={{ background: theme.accent, color: theme.userBubbleText }}
        >
          {step === total - 1 ? 'Done' : 'Next'}
        </button>
      </div>
    </div>
  )
}

// ── Thoughts (mini CBT thought record) ───────────────────────────────

type ThoughtStep = 'situation' | 'hot' | 'belief-before' | 'reframe' | 'belief-after' | 'summary'

const THOUGHT_ORDER: ThoughtStep[] = ['situation', 'hot', 'belief-before', 'reframe', 'belief-after', 'summary']

function Thoughts({
  theme,
  onComplete,
  onClose,
}: {
  theme: TherapyTheme
  onComplete?: (note: string) => void
  onClose: () => void
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const [situation, setSituation] = useState('')
  const [hotThought, setHotThought] = useState('')
  const [beliefBefore, setBeliefBefore] = useState(70)
  const [reframe, setReframe] = useState('')
  const [beliefAfter, setBeliefAfter] = useState(40)

  const step = THOUGHT_ORDER[stepIndex]

  function next() {
    setStepIndex((current) => Math.min(THOUGHT_ORDER.length - 1, current + 1))
  }

  function back() {
    setStepIndex((current) => Math.max(0, current - 1))
  }

  function finish() {
    onComplete?.(`Worked a thought through: belief ${beliefBefore}→${beliefAfter}.`)
    onClose()
  }

  if (step === 'summary') {
    const drop = beliefBefore - beliefAfter
    const summary =
      drop > 0
        ? `${beliefBefore} → ${beliefAfter}, that's a real shift.`
        : drop === 0
          ? `${beliefBefore} → ${beliefAfter}, steady for now, and that's okay.`
          : `${beliefBefore} → ${beliefAfter}, it grew, and naming it is still worth something.`
    return (
      <div className="flex flex-col items-center gap-5 py-4 text-center">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
          style={{ background: theme.accentSoft, color: theme.accent }}
        >
          <i className="ri-sparkling-2-line" aria-hidden="true" />
        </span>
        <p className="text-lg font-semibold" style={{ color: theme.headingColor }}>
          {summary}
        </p>
        <p className="text-sm" style={{ color: theme.bodyColor }}>
          Thoughts aren&apos;t facts. You just gave this one a second look.
        </p>
        <button
          type="button"
          onClick={finish}
          className="rounded-2xl px-6 py-3 text-sm font-semibold shadow-md transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
          style={{ background: theme.accent, color: theme.userBubbleText }}
        >
          Finish
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ProgressDots theme={theme} total={THOUGHT_ORDER.length - 1} active={stepIndex} />

      {step === 'situation' && (
        <ThoughtTextarea
          theme={theme}
          label="What happened?"
          value={situation}
          onChange={setSituation}
          placeholder="The moment or trigger, in a sentence or two."
        />
      )}
      {step === 'hot' && (
        <ThoughtTextarea
          theme={theme}
          label="The hot thought"
          value={hotThought}
          onChange={setHotThought}
          placeholder="The thought that stings most right now."
        />
      )}
      {step === 'belief-before' && (
        <BeliefSlider
          theme={theme}
          label="How strongly do you believe it?"
          value={beliefBefore}
          onChange={setBeliefBefore}
        />
      )}
      {step === 'reframe' && (
        <ThoughtTextarea
          theme={theme}
          label="A kinder / more balanced way to see it"
          value={reframe}
          onChange={setReframe}
          placeholder="What might you tell a friend in this exact spot?"
        />
      )}
      {step === 'belief-after' && (
        <BeliefSlider
          theme={theme}
          label="Now, how strongly do you believe the hot thought?"
          value={beliefAfter}
          onChange={setBeliefAfter}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={back}
          disabled={stepIndex === 0}
          className="rounded-2xl px-5 py-2.5 text-sm font-medium transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
          style={{ background: 'rgba(238,223,200,0.08)', color: theme.bodyColor }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={next}
          className="rounded-2xl px-6 py-2.5 text-sm font-semibold shadow-md transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
          style={{ background: theme.accent, color: theme.userBubbleText }}
        >
          {step === 'belief-after' ? 'See the shift' : 'Next'}
        </button>
      </div>
    </div>
  )
}

// ── Shared sub-pieces ────────────────────────────────────────────────

function ProgressDots({ theme, total, active }: { theme: TherapyTheme; total: number; active: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
      {Array.from({ length: total }).map((_, index) => (
        <span
          key={index}
          className="h-1.5 rounded-full transition-all"
          style={{
            width: index === active ? 20 : 8,
            background: index <= active ? theme.accent : 'rgba(238,223,200,0.2)',
          }}
        />
      ))}
    </div>
  )
}

function ThoughtTextarea({
  theme,
  label,
  value,
  onChange,
  placeholder,
}: {
  theme: TherapyTheme
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-base font-medium" style={{ color: theme.headingColor }}>
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-none rounded-2xl border bg-transparent px-4 py-3 text-[15px] leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
        style={{ borderColor: 'rgba(238,223,200,0.2)', color: theme.headingColor }}
      />
    </label>
  )
}

function BeliefSlider({
  theme,
  label,
  value,
  onChange,
}: {
  theme: TherapyTheme
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-base font-medium" style={{ color: theme.headingColor }}>
          {label}
        </span>
        <span className="text-2xl font-bold tabular-nums" style={{ color: theme.accent }}>
          {value}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))}
        aria-label={label}
        aria-valuetext={`${value} out of 100`}
        className="w-full cursor-pointer"
        style={{ accentColor: theme.accent }}
      />
      <div className="flex justify-between text-[11px]" style={{ color: theme.mutedColor }}>
        <span>Not at all</span>
        <span>Completely</span>
      </div>
    </div>
  )
}
