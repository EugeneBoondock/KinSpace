'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'

type SudokuDifficulty = 'easy' | 'medium' | 'hard'

type Cell = {
  value: number | null
  fixed: boolean
  notes: number[]
}

function hideCells(puzzle: number[], difficulty: SudokuDifficulty): number[] {
  const keep = difficulty === 'easy' ? 40 : difficulty === 'medium' ? 32 : 26
  const result = [...puzzle]
  const indexes = Array.from({ length: 81 }, (_, index) => index)
  // Fisher-Yates
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[indexes[index], indexes[swap]] = [indexes[swap], indexes[index]]
  }
  for (let index = 0; index < 81 - keep; index += 1) {
    result[indexes[index]] = 0
  }
  return result
}

async function generatePuzzle(difficulty: SudokuDifficulty): Promise<{ start: number[]; solution: number[] }> {
  // sudoku npm returns 81-length array with nulls
  const mod = (await import('sudoku')) as unknown as {
    makepuzzle: () => Array<number | null>
    solvepuzzle: (puzzle: Array<number | null>) => number[] | null
  }
  const raw = mod.makepuzzle()
  const solved = mod.solvepuzzle(raw) ?? Array(81).fill(0)
  const solution = solved.map((value) => (value ?? 0) + 1)
  const start = hideCells(solution, difficulty)
  return { start, solution }
}

export default function SudokuPage() {
  const params = useSearchParams()
  const difficulty = (params.get('difficulty') as SudokuDifficulty | null) ?? 'medium'

  const [grid, setGrid] = useState<Cell[]>([])
  const [solution, setSolution] = useState<number[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [noteMode, setNoteMode] = useState(false)
  const [status, setStatus] = useState<'playing' | 'won'>('playing')

  const loadPuzzle = useCallback(async () => {
    const { start, solution: solved } = await generatePuzzle(difficulty)
    setGrid(start.map((value) => ({ value: value === 0 ? null : value, fixed: value !== 0, notes: [] })))
    setSolution(solved)
    setStatus('playing')
    setSelected(null)
  }, [difficulty])

  useEffect(() => {
    loadPuzzle().catch((error) => console.error('Sudoku generation failed:', error))
  }, [loadPuzzle])

  function placeNumber(value: number) {
    if (selected === null || status !== 'playing') return
    const cell = grid[selected]
    if (cell.fixed) return
    const next = [...grid]
    if (noteMode) {
      const notes = cell.notes.includes(value)
        ? cell.notes.filter((note) => note !== value)
        : [...cell.notes, value]
      next[selected] = { ...cell, notes }
    } else {
      next[selected] = { ...cell, value, notes: [] }
    }
    setGrid(next)
    if (!noteMode && next.every((current, index) => current.value === solution[index])) {
      setStatus('won')
    }
  }

  function clearCell() {
    if (selected === null) return
    const cell = grid[selected]
    if (cell.fixed) return
    const next = [...grid]
    next[selected] = { ...cell, value: null, notes: [] }
    setGrid(next)
  }

  const isError = useCallback(
    (index: number) => {
      const cell = grid[index]
      if (!cell?.value || !solution.length) return false
      return cell.value !== solution[index]
    },
    [grid, solution],
  )

  const selectedValue = selected !== null ? grid[selected]?.value : null

  const highlighted = useMemo(() => {
    if (selected === null) return new Set<number>()
    const row = Math.floor(selected / 9)
    const col = selected % 9
    const box = [Math.floor(row / 3) * 3, Math.floor(col / 3) * 3]
    const set = new Set<number>()
    for (let index = 0; index < 81; index += 1) {
      const r = Math.floor(index / 9)
      const c = index % 9
      if (r === row || c === col) set.add(index)
      if (r >= box[0] && r < box[0] + 3 && c >= box[1] && c < box[1] + 3) set.add(index)
    }
    return set
  }, [selected])

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
                Sudoku · {difficulty}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Sudoku</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Fill every row, column, and 3×3 box with 1-9. Pencil marks, auto-check, three difficulties.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">Notes {noteMode ? 'on' : 'off'}</span>
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center gap-5">
          {grid.length === 0 ? (
            <p className="text-sm text-[#eedfc8]/50">Generating puzzle...</p>
          ) : (
            <div className="grid grid-cols-9 gap-px rounded-2xl bg-[#eedfc8]/20 p-px">
              {grid.map((cell, index) => {
                const row = Math.floor(index / 9)
                const col = index % 9
                const borderClasses: string[] = []
                if (col % 3 === 0 && col > 0) borderClasses.push('border-l-2 border-l-[#D19A58]/40')
                if (row % 3 === 0 && row > 0) borderClasses.push('border-t-2 border-t-[#D19A58]/40')
                const isSelected = index === selected
                const isSame = selectedValue !== null && cell.value === selectedValue && selectedValue !== null
                const isHighlighted = highlighted.has(index)
                const showError = isError(index)
                return (
                  <button
                    key={index}
                    onClick={() => setSelected(index)}
                    className={`flex h-10 w-10 items-center justify-center bg-[#1c3531] text-lg font-semibold transition-colors ${borderClasses.join(' ')} ${
                      isSelected ? 'bg-[#D19A58]/40 text-[#eedfc8]' : isSame ? 'bg-[#D19A58]/15' : isHighlighted ? 'bg-[#eedfc8]/6' : ''
                    } ${cell.fixed ? 'text-[#eedfc8]' : 'text-[#D19A58]'} ${showError ? 'text-[#B85C3A]' : ''}`}
                  >
                    {cell.value ? (
                      cell.value
                    ) : cell.notes.length > 0 ? (
                      <span className="grid grid-cols-3 gap-0 text-[9px] text-[#eedfc8]/45">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((note) => (
                          <span key={note}>{cell.notes.includes(note) ? note : ''}</span>
                        ))}
                      </span>
                    ) : ''}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => (
              <button
                key={value}
                onClick={() => placeNumber(value)}
                className="h-10 w-10 rounded-xl bg-[#eedfc8]/10 text-sm font-semibold text-[#eedfc8] hover:bg-[#eedfc8]/20"
              >
                {value}
              </button>
            ))}
            <button onClick={clearCell} className="btn-secondary !rounded-2xl !px-3 !py-2 text-xs">Clear</button>
            <button
              onClick={() => setNoteMode((value) => !value)}
              className={`rounded-2xl px-3 py-2 text-xs font-semibold ${
                noteMode ? 'bg-[#D19A58] text-[#2A4A42]' : 'bg-[#eedfc8]/10 text-[#eedfc8]'
              }`}
            >
              Notes
            </button>
          </div>

          {status === 'won' && (
            <div className="rounded-2xl bg-[#D19A58]/15 px-4 py-2 text-sm font-semibold text-[#D19A58]">
              Puzzle solved — well done.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={loadPuzzle} className="btn-primary !rounded-2xl !px-4 !py-2 text-sm">
              New puzzle
            </button>
            <Link href="/games/sudoku?difficulty=easy" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Easy</Link>
            <Link href="/games/sudoku?difficulty=medium" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Medium</Link>
            <Link href="/games/sudoku?difficulty=hard" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Hard</Link>
          </div>
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
