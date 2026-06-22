'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import {
  applyMove,
  chooseGoAiMove,
  countStones,
  createBoard,
  type GoBoard,
  type GoPlayer,
} from '@/lib/game-engines/go'

type CaptureScore = Record<GoPlayer, number>

export default function GoPage() {
  const [board, setBoard] = useState<GoBoard>(() => createBoard(9))
  const [captures, setCaptures] = useState<CaptureScore>({ black: 0, white: 0 })
  const [message, setMessage] = useState('Your turn as black.')
  const stones = useMemo(() => countStones(board), [board])

  function reset() {
    setBoard(createBoard(9))
    setCaptures({ black: 0, white: 0 })
    setMessage('Your turn as black.')
  }

  function play(row: number, col: number) {
    const playerMove = applyMove(board, { row, col }, 'black')
    if (!playerMove.legal) {
      setMessage('That point is not legal.')
      return
    }

    let nextBoard = playerMove.board
    const nextCaptures = {
      ...captures,
      black: captures.black + playerMove.captured.length,
    }

    const aiMove = chooseGoAiMove(nextBoard, 'white')
    if (aiMove) {
      const aiResult = applyMove(nextBoard, aiMove, 'white')
      if (aiResult.legal) {
        nextBoard = aiResult.board
        nextCaptures.white += aiResult.captured.length
        setMessage(`AI placed at ${aiMove.row + 1}, ${aiMove.col + 1}.`)
      }
    } else {
      setMessage('AI passed.')
    }

    setBoard(nextBoard)
    setCaptures(nextCaptures)
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
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Go</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Place black stones. Groups without liberties are captured, so surround carefully.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">Black {stones.black}</span>
              <span className="badge">White {stones.white}</span>
              <span className="badge">Captured {captures.black} / {captures.white}</span>
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center gap-5">
          <div className="grid gap-px rounded-2xl bg-[#D19A58]/30 p-2" style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))' }}>
            {board.map((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  type="button"
                  onClick={() => play(rowIndex, colIndex)}
                  aria-label={`Go point ${rowIndex + 1}, ${colIndex + 1}${cell ? ` ${cell}` : ' empty'}`}
                  className="flex h-9 w-9 items-center justify-center bg-[#b98648]/60 transition hover:bg-[#D19A58]/70"
                >
                  {cell && (
                    <span className={`h-7 w-7 rounded-full shadow ${cell === 'black' ? 'bg-[#0f1f1b]' : 'bg-[#eedfc8]'}`} />
                  )}
                </button>
              )),
            )}
          </div>

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
