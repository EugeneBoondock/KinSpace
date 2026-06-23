'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import PageFrame from '@/components/PageFrame'
import BottomNav from '@/components/BottomNav'
import { Card } from '@/components/ui'
import { AmbientEngine, type AmbientPreset } from '@/lib/audio/ambient'

type Phase = { label: string; seconds: number; expand: boolean }
type Exercise = {
  id: string
  title: string
  blurb: string
  icon: string
  kind: 'breathing' | 'grounding'
  phases?: Phase[]
}

const EXERCISES: Exercise[] = [
  {
    id: 'box',
    title: 'Box breathing',
    blurb: 'In 4, hold 4, out 4, hold 4. Steadies a racing body.',
    icon: 'ri-square-line',
    kind: 'breathing',
    phases: [
      { label: 'Breathe in', seconds: 4, expand: true },
      { label: 'Hold', seconds: 4, expand: true },
      { label: 'Breathe out', seconds: 4, expand: false },
      { label: 'Hold', seconds: 4, expand: false },
    ],
  },
  {
    id: '478',
    title: '4-7-8 breathing',
    blurb: 'In 4, hold 7, out 8. Eases you toward calm or sleep.',
    icon: 'ri-moon-line',
    kind: 'breathing',
    phases: [
      { label: 'Breathe in', seconds: 4, expand: true },
      { label: 'Hold', seconds: 7, expand: true },
      { label: 'Breathe out', seconds: 8, expand: false },
    ],
  },
  {
    id: 'grounding',
    title: '5-4-3-2-1 grounding',
    blurb: 'Use your senses to land back in the present.',
    icon: 'ri-eye-line',
    kind: 'grounding',
  },
]

const GROUNDING_STEPS = [
  { n: 5, sense: 'see', prompt: 'Name 5 things you can see right now.' },
  { n: 4, sense: 'feel', prompt: 'Notice 4 things you can feel or touch.' },
  { n: 3, sense: 'hear', prompt: 'Listen for 3 things you can hear.' },
  { n: 2, sense: 'smell', prompt: 'Find 2 things you can smell.' },
  { n: 1, sense: 'taste', prompt: 'Notice 1 thing you can taste.' },
]

const SOUNDS: Array<{ id: AmbientPreset | 'off'; label: string; icon: string }> = [
  { id: 'off', label: 'Silent', icon: 'ri-volume-mute-line' },
  { id: 'ocean', label: 'Ocean', icon: 'ri-water-flash-line' },
  { id: 'forest', label: 'Forest', icon: 'ri-leaf-line' },
  { id: 'rain', label: 'Rain', icon: 'ri-drizzle-line' },
  { id: 'wind', label: 'Wind', icon: 'ri-windy-line' },
]

function Breathing({ phases }: { phases: Phase[] }) {
  const [running, setRunning] = useState(false)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(phases[0].seconds)
  const [cycles, setCycles] = useState(0)

  useEffect(() => {
    // Reset when the exercise (phase set) changes.
    setRunning(false)
    setPhaseIndex(0)
    setSecondsLeft(phases[0].seconds)
    setCycles(0)
  }, [phases])

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current > 1) return current - 1
        setPhaseIndex((index) => {
          const next = (index + 1) % phases.length
          if (next === 0) setCycles((c) => c + 1)
          setSecondsLeft(phases[next].seconds)
          return next
        })
        return phases[(phaseIndex + 1) % phases.length].seconds
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [running, phaseIndex, phases])

  const phase = phases[phaseIndex]
  const scale = !running ? 0.72 : phase.expand ? 1 : 0.5

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="relative flex h-64 w-64 items-center justify-center">
        <div
          className="absolute h-64 w-64 rounded-full bg-gradient-to-br from-brand-accent2/30 via-brand-accent3/25 to-brand-accent5/25"
          style={{
            transform: `scale(${scale})`,
            transition: `transform ${running ? phase.seconds : 0.6}s ease-in-out`,
          }}
        />
        <div className="relative text-center">
          <p className="text-xl font-bold text-brand-background">{running ? phase.label : 'Ready'}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-brand-accent2">{running ? secondsLeft : ''}</p>
        </div>
      </div>
      <p className="text-center text-sm text-brand-background/60">
        {running ? `Cycle ${cycles + 1}` : 'Follow the circle. Let your breath match it.'}
      </p>
      <button
        type="button"
        onClick={() => setRunning((value) => !value)}
        className="rounded-2xl bg-brand-accent2 px-7 py-3 text-sm font-semibold text-white shadow-md transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent2/40"
      >
        {running ? 'Pause' : 'Begin'}
      </button>
    </div>
  )
}

