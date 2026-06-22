'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'

type Difficulty = 'easy' | 'medium' | 'hard'

function difficultyLevel(difficulty: Difficulty): number {
  if (difficulty === 'easy') return 0
  if (difficulty === 'medium') return 2
  return 3
}

type AiMoveFn = (fen: string, level?: number) => Record<string, string>

type TimeControl = { label: string; initial: number; increment: number } // seconds

// chess.com-style presets. `initial: 0` means an untimed game (clocks hidden).
const TIME_CONTROLS: TimeControl[] = [
  { label: '1+0', initial: 60, increment: 0 },
  { label: '3+2', initial: 180, increment: 2 },
  { label: '5+0', initial: 300, increment: 0 },
  { label: '10+0', initial: 600, increment: 0 },
  { label: 'Untimed', initial: 0, increment: 0 },
]

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  // Show tenths under 10s, like chess.com, for the tense final seconds.
  if (ms < 10_000 && ms > 0) {
    const tenths = Math.floor((ms % 1000) / 100)
    return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function Clock({ label, ms, active }: { label: string; ms: number; active: boolean }) {
  const low = ms <= 30_000
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 transition-colors ${
        active ? 'border-[#D19A58]/70 bg-[#D19A58]/15' : 'border-[#eedfc8]/12 bg-[#eedfc8]/5'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium text-[#eedfc8]/70">
        {active && <span className="h-2 w-2 animate-pulse rounded-full bg-[#D19A58]" aria-hidden="true" />}
        {label}
      </span>
      <span
        className={`font-mono text-2xl font-bold tabular-nums ${low ? 'text-red-400' : 'text-[#eedfc8]'}`}
        aria-label={`${label} time remaining`}
      >
        {formatClock(ms)}
      </span>
    </div>
  )
}

export default function ChessPage() {
  const params = useSearchParams()
  const difficulty = (params.get('difficulty') as Difficulty | null) ?? 'medium'

  const chessRef = useRef(new Chess())
  const [fen, setFen] = useState(chessRef.current.fen())
  const [status, setStatus] = useState<'playing' | 'win' | 'loss' | 'draw'>('playing')
  const [thinking, setThinking] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [aiMoveFn, setAiMoveFn] = useState<AiMoveFn | null>(null)

  // ── Chess clock ──────────────────────────────────────────────────
  const [timeControl, setTimeControl] = useState<TimeControl>(TIME_CONTROLS[2]) // 5+0 default
  const [whiteMs, setWhiteMs] = useState(TIME_CONTROLS[2].initial * 1000)
  const [blackMs, setBlackMs] = useState(TIME_CONTROLS[2].initial * 1000)
  const [byTime, setByTime] = useState(false)
  const lastTickRef = useRef<number | null>(null)
  const timed = timeControl.initial > 0

  useEffect(() => {
    let cancelled = false
    import('js-chess-engine')
      .then((mod) => {
        if (cancelled) return
        const candidate: AiMoveFn | undefined =
          typeof (mod as { aiMove?: AiMoveFn }).aiMove === 'function'
            ? (mod as { aiMove: AiMoveFn }).aiMove
            : (mod as { default?: { aiMove?: AiMoveFn } }).default?.aiMove
        if (candidate) setAiMoveFn(() => candidate)
      })
      .catch((error) => console.error('Failed to load chess engine:', error))
    return () => {
      cancelled = true
    }
  }, [])

  const resetGame = useCallback(() => {
    chessRef.current = new Chess()
    setFen(chessRef.current.fen())
    setHistory([])
    setStatus('playing')
    setByTime(false)
    setWhiteMs(timeControl.initial * 1000)
    setBlackMs(timeControl.initial * 1000)
    lastTickRef.current = null
  }, [timeControl])

  // Add the increment to whichever side just moved (Fischer style).
  const applyIncrement = useCallback(
    (mover: 'w' | 'b') => {
      if (timeControl.initial === 0 || timeControl.increment === 0) return
      const add = timeControl.increment * 1000
      if (mover === 'w') setWhiteMs((ms) => ms + add)
      else setBlackMs((ms) => ms + add)
    },
    [timeControl],
  )

  // Drain the side-to-move's clock. Uses real elapsed time (not a fixed -100ms)
  // so it stays accurate even when setInterval is throttled on a hidden tab.
  useEffect(() => {
    if (status !== 'playing' || !timed) return
    lastTickRef.current = Date.now()
    const id = window.setInterval(() => {
      const now = Date.now()
      const elapsed = now - (lastTickRef.current ?? now)
      lastTickRef.current = now
      if (chessRef.current.turn() === 'w') setWhiteMs((ms) => Math.max(0, ms - elapsed))
      else setBlackMs((ms) => Math.max(0, ms - elapsed))
    }, 100)
    return () => window.clearInterval(id)
  }, [status, timed])

  // Flag fall: whoever hits 0 loses on time.
  useEffect(() => {
    if (status !== 'playing' || !timed) return
    if (whiteMs <= 0) {
      setByTime(true)
      setStatus('loss')
    } else if (blackMs <= 0) {
      setByTime(true)
      setStatus('win')
    }
  }, [whiteMs, blackMs, status, timed])

  const evaluateStatus = useCallback(() => {
    const chess = chessRef.current
    if (chess.isCheckmate()) {
      setStatus(chess.turn() === 'w' ? 'loss' : 'win')
    } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
      setStatus('draw')
    }
  }, [])

  const performAiMove = useCallback(() => {
    if (!aiMoveFn) return
    const chess = chessRef.current
    if (chess.turn() !== 'b' || chess.isGameOver()) return
    setThinking(true)
    setTimeout(() => {
      try {
        const aiChoice = aiMoveFn(chess.fen(), difficultyLevel(difficulty))
        const [fromRaw, toRaw] = Object.entries(aiChoice)[0] ?? []
        if (fromRaw && toRaw) {
          chess.move({ from: fromRaw.toLowerCase(), to: toRaw.toLowerCase(), promotion: 'q' })
          applyIncrement('b')
          setFen(chess.fen())
          setHistory([...chess.history()])
        }
      } catch (error) {
        console.error('AI move failed:', error)
      } finally {
        setThinking(false)
        evaluateStatus()
      }
    }, 250)
  }, [aiMoveFn, difficulty, evaluateStatus, applyIncrement])

  useEffect(() => {
    if (status !== 'playing') return
    if (chessRef.current.turn() === 'b') performAiMove()
  }, [fen, status, performAiMove])

  function handleDrop({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string
    targetSquare: string | null
  }): boolean {
    if (status !== 'playing' || thinking) return false
    if (!targetSquare) return false
    const chess = chessRef.current
    try {
      const move = chess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' })
      if (!move) return false
      applyIncrement('w')
      setFen(chess.fen())
      setHistory([...chess.history()])
      evaluateStatus()
      return true
    } catch {
      return false
    }
  }

  const moveSummary = useMemo(() => {
    if (history.length === 0) return 'Make your first move.'
    return history.slice(-4).join(' · ')
  }, [history])

  // Recomputed each render (fen drives renders), so the active-clock highlight tracks turns.
  const turn = chessRef.current.turn()

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
                Chess · {difficulty}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Chess</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Legal-move detection by chess.js. AI opponent by js-chess-engine. You play white.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">{thinking ? 'AI thinking...' : 'Your move'}</span>
              <span className="badge">{history.length} plies</span>
              <span className="badge">{moveSummary}</span>
            </div>
          </div>
        </section>

        <section className="page-grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="card flex flex-col items-center gap-4">
            {timed && (
              <div className="w-full max-w-[520px]">
                <Clock label="AI (Black)" ms={blackMs} active={status === 'playing' && turn === 'b'} />
              </div>
            )}
            <div className="w-full max-w-[520px]">
              <Chessboard
                options={{
                  position: fen,
                  onPieceDrop: handleDrop,
                  boardOrientation: 'white',
                  allowDragging: status === 'playing' && !thinking && chessRef.current.turn() === 'w',
                }}
              />
            </div>
            {timed && (
              <div className="w-full max-w-[520px]">
                <Clock label="You (White)" ms={whiteMs} active={status === 'playing' && turn === 'w'} />
              </div>
            )}

            {status !== 'playing' && (
              <div className="rounded-2xl bg-[#eedfc8]/8 px-4 py-2 text-sm font-semibold text-[#D19A58]">
                {status === 'win' && (byTime ? 'AI flagged - you win on time!' : 'Checkmate - you win!')}
                {status === 'loss' && (byTime ? 'You ran out of time.' : 'Checkmate - AI wins.')}
                {status === 'draw' && 'Drawn position.'}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button onClick={resetGame} className="btn-primary !rounded-2xl !px-4 !py-2 text-sm">
                New game
              </button>
              <Link href="/games/chess?difficulty=easy" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">
                Easy
              </Link>
              <Link href="/games/chess?difficulty=medium" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">
                Medium
              </Link>
              <Link href="/games/chess?difficulty=hard" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">
                Hard
              </Link>
            </div>

            <div className="flex w-full max-w-[520px] flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/45">Time control</p>
              <div className="flex flex-wrap gap-2">
                {TIME_CONTROLS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => {
                      // Switching time control starts a fresh game with the new clocks.
                      setTimeControl(option)
                      chessRef.current = new Chess()
                      setFen(chessRef.current.fen())
                      setHistory([])
                      setStatus('playing')
                      setByTime(false)
                      setWhiteMs(option.initial * 1000)
                      setBlackMs(option.initial * 1000)
                      lastTickRef.current = null
                    }}
                    aria-pressed={timeControl.label === option.label}
                    className={`rounded-2xl px-3 py-1.5 text-sm font-medium transition-colors ${
                      timeControl.label === option.label
                        ? 'bg-[#D19A58] text-[#2a140b]'
                        : 'bg-[#eedfc8]/10 text-[#eedfc8]/70 hover:bg-[#eedfc8]/20'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="card">
            <h2 className="section-title">Move log</h2>
            {history.length === 0 ? (
              <p className="text-sm text-[#eedfc8]/50">No moves yet.</p>
            ) : (
              <ol className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-[#eedfc8]/75">
                {history.map((move, index) => (
                  <li key={`${move}-${index}`}>
                    <span className="text-[#eedfc8]/40">{Math.floor(index / 2) + 1}.</span> {move}
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
