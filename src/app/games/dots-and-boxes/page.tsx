'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import {
  chooseDotsAiLine,
  createState,
  drawLine,
  getWinner,
  type DotsLine,
  type DotsPlayer,
  type DotsState,
} from '@/lib/game-engines/dots-and-boxes'

function lineLabel(line: DotsLine) {
  return `${line.orientation === 'h' ? 'Horizontal' : 'Vertical'} line ${line.row + 1}, ${line.col + 1}`
}

export default function DotsAndBoxesPage() {
  const [state, setState] = useState<DotsState>(() => createState(4, 4))
  const [turn, setTurn] = useState<DotsPlayer>('player1')
  const [message, setMessage] = useState('Draw a line. You are Player 1.')
  const winner = useMemo(() => getWinner(state), [state])

  function reset() {
    setState(createState(4, 4))
    setTurn('player1')
    setMessage('Draw a line. You are Player 1.')
  }

  function play(line: DotsLine) {
    if (winner || turn !== 'player1') return
    const result = drawLine(state, line, 'player1')
    if (!result.legal) return

    let next = result.state
    let nextTurn: DotsPlayer = result.scored > 0 ? 'player1' : 'player2'
    let nextMessage = result.scored > 0 ? 'You closed a box.' : 'AI turn.'

    if (nextTurn === 'player2' && !getWinner(next)) {
      const aiLine = chooseDotsAiLine(next, 'player2')
      if (aiLine) {
        const aiResult = drawLine(next, aiLine, 'player2')
        next = aiResult.state
        nextTurn = aiResult.scored > 0 ? 'player2' : 'player1'
        nextMessage = aiResult.scored > 0 ? 'AI closed a box.' : 'Your turn.'
      }
    }

    setState(next)
    setTurn(nextTurn)
    setMessage(nextMessage)
  }

  const renderedRows = []
  for (let row = 0; row <= state.rows; row += 1) {
    renderedRows.push(
      <div key={`h-${row}`} className="flex items-center justify-center">
        {Array.from({ length: state.cols }).map((_, col) => {
          const line = { orientation: 'h' as const, row, col }
          const used = state.horizontal[row][col]
          return (
            <div key={col} className="flex items-center">
              <span className="h-2 w-2 rounded-full bg-[#eedfc8]" />
              <button
                type="button"
                onClick={() => play(line)}
                aria-label={lineLabel(line)}
                className={`h-3 w-12 rounded-full ${used ? 'bg-[#D19A58]' : 'bg-[#eedfc8]/15 hover:bg-[#eedfc8]/30'}`}
              />
            </div>
          )
        })}
        <span className="h-2 w-2 rounded-full bg-[#eedfc8]" />
      </div>,
    )

    if (row < state.rows) {
      renderedRows.push(
        <div key={`v-${row}`} className="flex items-center justify-center">
          {Array.from({ length: state.cols + 1 }).map((_, col) => {
            const line = { orientation: 'v' as const, row, col }
            const used = state.vertical[row][col]
            const owner = col < state.cols ? state.boxes[row][col] : null
            return (
              <div key={col} className="flex items-center">
                <button
                  type="button"
                  onClick={() => play(line)}
                  aria-label={lineLabel(line)}
                  className={`h-12 w-3 rounded-full ${used ? 'bg-[#D19A58]' : 'bg-[#eedfc8]/15 hover:bg-[#eedfc8]/30'}`}
                />
                {col < state.cols && (
                  <span className={`flex h-12 w-12 items-center justify-center text-xs font-bold ${owner === 'player1' ? 'text-[#D19A58]' : owner === 'player2' ? 'text-[#B85C3A]' : 'text-[#eedfc8]/25'}`}>
                    {owner === 'player1' ? 'You' : owner === 'player2' ? 'AI' : ''}
                  </span>
                )}
              </div>
            )
          })}
        </div>,
      )
    }
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
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Dots and Boxes</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Draw lines between dots. Closing the fourth side of a box scores a point.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">You {state.scores.player1}</span>
              <span className="badge">AI {state.scores.player2}</span>
              <span className="badge">{winner ? `${winner} wins` : `${turn} to move`}</span>
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center gap-5">
          <div className="space-y-1 rounded-2xl bg-[#2A4A42] p-4">{renderedRows}</div>
          <p className="text-sm font-semibold text-[#D19A58]">{winner === 'draw' ? 'Draw match.' : message}</p>
          <button type="button" onClick={reset} className="btn-primary !rounded-2xl !px-4 !py-2 text-sm">
            New match
          </button>
        </section>
      </div>
      <BottomNav />
    </PageFrame>
  )
}