function Grounding() {
  const [step, setStep] = useState(0)
  const done = step >= GROUNDING_STEPS.length
  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-accent3/15 text-brand-accent3">
          <i className="ri-checkbox-circle-line text-2xl" aria-hidden="true" />
        </div>
        <p className="text-lg font-bold text-brand-background">You are here, in this moment</p>
        <p className="max-w-sm text-sm text-brand-background/60">That is grounding. Come back any time you need to land.</p>
        <button
          type="button"
          onClick={() => setStep(0)}
          className="rounded-2xl bg-brand-accent2 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-transform hover:scale-[1.03]"
        >
          Again
        </button>
      </div>
    )
  }
  const current = GROUNDING_STEPS[step]
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-accent2/12 text-4xl font-bold text-brand-accent2">
        {current.n}
      </div>
      <p className="max-w-sm text-lg font-semibold text-brand-background">{current.prompt}</p>
      <p className="text-xs uppercase tracking-[0.18em] text-brand-background/45">Sense of {current.sense}</p>
      <button
        type="button"
        onClick={() => setStep((value) => value + 1)}
        className="rounded-2xl bg-brand-accent2 px-7 py-3 text-sm font-semibold text-white shadow-md transition-transform hover:scale-[1.03]"
      >
        {step === GROUNDING_STEPS.length - 1 ? 'Finish' : 'Next'}
      </button>
    </div>
  )
}

export default function MindfulnessPage() {
  const [activeId, setActiveId] = useState('box')
  const [sound, setSound] = useState<AmbientPreset | 'off'>('off')
  const engineRef = useRef<AmbientEngine | null>(null)

  const active = useMemo(() => EXERCISES.find((exercise) => exercise.id === activeId) ?? EXERCISES[0], [activeId])

  useEffect(() => {
    return () => {
      engineRef.current?.stop()
      engineRef.current = null
    }
  }, [])

  async function selectSound(next: AmbientPreset | 'off') {
    setSound(next)
    if (!engineRef.current) engineRef.current = new AmbientEngine()
    const engine = engineRef.current
    if (next === 'off') {
      engine.stop()
      return
    }
    if (engine.isPlaying) engine.setPreset(next, 0.85)
    else await engine.start(next, 0.85)
  }

  return (
    <PageFrame>
      <div className="page-grid space-y-6">
        <header className="space-y-2">
          <p className="eyebrow">Mindfulness</p>
          <h1 className="text-2xl font-bold text-brand-background sm:text-3xl">A moment to breathe</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-brand-background/60">
            Short, guided exercises for the hard moments. No account needed, no rush. Pick a soundscape and begin.
          </p>
        </header>

        <Card className="space-y-3">
          <p className="text-sm font-semibold text-brand-background">Soundscape</p>
          <div className="flex flex-wrap gap-2">
            {SOUNDS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => selectSound(option.id)}
                aria-pressed={sound === option.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  sound === option.id
                    ? 'bg-brand-accent2 text-white'
                    : 'bg-brand-background/[0.06] text-brand-background/65 hover:bg-brand-background/10'
                }`}
              >
                <i className={option.icon} aria-hidden="true" /> {option.label}
              </button>
            ))}
          </div>
        </Card>

        <div className="flex flex-wrap gap-2">
          {EXERCISES.map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              onClick={() => setActiveId(exercise.id)}
              aria-pressed={activeId === exercise.id}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeId === exercise.id
                  ? 'bg-brand-background/20 text-brand-background'
                  : 'bg-brand-background/[0.06] text-brand-background/60 hover:bg-brand-background/10'
              }`}
            >
              <i className={exercise.icon} aria-hidden="true" /> {exercise.title}
            </button>
          ))}
        </div>

        <Card>
          <p className="text-center text-sm text-brand-background/60">{active.blurb}</p>
          {active.kind === 'breathing' && active.phases ? <Breathing phases={active.phases} /> : <Grounding />}
        </Card>

        <p className="text-center text-xs text-brand-background/45">
          A calm few minutes can help, and it is not a substitute for care. If you are in crisis, reach out now.
        </p>
      </div>
      <BottomNav />
    </PageFrame>
  )
}
