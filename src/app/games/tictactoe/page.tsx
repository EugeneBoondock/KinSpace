'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { playSfx } from '@/lib/audio/sfx'
import {
  availableMoves,
  checkWinner,
  computeAiMove,
  emptyBoard,
  isDraw,
  type TTTBoard,
  type TTTDifficulty,
} from '@/lib/game-engines/tictactoe'

type Status = 'playing' | 'win' | 'draw'

export default function TicTacToePage() {
  const params = useSearchParams()
  const difficulty = (params.get('difficulty') as TTTDifficulty | null) ?? 'medium'

  const [board, setBoard] = useState<TTTBoard>(emptyBoard())
  const [turn, setTurn] = useState<'X' | 'O'>('X')
  const [status, setStatus] = useState<Status>('playing')
  const [winningLine, setWinningLine] = useState<number[] | null>(null)
  const [scores, setScores] = useState({ you: 0, ai: 0, draw: 0 })

  const reset = useCallback(() => {
    setBoard(emptyBoard())
    setTurn('X')
    setStatus('playing')
    setWinningLine(null)
  }, [])

  const handleCell = (index: number) => {
    if (status !== 'playing' || turn !== 'X' || board[index] !== null) return
    const next = [...board]
    next[index] = 'X'
    setBoard(next)
    setTurn('O')
    playSfx('move')
  }

  useEffect(() => {
    const { winner, line } = checkWinner(board)
    if (winner) {
      setStatus('win')
      setWinningLine(line)
      setScores((current) => ({
        ...current,
        you: current.you + (winner === 'X' ? 1 : 0),
        ai: current.ai + (winner === 'O' ? 1 : 0),
      }))
      playSfx(winner === 'X' ? 'win' : 'lose')
      return
    }
    if (isDraw(board)) {
      setStatus('draw')
      setScores((current) => ({ ...current, draw: current.draw + 1 }))
      playSfx('pop')
      return
    }
    if (turn === 'O' && status === 'playing') {
      const timer = setTimeout(() => {
        const aiIndex = computeAiMove(board, 'O', difficulty)
        if (aiIndex === null) return
        const next = [...board]
        next[aiIndex] = 'O'
        setBoard(next)
        setTurn('X')
        playSfx('move')
      }, 380)
      return () => clearTimeout(timer)
    }
  }, [board, turn, status, difficulty])

  const availableCount = useMemo(() => availableMoves(board).length, [board])

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
                Tic Tac Toe · {difficulty}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Tic Tac Toe</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                You play X, AI plays O. Win lines glow; square count updates live.
              </p>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="badge">You {scores.you}</span>
              <span className="badge bg-[#B85C3A]/20 text-[#B85C3A]">AI {scores.ai}</span>
              <span className="badge">Draw {scores.draw}</span>
              <span className="badge">{availableCount} open</span>
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center">
          <div className="grid grid-cols-3 gap-3 text-5xl font-bold">
            {board.map((cell, index) => (
              <button
                key={index}
                onClick={() => handleCell(index)}
                disabled={status !== 'playing' || turn !== 'X'}
                className={`flex h-24 w-24 items-center justify-center rounded-2xl border transition-all ${
                  winningLine?.includes(index)
                    ? 'border-[#D19A58] bg-[#D19A58]/15 text-[#D19A58]'
                    : 'border-[#eedfc8]/12 bg-[#eedfc8]/4 text-[#eedfc8]'
                } ${cell === null && status === 'playing' ? 'hover:bg-[#eedfc8]/10' : ''}`}
                aria-label={`cell-${index}`}
              >
                {cell ?? ''}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={reset} className="btn-primary !rounded-2xl !px-4 !py-2 text-sm">
              New match
            </button>
            <Link href="/games/tictactoe?difficulty=easy" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">
              Easy
            </Link>
            <Link href="/games/tictactoe?difficulty=medium" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">
              Medium
            </Link>
            <Link href="/games/tictactoe?difficulty=hard" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">
              Hard
            </Link>
          </div>

          {status !== 'playing' && (
            <p className="mt-4 text-sm font-semibold text-[#D19A58]">
              {status === 'win'
                ? checkWinner(board).winner === 'X'
                  ? 'You won!'
                  : 'AI won this one.'
                : 'Draw - even ground.'}
            </p>
          )}
        </section>
      </div>
      <BottomNav />
    </PageFrame>
  )
}
