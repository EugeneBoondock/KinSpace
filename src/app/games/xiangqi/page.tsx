'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import {
  applyMove,
  chooseXiangqiAiMove,
  createInitialBoard,
  getLegalMovesForPiece,
  getWinner,
  type XiangqiBoard,
  type XiangqiPiece,
  type XiangqiPoint,
} from '@/lib/game-engines/xiangqi'

const PIECE_LABEL: Record<XiangqiPiece['type'], string> = {
  general: 'Gen',
  advisor: 'Adv',
  elephant: 'Ele',
  horse: 'Hor',
  chariot: 'Cha',
  cannon: 'Can',
  soldier: 'Sol',
}

function samePoint(first: XiangqiPoint | null, second: XiangqiPoint) {
  return first?.row === second.row && first?.col === second.col
}

export default function XiangqiPage() {
  const [board, setBoard] = useState<XiangqiBoard>(() => createInitialBoard())
  const [selected, setSelected] = useState<XiangqiPoint | null>(null)
  const [message, setMessage] = useState('You play red.')
  const winner = useMemo(() => getWinner(board), [board])
  const legalMoves = useMemo(() => (selected ? getLegalMovesForPiece(board, selected) : []), [board, selected])

  function reset() {
    setBoard(createInitialBoard())
    setSelected(null)
    setMessage('You play red.')
  }

  function play(row: number, col: number) {
    if (winner) return
    const point = { row, col }
    const piece = board[row][col]

    if (!selected) {
      if (piece?.color === 'red') setSelected(point)
      return
    }

    if (piece?.color === 'red') {
      setSelected(point)
      return
    }

    if (!legalMoves.some((move) => samePoint(move, point))) {
      setMessage('Choose a highlighted destination.')
      return
    }

    let next = applyMove(board, selected, point)
    const aiMove = chooseXiangqiAiMove(next, 'black')
    if (aiMove && !getWinner(next)) {
      next = applyMove(next, aiMove.from, aiMove.to)
      setMessage(`AI moved from ${aiMove.from.row + 1}, ${aiMove.from.col + 1}.`)
    } else {
      setMessage('AI has no move.')
    }
    setBoard(next)
    setSelected(null)
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/45">Chinese chess</p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Xiangqi</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Move red pieces across the river and capture the black general.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">You red</span>
              <span className="badge">AI black</span>
              {winner && <span className="badge">{winner} wins</span>}
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center gap-5">
          <div className="grid gap-px rounded-2xl bg-[#eedfc8]/15 p-1" style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))' }}>
            {board.map((row, rowIndex) =>
              row.map((piece, colIndex) => {
                const point = { row: rowIndex, col: colIndex }
                const isSelected = samePoint(selected, point)
                const isLegal = legalMoves.some((move) => samePoint(move, point))
                return (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    type="button"
                    onClick={() => play(rowIndex, colIndex)}
                    aria-label={`Xiangqi square ${rowIndex + 1}, ${colIndex + 1}${piece ? ` ${piece.color} ${piece.type}` : ' empty'}`}
                    className={`flex h-10 w-10 items-center justify-center bg-[#2A4A42] text-[10px] font-bold transition hover:bg-[#345e55] ${
                      isSelected ? 'ring-2 ring-[#D19A58]' : isLegal ? 'ring-2 ring-[#6B8A83]' : ''
                    } ${piece?.color === 'red' ? 'text-[#D19A58]' : 'text-[#eedfc8]'}`}
                  >
                    {piece ? PIECE_LABEL[piece.type] : ''}
                  </button>
                )
              }),
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
