'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Cell = 'X' | 'O' | null
type Status = 'playing' | 'win' | 'draw'

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

function checkWinner(b: Cell[]): { winner: Cell; line: number[] | null } {
  for (const l of LINES) {
    if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) {
      return { winner: b[l[0]], line: l }
    }
  }
  return { winner: null, line: null }
}

function minimax(b: Cell[], isMax: boolean): number {
  const { winner } = checkWinner(b)
  if (winner === 'O') return 10
  if (winner === 'X') return -10
  if (b.every(c => c !== null)) return 0

  if (isMax) {
    let best = -Infinity
    for (let i = 0; i < 9; i++) {
      if (!b[i]) { b[i] = 'O'; best = Math.max(best, minimax(b, false)); b[i] = null }
    }
    return best
  } else {
    let best = Infinity
    for (let i = 0; i < 9; i++) {
      if (!b[i]) { b[i] = 'X'; best = Math.min(best, minimax(b, true)); b[i] = null }
    }
    return best
  }
}

function getAiMove(b: Cell[], difficulty: number): number {
  const empty = b.map((c, i) => c === null ? i : -1).filter(i => i >= 0)
  if (empty.length === 0) return -1

  // Easy: mostly random
  if (difficulty === 1 && Math.random() < 0.6) {
    return empty[Math.floor(Math.random() * empty.length)]
  }

  // Medium: sometimes random
  if (difficulty === 2 && Math.random() < 0.25) {
    return empty[Math.floor(Math.random() * empty.length)]
  }

  // Hard: always optimal
  let bestVal = -Infinity, bestMove = empty[0]
  for (const i of empty) {
    b[i] = 'O'
    const val = minimax(b, false)
    b[i] = null
    if (val > bestVal) { bestVal = val; bestMove = i }
  }
  return bestMove
}

export default function TicTacToe() {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null))
  const [xTurn, setXTurn] = useState(true)
  const [status, setStatus] = useState<Status>('playing')
  const [winLine, setWinLine] = useState<number[] | null>(null)
  const [score, setScore] = useState({ player: 0, ai: 0, draw: 0 })
  const [difficulty, setDifficulty] = useState(2)
  const [aiThinking, setAiThinking] = useState(false)

  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get('difficulty')
    if (d === 'easy') setDifficulty(1)
    else if (d === 'hard') setDifficulty(3)
    else setDifficulty(2)
  }, [])

  // AI move
  useEffect(() => {
    if (xTurn || status !== 'playing') return
    setAiThinking(true)
    const timer = setTimeout(() => {
      const b = [...board]
      const move = getAiMove(b, difficulty)
      if (move >= 0) {
        const nb = [...board]
        nb[move] = 'O'
        setBoard(nb)
        const { winner, line } = checkWinner(nb)
        if (winner) {
          setStatus('win'); setWinLine(line)
          setScore(s => ({ ...s, ai: s.ai + 1 }))
        } else if (nb.every(c => c !== null)) {
          setStatus('draw')
          setScore(s => ({ ...s, draw: s.draw + 1 }))
        } else {
          setXTurn(true)
        }
      }
      setAiThinking(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [xTurn, board, status, difficulty])

  const handleClick = (i: number) => {
    if (board[i] || !xTurn || status !== 'playing' || aiThinking) return
    const nb = [...board]
    nb[i] = 'X'
    setBoard(nb)
    const { winner, line } = checkWinner(nb)
    if (winner) {
      setStatus('win'); setWinLine(line)
      setScore(s => ({ ...s, player: s.player + 1 }))
    } else if (nb.every(c => c !== null)) {
      setStatus('draw')
      setScore(s => ({ ...s, draw: s.draw + 1 }))
    } else {
      setXTurn(false)
    }
  }

  const reset = () => {
    setBoard(Array(9).fill(null)); setXTurn(true); setStatus('playing'); setWinLine(null)
  }

  const diffLabel = difficulty === 1 ? 'Easy' : difficulty === 3 ? 'Hard' : 'Medium'
  const { winner } = checkWinner(board)

  return (
    <div className="min-h-screen bg-brand-primary">
      <div className="sticky top-0 z-40 bg-brand-primary/95 backdrop-blur-md border-b border-[#eedfc8]/10 px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <Link href="/games" className="text-[#eedfc8]/70"><i className="ri-arrow-left-line text-xl" /></Link>
          <h1 className="text-[#eedfc8] font-bold text-sm">Tic Tac Toe ({diffLabel})</h1>
          <button onClick={reset} className="text-[#eedfc8]/70"><i className="ri-refresh-line text-xl" /></button>
        </div>
      </div>

      <div className="px-4 pt-6 max-w-sm mx-auto space-y-6">
        {/* Score */}
        <div className="flex justify-center gap-6 text-center">
          <div><p className="text-[#eedfc8] text-2xl font-bold">{score.player}</p><p className="text-[#eedfc8]/50 text-xs">You (X)</p></div>
          <div><p className="text-[#eedfc8]/50 text-2xl font-bold">{score.draw}</p><p className="text-[#eedfc8]/50 text-xs">Draw</p></div>
          <div><p className="text-brand-accent1 text-2xl font-bold">{score.ai}</p><p className="text-[#eedfc8]/50 text-xs">AI (O)</p></div>
        </div>

        {/* Status */}
        <div className="text-center">
          {status === 'playing' && (
            <p className="text-[#eedfc8]/70 text-sm">
              {aiThinking ? 'AI is thinking...' : 'Your turn (X)'}
            </p>
          )}
          {status === 'win' && (
            <p className={`font-bold text-lg ${winner === 'X' ? 'text-green-400' : 'text-brand-accent1'}`}>
              {winner === 'X' ? 'You Win!' : 'AI Wins!'}
            </p>
          )}
          {status === 'draw' && <p className="text-brand-accent2 font-bold text-lg">It&apos;s a Draw!</p>}
        </div>

        {/* Board */}
        <div className="grid grid-cols-3 gap-2 aspect-square max-w-[320px] mx-auto">
          {board.map((cell, i) => {
            const isWin = winLine?.includes(i)
            return (
              <button
                key={i}
                onClick={() => handleClick(i)}
                disabled={!!cell || status !== 'playing' || !xTurn}
                className={`aspect-square rounded-xl flex items-center justify-center text-4xl sm:text-5xl font-bold transition-all
                  ${!cell ? 'bg-[#eedfc8]/8 hover:bg-[#eedfc8]/15 active:scale-95' : 'bg-[#eedfc8]/5'}
                  ${isWin ? 'ring-2 ring-brand-accent2 bg-brand-accent2/10' : ''}
                  border border-[#eedfc8]/10
                `}
              >
                {cell === 'X' && <span className="text-[#eedfc8]">X</span>}
                {cell === 'O' && <span className="text-brand-accent1">O</span>}
              </button>
            )
          })}
        </div>

        {status !== 'playing' && (
          <div className="text-center">
            <button onClick={reset} className="btn-primary px-8 py-3">Play Again</button>
          </div>
        )}
      </div>
    </div>
  )
}
