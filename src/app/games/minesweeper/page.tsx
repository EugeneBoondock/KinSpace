'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import {
  DIFFICULTY_CONFIG,
  emptyGrid,
  hasWon,
  plantMines,
  reveal,
  toggleFlag,
  type MsDifficulty,
  type MsGrid,
} from '@/lib/game-engines/minesweeper'
import { playSfx } from '@/lib/audio/sfx'

const NUMBER_COLORS = ['', 'text-[#6B8A83]', 'text-[#D19A58]', 'text-[#B85C3A]', 'text-[#d1c858]', 'text-[#B85C3A]', 'text-[#B85C3A]', 'text-[#eedfc8]', 'text-[#eedfc8]/60']

export default function MinesweeperPage() {
  const params = useSearchParams()
  const difficulty = (params.get('difficulty') as MsDifficulty | null) ?? 'easy'
  const config = DIFFICULTY_CONFIG[difficulty]

  const [grid, setGrid] = useState<MsGrid>(() => emptyGrid(config.rows, config.cols))
  const [mined, setMined] = useState(false)
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing')

  const reset = useCallback(() => {
    setGrid(emptyGrid(config.rows, config.cols))
    setMined(false)
    setStatus('playing')
  }, [config.rows, config.cols])

  useEffect(() => {
    reset()
  }, [reset])

  function handleReveal(row: number, col: number) {
    if (status !== 'playing') return
    let current = grid
    if (!mined) {
      current = plantMines(grid, config.mines, row, col)
      setMined(true)
    }
    const { grid: next, exploded } = reveal(current, row, col)
    setGrid(next)
    if (exploded) {
      setStatus('lost')
      playSfx('lose')
    } else if (hasWon(next)) {
      setStatus('won')
      playSfx('win')
    } else {
      playSfx('move')
    }
  }

  function handleFlag(event: React.MouseEvent, row: number, col: number) {
    event.preventDefault()
    if (status !== 'playing') return
    setGrid(toggleFlag(grid, row, col))
    playSfx('pop')
  }

  const mineCount = useMemo(() => {
    let flagged = 0
    for (const row of grid) for (const cell of row) if (cell.flagged) flagged += 1
    return config.mines - flagged
  }, [grid, config.mines])

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
                Minesweeper · {difficulty}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Minesweeper</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Click to reveal. Right-click (or long-press) to flag. First click is always safe.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">Mines left {mineCount}</span>
              <span className="badge">
                {config.rows} × {config.cols} · {config.mines} mines
              </span>
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center gap-5">
          <div
            className="grid gap-[2px] rounded-2xl bg-[#eedfc8]/10 p-1"
            style={{ gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))` }}
          >
            {grid.flatMap((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => handleReveal(rowIndex, colIndex)}
                  onContextMenu={(event) => handleFlag(event, rowIndex, colIndex)}
                  aria-label={`Minesweeper square ${rowIndex + 1}, ${colIndex + 1}${
                    cell.flagged
                      ? ' flagged'
                      : cell.revealed
                        ? cell.mine
                          ? ' mine'
                          : ` ${cell.neighbors} nearby`
                        : ' hidden'
                  }`}
                  className={`flex h-7 w-7 items-center justify-center text-xs font-bold ${
                    cell.revealed
                      ? cell.mine
                        ? 'bg-[#B85C3A] text-[#eedfc8]'
                        : 'bg-[#0f1f1b] text-[#eedfc8]'
                      : 'bg-[#eedfc8]/15 text-[#eedfc8] hover:bg-[#eedfc8]/25'
                  } ${cell.revealed && !cell.mine ? NUMBER_COLORS[cell.neighbors] : ''}`}
                >
                  {cell.revealed
                    ? cell.mine
                      ? '💣'
                      : cell.neighbors > 0
                        ? cell.neighbors
                        : ''
                    : cell.flagged
                      ? '🚩'
                      : ''}
                </button>
              )),
            )}
          </div>

          {status === 'won' && (
            <div className="rounded-2xl bg-[#6B8A83]/20 px-4 py-2 text-sm font-semibold text-[#6B8A83]">
              Swept clean.
            </div>
          )}
          {status === 'lost' && (
            <div className="rounded-2xl bg-[#B85C3A]/20 px-4 py-2 text-sm font-semibold text-[#B85C3A]">
              Boom. Better luck next run.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={reset} className="btn-primary !rounded-2xl !px-4 !py-2 text-sm">
              New board
            </button>
            <Link href="/games/minesweeper?difficulty=easy" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Easy</Link>
            <Link href="/games/minesweeper?difficulty=medium" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Medium</Link>
            <Link href="/games/minesweeper?difficulty=hard" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Hard</Link>
          </div>
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
