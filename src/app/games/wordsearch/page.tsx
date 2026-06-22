'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'

type Difficulty = 'easy' | 'medium' | 'hard'
type Cell = { row: number; col: number }
type Direction = { dr: number; dc: number }

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const WORD_POOL = [
  'CALM', 'REST', 'BREATHE', 'GENTLE', 'KIND', 'HOPE', 'PEACE', 'WARMTH',
  'STEADY', 'SAFE', 'CARE', 'TRUST', 'LIGHT', 'QUIET', 'GROW', 'HEAL',
  'BRAVE', 'SHARE', 'BLOOM', 'SOFT',
]

const CONFIG: Record<Difficulty, { size: number; words: number; diagonals: boolean }> = {
  easy: { size: 8, words: 4, diagonals: false },
  medium: { size: 10, words: 6, diagonals: false },
  hard: { size: 12, words: 7, diagonals: true },
}

function pickDirections(diagonals: boolean): Direction[] {
  const base: Direction[] = [
    { dr: 0, dc: 1 },
    { dr: 1, dc: 0 },
  ]
  if (diagonals) {
    base.push({ dr: 1, dc: 1 }, { dr: 1, dc: -1 })
  }
  return base
}

type Board = {
  grid: string[][]
  words: string[]
  size: number
}

function buildBoard(difficulty: Difficulty): Board {
  const { size, words: wordCount, diagonals } = CONFIG[difficulty]
  const grid: string[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ''),
  )
  const directions = pickDirections(diagonals)
  const candidates = [...WORD_POOL]
    .filter((word) => word.length <= size)
    .sort(() => Math.random() - 0.5)

  const placed: string[] = []

  for (const word of candidates) {
    if (placed.length >= wordCount) break
    let positioned = false
    for (let attempt = 0; attempt < 60 && !positioned; attempt += 1) {
      const dir = directions[Math.floor(Math.random() * directions.length)]
      const maxRow = dir.dr === 0 ? size - 1 : size - word.length
      const minRow = 0
      const maxCol = dir.dc === 1 ? size - word.length : size - 1
      const minCol = dir.dc === -1 ? word.length - 1 : 0
      if (maxRow < minRow || maxCol < minCol) continue
      const row = minRow + Math.floor(Math.random() * (maxRow - minRow + 1))
      const col = minCol + Math.floor(Math.random() * (maxCol - minCol + 1))

      let fits = true
      for (let i = 0; i < word.length; i += 1) {
        const r = row + dir.dr * i
        const c = col + dir.dc * i
        const existing = grid[r][c]
        if (existing && existing !== word[i]) {
          fits = false
          break
        }
      }
      if (!fits) continue

      for (let i = 0; i < word.length; i += 1) {
        grid[row + dir.dr * i][col + dir.dc * i] = word[i]
      }
      placed.push(word)
      positioned = true
    }
  }

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (!grid[r][c]) {
        grid[r][c] = ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
      }
    }
  }

  return { grid, words: placed.sort(), size }
}

// Returns the straight line of cells between two endpoints if they form a valid
// horizontal, vertical, or diagonal run; otherwise null.
function lineBetween(start: Cell, end: Cell): Cell[] | null {
  const dr = end.row - start.row
  const dc = end.col - start.col
  const stepR = Math.sign(dr)
  const stepC = Math.sign(dc)
  const isStraight =
    dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)
  if (!isStraight) return null
  const length = Math.max(Math.abs(dr), Math.abs(dc)) + 1
  const cells: Cell[] = []
  for (let i = 0; i < length; i += 1) {
    cells.push({ row: start.row + stepR * i, col: start.col + stepC * i })
  }
  return cells
}

function cellKey(cell: Cell): string {
  return `${cell.row}-${cell.col}`
}

