'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import {
  applyMove,
  checkWinner,
  chooseGomokuAiMove,
  createBoard,
  type GomokuBoard,
  type GomokuPlayer,
} from '@/lib/game-engines/gomoku'

function nextPlayer(player: GomokuPlayer): GomokuPlayer {
  return player === 'black' ? 'white' : 'black'
}

export default function GomokuPage() {
  const [board, setBoard] = useState<GomokuBoard>(() => createBoard(15))
  const [turn, setTurn] = useState<GomokuPlayer>('black')
  const outcome = useMemo(() => checkWinner(board), [board])

  function reset() {
    setBoard(createBoard(15))
    setTurn('black')
  }

  function play(row: number, col: number) {
    if (outcome.winner || turn !== 'black' || board[row][col]) return
    let next = applyMove(board, { row, col }, 'black')
    let nextTurn = nextPlayer(turn)
    const playerOutcome = checkWinner(next)
    if (!playerOutcome.winner) {
      const aiMove = chooseGomokuAiMove(next, 'white')
      if (aiMove) {
        next = applyMove(next, aiMove, 'white')
        nextTurn = 'black'
      }
    }
    setBoard(next)
    setTurn(nextTurn)
  }

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <Link href="/games" className="text-sm text-[#D19A58]">
            Back to games
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/45">VS AI</p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Gomoku</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Place black stones and make five in a row before the AI blocks or finishes its own line.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">You black</span>
              <span className="badge">AI white</span>
              <span className="badge">{outcome.winner ? `${outcome.winner} wins` : `${turn} to move`}</span>
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center gap-5">
          <div className="grid gap-px rounded-2xl bg-[#eedfc8]/15 p-1" style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}>
            {board.map((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  type="button"
                  onClick={() => play(rowIndex, colIndex)}
                  aria-label={`Gomoku square ${rowIndex + 1}, ${colIndex + 1}${cell ? ` ${cell}` : ' empty'}`}
                  className={`flex h-7 w-7 items-center justify-center bg-[#2A4A42] transition hover:bg-[#345e55] ${
                    outcome.line.some((point) => point.row === rowIndex && point.col === colIndex) ? 'ring-2 ring-[#D19A58]' : ''
                  }`}
                >
                  {cell && (
                    <span className={`h-5 w-5 rounded-full ${cell === 'black' ? 'bg-[#0f1f1b]' : 'bg-[#eedfc8]'}`} />
                  )}
                </button>
              )),
            )}
          </div>

          {outcome.winner && (
            <p className="rounded-2xl bg-[#D19A58]/15 px-4 py-2 text-sm font-semibold text-[#D19A58]">
              {outcome.winner === 'black' ? 'You won.' : outcome.winner === 'white' ? 'AI won.' : 'Draw board.'}
            </p>
          )}

          <button type="button" onClick={reset} className="btn-primary !rounded-2xl !px-4 !py-2 text-sm">
            New match
          </button>
        </section>
      </div>
      <BottomNav />
    </PageFrame>
  )
}
