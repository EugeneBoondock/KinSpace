'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import {
  applyMove,
  allMovesFor,
  checkWinner,
  computeAiMove,
  initialBoard,
  movesForPiece,
  type CheckersBoard,
  type CheckersColor,
  type CheckersDifficulty,
  type Move,
} from '@/lib/game-engines/checkers'

type Coord = [number, number]

function sameCoord(a: Coord, b: Coord) {
  return a[0] === b[0] && a[1] === b[1]
}

export default function CheckersPage() {
  const params = useSearchParams()
  const difficulty = (params.get('difficulty') as CheckersDifficulty | null) ?? 'medium'

  const [board, setBoard] = useState<CheckersBoard>(initialBoard())
  const [turn, setTurn] = useState<CheckersColor>('black')
  const [selected, setSelected] = useState<Coord | null>(null)
  const [availableMoves, setAvailableMoves] = useState<Move[]>([])
  const [winner, setWinner] = useState<CheckersColor | null>(null)

  const reset = useCallback(() => {
    setBoard(initialBoard())
    setTurn('black')
    setSelected(null)
    setAvailableMoves([])
    setWinner(null)
  }, [])

  const runAi = useCallback((latest: CheckersBoard) => {
    const move = computeAiMove(latest, 'red', difficulty)
    if (!move) {
      setWinner('black')
      return
    }
    const next = applyMove(latest, move)
    setBoard(next)
    const nextWinner = checkWinner(next)
    if (nextWinner) {
      setWinner(nextWinner)
      return
    }
    if (allMovesFor(next, 'black').length === 0) {
      setWinner('red')
      return
    }
    setTurn('black')
  }, [difficulty])

  useEffect(() => {
    if (winner || turn !== 'red') return
    const timer = setTimeout(() => runAi(board), 350)
    return () => clearTimeout(timer)
  }, [turn, board, winner, runAi])

  function handleSquare(row: number, col: number) {
    if (winner || turn !== 'black') return

    if (selected) {
      const target = availableMoves.find((move) => move.to[0] === row && move.to[1] === col)
      if (target) {
        const next = applyMove(board, target)
        setBoard(next)
        setSelected(null)
        setAvailableMoves([])
        const nextWinner = checkWinner(next)
        if (nextWinner) setWinner(nextWinner)
        else setTurn('red')
        return
      }
    }

    const piece = board[row][col]
    if (!piece || piece.color !== 'black') {
      setSelected(null)
      setAvailableMoves([])
      return
    }
    const moves = movesForPiece(board, row, col)
    setSelected([row, col])
    setAvailableMoves(moves)
  }

  const myPieces = useMemo(() => {
    let black = 0
    let red = 0
    for (const row of board) for (const cell of row) {
      if (!cell) continue
      if (cell.color === 'black') black += 1
      if (cell.color === 'red') red += 1
    }
    return { black, red }
  }, [board])

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
                Checkers · {difficulty}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Checkers</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                You play black. Jumps are mandatory. Kings promoted at the far row.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">Black {myPieces.black}</span>
              <span className="badge bg-[#B85C3A]/20 text-[#B85C3A]">Red {myPieces.red}</span>
              <span className="badge">Turn: {turn}</span>
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center">
          <div className="grid grid-cols-8 gap-0 rounded-2xl border border-[#eedfc8]/10 bg-[#eedfc8]/4 p-2">
            {board.map((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const isDark = (rowIndex + colIndex) % 2 === 1
                const isSelected = selected && sameCoord(selected, [rowIndex, colIndex])
                const isTargetMove = availableMoves.some((move) => move.to[0] === rowIndex && move.to[1] === colIndex)

                return (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    onClick={() => handleSquare(rowIndex, colIndex)}
                    className={`flex h-12 w-12 items-center justify-center text-2xl transition-colors ${
                      isDark ? 'bg-[#2A4A42]' : 'bg-[#eedfc8]/10'
                    } ${isSelected ? 'ring-2 ring-[#D19A58]' : ''} ${
                      isTargetMove ? 'ring-2 ring-[#6B8A83]' : ''
                    }`}
                  >
                    {cell && (
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                          cell.color === 'black'
                            ? 'bg-[#0f1f1b] text-[#eedfc8]'
                            : 'bg-[#B85C3A] text-[#eedfc8]'
                        }`}
                      >
                        {cell.king ? '♛' : ''}
                      </span>
                    )}
                  </button>
                )
              }),
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={reset} className="btn-primary !rounded-2xl !px-4 !py-2 text-sm">
              New game
            </button>
            <Link href="/games/checkers?difficulty=easy" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">
              Easy
            </Link>
            <Link href="/games/checkers?difficulty=medium" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">
              Medium
            </Link>
            <Link href="/games/checkers?difficulty=hard" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">
              Hard
            </Link>
          </div>

          {winner && (
            <p className="mt-4 text-sm font-semibold text-[#D19A58]">
              {winner === 'black' ? 'You won!' : 'Red wins this one.'}
            </p>
          )}
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
