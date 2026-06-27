'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { playSfx } from '@/lib/audio/sfx'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'

type Difficulty = 'easy' | 'medium' | 'hard'
type Point = { x: number; y: number }

const GRID = 20
const CELL = 20

const SPEEDS: Record<Difficulty, number> = { easy: 180, medium: 130, hard: 90 }

function randomCell(exclude: Point[]): Point {
  while (true) {
    const point = {
      x: Math.floor(Math.random() * GRID),
      y: Math.floor(Math.random() * GRID),
    }
    if (!exclude.some((other) => other.x === point.x && other.y === point.y)) return point
  }
}

export default function SnakePage() {
  const params = useSearchParams()
  const difficulty = (params.get('difficulty') as Difficulty | null) ?? 'medium'
  const { user } = useAuth()

  const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }])
  const [food, setFood] = useState<Point>({ x: 15, y: 10 })
  const [direction, setDirection] = useState<Point>({ x: 1, y: 0 })
  const [status, setStatus] = useState<'playing' | 'lost'>('playing')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const directionRef = useRef(direction)
  const pendingRef = useRef<Point | null>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('kinspace:snake:best') : null
      if (stored) setBest(Number.parseInt(stored, 10) || 0)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    directionRef.current = direction
  }, [direction])

  useEffect(() => {
    if (status === 'lost') playSfx('lose')
  }, [status])

  const reset = useCallback(() => {
    const start = [{ x: 10, y: 10 }]
    setSnake(start)
    setDirection({ x: 1, y: 0 })
    pendingRef.current = null
    setFood(randomCell(start))
    setScore(0)
    setStatus('playing')
  }, [])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const opposite = (a: Point, b: Point) => a.x === -b.x && a.y === -b.y
      const map: Record<string, Point> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
      }
      const next = map[event.key]
      if (!next) return
      event.preventDefault()
      if (opposite(next, directionRef.current)) return
      pendingRef.current = next
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  useEffect(() => {
    if (status !== 'playing') return
    const speed = SPEEDS[difficulty]
    const interval = setInterval(() => {
      setSnake((current) => {
        const moveDir = pendingRef.current ?? directionRef.current
        pendingRef.current = null
        setDirection(moveDir)

        const head = current[0]
        const next = { x: head.x + moveDir.x, y: head.y + moveDir.y }

        if (next.x < 0 || next.y < 0 || next.x >= GRID || next.y >= GRID) {
          setStatus('lost')
          return current
        }
        if (current.some((segment) => segment.x === next.x && segment.y === next.y)) {
          setStatus('lost')
          return current
        }

        const ate = next.x === food.x && next.y === food.y
        const newSnake = [next, ...current]
        if (!ate) newSnake.pop()
        else {
          const newScore = score + 10
          setScore(newScore)
          playSfx('pop')
          setFood(randomCell(newSnake))
          if (newScore > best) {
            setBest(newScore)
            if (typeof window !== 'undefined') localStorage.setItem('kinspace:snake:best', String(newScore))
            if (user) DatabaseService.recordGameScore(user.userId, 'snake', newScore).catch(() => undefined)
          }
        }
        return newSnake
      })
    }, speed)
    return () => clearInterval(interval)
  }, [status, difficulty, food, score, best, user])

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
                Snake · {difficulty}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Snake</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Arrow keys to steer. Eat the dot. Steady rhythm - no rush.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">Score {score}</span>
              <span className="badge bg-[#D19A58]/15 text-[#D19A58]">Best {best}</span>
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center gap-5">
          <div
            className="relative rounded-2xl border border-[#eedfc8]/15 bg-[#0f1f1b]"
            style={{ width: GRID * CELL, height: GRID * CELL }}
          >
            {snake.map((segment, index) => (
              <div
                key={index}
                className={`absolute rounded ${index === 0 ? 'bg-[#D19A58]' : 'bg-[#6B8A83]'}`}
                style={{
                  left: segment.x * CELL,
                  top: segment.y * CELL,
                  width: CELL - 2,
                  height: CELL - 2,
                }}
              />
            ))}
            <div
              className="absolute rounded-full bg-[#B85C3A]"
              style={{
                left: food.x * CELL + 4,
                top: food.y * CELL + 4,
                width: CELL - 10,
                height: CELL - 10,
              }}
            />
          </div>

          {status === 'lost' && (
            <div className="rounded-2xl bg-[#B85C3A]/20 px-4 py-2 text-sm font-semibold text-[#B85C3A]">
              Crashed. Final score {score}.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={reset} className="btn-primary !rounded-2xl !px-4 !py-2 text-sm">
              New game
            </button>
            <Link href="/games/snake?difficulty=easy" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Easy</Link>
            <Link href="/games/snake?difficulty=medium" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Medium</Link>
            <Link href="/games/snake?difficulty=hard" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Hard</Link>
          </div>
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
