'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'

type Difficulty = 'easy' | 'medium' | 'hard'
type Status = 'idle' | 'showing' | 'input' | 'lost'

const SPEEDS: Record<Difficulty, number> = { easy: 720, medium: 520, hard: 340 }

const PADS = [
  { id: 0, base: 'bg-[#6B8A83]/25', lit: 'bg-[#6B8A83]' },
  { id: 1, base: 'bg-[#D19A58]/25', lit: 'bg-[#D19A58]' },
  { id: 2, base: 'bg-[#B85C3A]/25', lit: 'bg-[#B85C3A]' },
  { id: 3, base: 'bg-[#eedfc8]/15', lit: 'bg-[#eedfc8]' },
] as const

function randomPad(): number {
  return Math.floor(Math.random() * 4)
}

export default function SimonPage() {
  const params = useSearchParams()
  const difficulty = (params.get('difficulty') as Difficulty | null) ?? 'medium'
  const { user } = useAuth()

  const [sequence, setSequence] = useState<number[]>([])
  const [step, setStep] = useState(0)
  const [active, setActive] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [best, setBest] = useState(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('kinspace:simon:best') : null
      if (stored) setBest(Number.parseInt(stored, 10) || 0)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id))
    timersRef.current = []
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  const playSequence = useCallback(
    (full: number[]) => {
      clearTimers()
      setStatus('showing')
      const speed = SPEEDS[difficulty]
      full.forEach((pad, index) => {
        timersRef.current.push(
          setTimeout(() => setActive(pad), index * speed + 120),
        )
        timersRef.current.push(
          setTimeout(() => setActive(null), index * speed + speed * 0.6),
        )
      })
      timersRef.current.push(
        setTimeout(() => {
          setStatus('input')
          setStep(0)
        }, full.length * speed + 200),
      )
    },
    [clearTimers, difficulty],
  )

  const startGame = useCallback(() => {
    const first = [randomPad()]
    setSequence(first)
    setStep(0)
    playSequence(first)
  }, [playSequence])

  const round = sequence.length

  function recordBest(reached: number) {
    if (reached <= best) return
    setBest(reached)
    if (typeof window !== 'undefined') localStorage.setItem('kinspace:simon:best', String(reached))
    if (user) DatabaseService.recordGameScore(user.userId, 'simon', reached).catch(() => undefined)
  }

  function handlePad(pad: number) {
    if (status !== 'input') return
    setActive(pad)
    timersRef.current.push(setTimeout(() => setActive(null), 200))

    if (pad !== sequence[step]) {
      recordBest(round - 1)
      setStatus('lost')
      return
    }

    if (step + 1 === sequence.length) {
      recordBest(round)
      const next = [...sequence, randomPad()]
      setSequence(next)
      timersRef.current.push(setTimeout(() => playSequence(next), 700))
    } else {
      setStep((value) => value + 1)
    }
  }

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <Link href="/games" className="text-sm text-[#D19A58]">
            ← Back to games
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/45">
                Simon · {difficulty}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Simon</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Watch the colours light up, then tap them back in order. Each round adds one.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">Round {round}</span>
              <span className="badge bg-[#D19A58]/15 text-[#D19A58]">Best {best}</span>
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center gap-5">
          <div className="grid grid-cols-2 gap-3">
            {PADS.map((pad) => {
              const isActive = active === pad.id
              return (
                <button
                  key={pad.id}
                  onClick={() => handlePad(pad.id)}
                  disabled={status !== 'input'}
                  className={`h-28 w-28 rounded-2xl transition-all sm:h-32 sm:w-32 ${
                    isActive ? pad.lit : pad.base
                  } ${status === 'input' ? 'cursor-pointer hover:opacity-90' : 'cursor-default'}`}
                  aria-label={`pad-${pad.id}`}
                />
              )
            })}
          </div>

          <p className="text-sm text-[#eedfc8]/60">
            {status === 'showing' && 'Watch closely…'}
            {status === 'input' && 'Your turn - repeat the sequence.'}
            {status === 'idle' && 'Press start to begin.'}
            {status === 'lost' && `Out of sync. You reached round ${Math.max(0, round - 1)}.`}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={startGame}
              disabled={status === 'showing'}
              className="btn-primary !rounded-2xl !px-4 !py-2 text-sm disabled:opacity-50"
            >
              {status === 'idle' ? 'Start' : 'Restart'}
            </button>
            <Link href="/games/simon?difficulty=easy" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Easy</Link>
            <Link href="/games/simon?difficulty=medium" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Medium</Link>
            <Link href="/games/simon?difficulty=hard" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Hard</Link>
          </div>
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
