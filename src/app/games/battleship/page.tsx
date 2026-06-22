'use client'

import { useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import {
  attackCell,
  chooseBattleshipAiShot,
  createFleetBoard,
  hasShipsRemaining,
  type BattleBoard,
} from '@/lib/game-engines/battleship'

export default function BattleshipPage() {
  const [playerBoard, setPlayerBoard] = useState<BattleBoard>(() => createFleetBoard(8))
  const [aiBoard, setAiBoard] = useState<BattleBoard>(() => createFleetBoard(8))
  const [message, setMessage] = useState('Call your first shot.')
  const [winner, setWinner] = useState<'player' | 'ai' | null>(null)

  function reset() {
    setPlayerBoard(createFleetBoard(8))
    setAiBoard(createFleetBoard(8))
    setMessage('Call your first shot.')
    setWinner(null)
  }

  function fire(row: number, col: number) {
    if (winner) return
    const playerShot = attackCell(aiBoard, { row, col })
    if (!playerShot.legal) return

    let nextPlayerBoard = playerBoard
    let nextWinner: 'player' | 'ai' | null = hasShipsRemaining(playerShot.board) ? null : 'player'
    let nextMessage = playerShot.hit ? 'Hit on the AI fleet.' : 'Missed the AI fleet.'

    if (!nextWinner) {
      const aiShot = chooseBattleshipAiShot(playerBoard)
      if (aiShot) {
        const aiResult = attackCell(playerBoard, aiShot)
        nextPlayerBoard = aiResult.board
        nextMessage += aiResult.hit ? ' AI hit your fleet.' : ' AI missed.'
        if (!hasShipsRemaining(aiResult.board)) nextWinner = 'ai'
      }
    }

    setAiBoard(playerShot.board)
    setPlayerBoard(nextPlayerBoard)
    setWinner(nextWinner)
    setMessage(nextWinner === 'player' ? 'You sank the AI fleet.' : nextWinner === 'ai' ? 'AI sank your fleet.' : nextMessage)
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
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Battleship</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Fire at the hidden AI fleet. Hits and misses stay marked on both boards.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">You vs AI</span>
              {winner && <span className="badge">{winner === 'player' ? 'You win' : 'AI wins'}</span>}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <h2 className="section-title">Target board</h2>
            <div className="mt-4 grid gap-px rounded-2xl bg-[#eedfc8]/15 p-1" style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }}>
              {aiBoard.shots.map((row, rowIndex) =>
                row.map((shot, colIndex) => (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    type="button"
                    onClick={() => fire(rowIndex, colIndex)}
                    aria-label={`Target square ${rowIndex + 1}, ${colIndex + 1}${shot ? ` ${shot}` : ' unknown'}`}
                    className={`h-9 w-9 rounded-sm text-xs font-bold ${
                      shot === 'hit' ? 'bg-[#B85C3A] text-[#eedfc8]' : shot === 'miss' ? 'bg-[#6B8A83] text-[#eedfc8]' : 'bg-[#2A4A42] hover:bg-[#345e55]'
                    }`}
                  >
                    {shot === 'hit' ? 'X' : shot === 'miss' ? 'o' : ''}
                  </button>
                )),
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="section-title">Your fleet</h2>
            <div className="mt-4 grid gap-px rounded-2xl bg-[#eedfc8]/15 p-1" style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }}>
              {playerBoard.shots.map((row, rowIndex) =>
                row.map((shot, colIndex) => {
                  const hasShip = playerBoard.ships.some((ship) => ship.cells.some((cell) => cell.row === rowIndex && cell.col === colIndex))
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      aria-label={`Fleet square ${rowIndex + 1}, ${colIndex + 1}`}
                      className={`flex h-9 w-9 items-center justify-center rounded-sm text-xs font-bold ${
                        shot === 'hit' ? 'bg-[#B85C3A]' : shot === 'miss' ? 'bg-[#6B8A83]' : hasShip ? 'bg-[#D19A58]/45' : 'bg-[#2A4A42]'
                      } text-[#eedfc8]`}
                    >
                      {shot === 'hit' ? 'X' : hasShip ? 'S' : ''}
                    </div>
                  )
                }),
              )}
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center gap-4">
          <p className="text-sm font-semibold text-[#D19A58]">{message}</p>
          <button type="button" onClick={reset} className="btn-primary !rounded-2xl !px-4 !py-2 text-sm">
            New match
          </button>
        </section>
      </div>
      <BottomNav />
    </PageFrame>
  )
}
