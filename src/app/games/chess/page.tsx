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

export default function ChessPage() {
  const params = useSearchParams()
  const difficulty = (params.get('difficulty') as Difficulty | null) ?? 'medium'

  const chessRef = useRef(new Chess())
  const [fen, setFen] = useState(chessRef.current.fen())
  const [status, setStatus] = useState<'playing' | 'win' | 'loss' | 'draw'>('playing')
  const [thinking, setThinking] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [aiMoveFn, setAiMoveFn] = useState<AiMoveFn | null>(null)

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
  }, [])

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
  }, [aiMoveFn, difficulty, evaluateStatus])

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
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Chess vs AI</h1>
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

            {status !== 'playing' && (
              <div className="rounded-2xl bg-[#eedfc8]/8 px-4 py-2 text-sm font-semibold text-[#D19A58]">
                {status === 'win' && 'Checkmate — you win!'}
                {status === 'loss' && 'Checkmate — AI wins.'}
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
