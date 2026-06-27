'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { playSfx } from '@/lib/audio/sfx'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import {
  addRandomTile,
  hasWon,
  initialGrid,
  isGameOver,
  move,
  type Direction,
  type Grid,
} from '@/lib/game-engines/2048'

const TILE_COLORS: Record<number, string> = {
  0: 'bg-[#eedfc8]/5 text-transparent',
  2: 'bg-[#eedfc8]/15 text-[#eedfc8]',
  4: 'bg-[#eedfc8]/25 text-[#eedfc8]',
  8: 'bg-[#D19A58]/50 text-[#2A4A42]',
  16: 'bg-[#D19A58]/70 text-[#2A4A42]',
  32: 'bg-[#B85C3A]/60 text-[#eedfc8]',
  64: 'bg-[#B85C3A]/80 text-[#eedfc8]',
  128: 'bg-[#6B8A83]/80 text-[#eedfc8]',
  256: 'bg-[#6B8A83] text-[#eedfc8]',
  512: 'bg-[#D19A58] text-[#2A4A42]',
  1024: 'bg-[#B85C3A] text-[#eedfc8]',
  2048: 'bg-gradient-to-br from-[#D19A58] to-[#B85C3A] text-[#eedfc8]',
}

function firstRenderGrid(): Grid {
  const grid: Grid = [
    [0, 0, 0, 0],
    [0, 2, 0, 0],
    [0, 0, 2, 0],
    [0, 0, 0, 0],
  ]
  return grid.map((row) => [...row])
}

export default function Game2048Page() {
  const { user } = useAuth()
  const [grid, setGrid] = useState<Grid>(() => firstRenderGrid())
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing')

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('kinspace:2048:best') : null
      if (stored) setBest(Number.parseInt(stored, 10) || 0)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (score <= best) return
    const id = requestAnimationFrame(() => {
      setBest(score)
      if (typeof window !== 'undefined') {
        localStorage.setItem('kinspace:2048:best', String(score))
      }
      if (user) {
        DatabaseService.recordGameScore(user.userId, '2048', score).catch(() => undefined)
      }
    })
    return () => cancelAnimationFrame(id)
  }, [score, best, user])

  const handleMove = useCallback(
    (direction: Direction) => {
      if (status !== 'playing') return
      setGrid((current) => {
        const { grid: moved, gained, moved: didMove } = move(current, direction)
        if (!didMove) return current
        const next = addRandomTile(moved)
        setScore((value) => value + gained)
        if (hasWon(next) && status === 'playing') {
          setStatus('won')
          playSfx('win')
        } else if (isGameOver(next)) {
          setStatus('lost')
          playSfx('lose')
        } else {
          playSfx(gained > 0 ? 'pop' : 'move')
        }
        return next
      })
    },
    [status],
  )

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const key = event.key
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        event.preventDefault()
        const map: Record<string, Direction> = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'left',
          ArrowRight: 'right',
        }
        handleMove(map[key])
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleMove])

  function reset() {
    setGrid(initialGrid())
    setScore(0)
    setStatus('playing')
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/45">2048</p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">2048</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Arrow keys to slide tiles. Matching tiles combine. Reach 2048 to win.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">Score {score}</span>
              <span className="badge bg-[#D19A58]/15 text-[#D19A58]">Best {best}</span>
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center gap-5">
          <div className="grid grid-cols-4 gap-2 rounded-2xl bg-[#eedfc8]/5 p-2">
            {grid.flatMap((row, rowIndex) =>
              row.map((value, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`flex h-20 w-20 items-center justify-center rounded-xl text-xl font-bold ${TILE_COLORS[value] ?? 'bg-[#2A4A42] text-[#eedfc8]'}`}
                >
                  {value || ''}
                </div>
              )),
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 sm:hidden">
            <div />
            <button onClick={() => handleMove('up')} className="btn-secondary !rounded-2xl !px-4 !py-2">↑</button>
            <div />
            <button onClick={() => handleMove('left')} className="btn-secondary !rounded-2xl !px-4 !py-2">←</button>
            <button onClick={() => handleMove('down')} className="btn-secondary !rounded-2xl !px-4 !py-2">↓</button>
            <button onClick={() => handleMove('right')} className="btn-secondary !rounded-2xl !px-4 !py-2">→</button>
          </div>

          {status === 'won' && (
            <div className="rounded-2xl bg-[#D19A58]/18 px-4 py-2 text-sm font-semibold text-[#D19A58]">
              You reached 2048!
              <button onClick={() => setStatus('playing')} className="ml-3 underline">
                Keep going
              </button>
            </div>
          )}
          {status === 'lost' && (
            <div className="rounded-2xl bg-[#B85C3A]/20 px-4 py-2 text-sm font-semibold text-[#B85C3A]">Board locked.</div>
          )}

          <button onClick={reset} className="btn-primary !rounded-2xl !px-4 !py-2 text-sm">
            New game
          </button>
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
