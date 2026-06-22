'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'

type Difficulty = 'easy' | 'medium' | 'hard'

const SIZES: Record<Difficulty, number> = { easy: 3, medium: 4, hard: 5 }

function neighbours(index: number, size: number): number[] {
  const row = Math.floor(index / size)
  const col = index % size
  const cells = [index]
  if (row > 0) cells.push(index - size)
  if (row < size - 1) cells.push(index + size)
  if (col > 0) cells.push(index - 1)
  if (col < size - 1) cells.push(index + 1)
  return cells
}

function toggle(grid: boolean[], index: number, size: number): boolean[] {
  const next = [...grid]
  for (const cell of neighbours(index, size)) {
    next[cell] = !next[cell]
  }
  return next
}

// Build a solvable board by starting from an all-off grid and applying a
// number of random taps. Any board reachable that way is guaranteed solvable.
function buildBoard(difficulty: Difficulty): boolean[] {
  const size = SIZES[difficulty]
  let grid = new Array<boolean>(size * size).fill(false)
  const taps = size * size
  for (let i = 0; i < taps; i += 1) {
    const index = Math.floor(Math.random() * size * size)
    grid = toggle(grid, index, size)
  }
  // Guard against the rare fully-off (already solved) starting board.
  if (grid.every((cell) => !cell)) {
    grid = toggle(grid, 0, size)
  }
  return grid
}

export default function LightsOutPage() {
  const params = useSearchParams()
  const difficulty = (params.get('difficulty') as Difficulty | null) ?? 'medium'
  const size = SIZES[difficulty]
  const { user } = useAuth()

  const [grid, setGrid] = useState<boolean[]>(() => buildBoard(difficulty))
  const [moves, setMoves] = useState(0)
  const [solved, setSolved] = useState(0)
  const [best, setBest] = useState(0)

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('kinspace:lightsout:best') : null
    if (stored) setBest(Number.parseInt(stored, 10) || 0)
  }, [])

  const reset = useCallback(() => {
    setGrid(buildBoard(difficulty))
    setMoves(0)
  }, [difficulty])

  useEffect(() => {
    reset()
  }, [difficulty, reset])

  const won = grid.length > 0 && grid.every((cell) => !cell)

  function handleTile(index: number) {
    if (won) return
    setGrid((current) => toggle(current, index, size))
    setMoves((value) => value + 1)
  }

  useEffect(() => {
    if (!won || moves === 0) return
    setSolved((value) => {
      const total = value + 1
      if (total > best) {
        setBest(total)
        if (typeof window !== 'undefined') localStorage.setItem('kinspace:lightsout:best', String(total))
        if (user) DatabaseService.recordGameScore(user.userId, 'lightsout', total).catch(() => undefined)
      }
      return total
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won])

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
                Lights Out · {difficulty}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Lights Out</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Tap a tile to flip it and its neighbours. Turn every light off to win.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">Moves {moves}</span>
              <span className="badge bg-[#6B8A83]/20 text-[#6B8A83]">Solved {solved}</span>
              <span className="badge bg-[#D19A58]/15 text-[#D19A58]">Best {best}</span>
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center gap-5">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
            {grid.map((on, index) => (
              <button
                key={index}
                onClick={() => handleTile(index)}
                className={`h-16 w-16 rounded-xl transition-all ${
                  on
                    ? 'bg-[#D19A58] shadow-[0_0_18px_rgba(209,154,88,0.55)]'
                    : 'bg-[#eedfc8]/10 hover:bg-[#eedfc8]/18'
                }`}
                aria-label={`tile-${index}-${on ? 'on' : 'off'}`}
              />
            ))}
          </div>

          {won && (
            <div className="rounded-2xl bg-[#6B8A83]/20 px-4 py-2 text-sm font-semibold text-[#6B8A83]">
              All off in {moves} moves. Lovely.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={reset} className="btn-primary !rounded-2xl !px-4 !py-2 text-sm">
              New board
            </button>
            <Link href="/games/lightsout?difficulty=easy" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Easy</Link>
            <Link href="/games/lightsout?difficulty=medium" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Medium</Link>
            <Link href="/games/lightsout?difficulty=hard" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Hard</Link>
          </div>
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