export default function WordSearchPage() {
  const params = useSearchParams()
  const difficulty = (params.get('difficulty') as Difficulty | null) ?? 'medium'
  const { user } = useAuth()

  const [board, setBoard] = useState<Board>(() => buildBoard(difficulty))
  const [found, setFound] = useState<string[]>([])
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set())
  const [start, setStart] = useState<Cell | null>(null)
  const [best, setBest] = useState(0)

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('kinspace:wordsearch:best') : null
    if (stored) setBest(Number.parseInt(stored, 10) || 0)
  }, [])

  const reset = useCallback(() => {
    setBoard(buildBoard(difficulty))
    setFound([])
    setFoundCells(new Set())
    setStart(null)
  }, [difficulty])

  useEffect(() => {
    reset()
  }, [difficulty, reset])

  const won = board.words.length > 0 && found.length === board.words.length

  const recordBest = useCallback(
    (total: number) => {
      if (total <= best) return
      setBest(total)
      if (typeof window !== 'undefined') localStorage.setItem('kinspace:wordsearch:best', String(total))
      if (user) DatabaseService.recordGameScore(user.userId, 'wordsearch', total).catch(() => undefined)
    },
    [best, user],
  )

  function handleCell(cell: Cell) {
    if (!start) {
      setStart(cell)
      return
    }
    if (start.row === cell.row && start.col === cell.col) {
      setStart(null)
      return
    }

    const line = lineBetween(start, cell)
    setStart(null)
    if (!line) return

    const letters = line.map(({ row, col }) => board.grid[row][col]).join('')
    const reversed = letters.split('').reverse().join('')
    const match = board.words.find(
      (word) => (word === letters || word === reversed) && !found.includes(word),
    )
    if (!match) return

    const nextFound = [...found, match]
    setFound(nextFound)
    setFoundCells((current) => {
      const next = new Set(current)
      line.forEach((c) => next.add(cellKey(c)))
      return next
    })
    recordBest(nextFound.length)
  }

  const startKey = start ? cellKey(start) : null
  const cellSize = useMemo(() => {
    if (board.size >= 12) return 'h-7 w-7 text-xs'
    if (board.size >= 10) return 'h-8 w-8 text-sm'
    return 'h-9 w-9 text-sm'
  }, [board.size])

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
                Word Search · {difficulty}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Word Search</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Tap the first and last letter of a word to highlight it. No clock, no rush.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">Found {found.length}/{board.words.length}</span>
              <span className="badge bg-[#D19A58]/15 text-[#D19A58]">Best {best}</span>
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center gap-5">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${board.size}, minmax(0, 1fr))` }}>
            {board.grid.map((rowCells, row) =>
              rowCells.map((letter, col) => {
                const key = `${row}-${col}`
                const isFound = foundCells.has(key)
                const isStart = startKey === key
                return (
                  <button
                    key={key}
                    onClick={() => handleCell({ row, col })}
                    className={`${cellSize} flex items-center justify-center rounded-md font-semibold uppercase transition-colors ${
                      isFound
                        ? 'bg-[#6B8A83]/45 text-[#eedfc8]'
                        : isStart
                          ? 'bg-[#D19A58]/55 text-[#1b120b]'
                          : 'bg-[#eedfc8]/10 text-[#eedfc8]/85 hover:bg-[#eedfc8]/18'
                    }`}
                    aria-label={`cell-${row}-${col}-${letter}`}
                  >
                    {letter}
                  </button>
                )
              }),
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {board.words.map((word) => {
              const isFound = found.includes(word)
              return (
                <span
                  key={word}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                    isFound
                      ? 'bg-[#6B8A83]/25 text-[#6B8A83] line-through'
                      : 'bg-[#eedfc8]/10 text-[#eedfc8]/70'
                  }`}
                >
                  {word}
                </span>
              )
            })}
          </div>

          {won && (
            <div className="rounded-2xl bg-[#6B8A83]/20 px-4 py-2 text-sm font-semibold text-[#6B8A83]">
              Every word found. Beautifully done.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={reset} className="btn-primary !rounded-2xl !px-4 !py-2 text-sm">
              New puzzle
            </button>
            <Link href="/games/wordsearch?difficulty=easy" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Easy</Link>
            <Link href="/games/wordsearch?difficulty=medium" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Medium</Link>
            <Link href="/games/wordsearch?difficulty=hard" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Hard</Link>
          </div>
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
