'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type Piece = 'k' | 'q' | 'r' | 'b' | 'n' | 'p' | 'K' | 'Q' | 'R' | 'B' | 'N' | 'P' | null

const PIECE_SYMBOLS: Record<string, string> = {
  K: '\u2654', Q: '\u2655', R: '\u2656', B: '\u2657', N: '\u2658', P: '\u2659',
  k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F',
}

const PIECE_VALUES: Record<string, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 100,
  P: -1, N: -3, B: -3, R: -5, Q: -9, K: -100,
}

// --- Pure game logic (no hooks) ---
function parseFEN(fen: string): Piece[][] {
  const board: Piece[][] = Array(8).fill(null).map(() => Array(8).fill(null))
  const rows = fen.split('/')
  for (let r = 0; r < 8; r++) {
    let c = 0
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') c += parseInt(ch)
      else { board[r][c] = ch as Piece; c++ }
    }
  }
  return board
}

function boardToFEN(board: Piece[][]): string {
  return board.map(row => {
    let s = '', e = 0
    for (const p of row) {
      if (p) { if (e) { s += e; e = 0 }; s += p } else e++
    }
    if (e) s += e
    return s
  }).join('/')
}

function sq(r: number, c: number) { return String.fromCharCode(97 + c) + (8 - r) }
function rc(s: string): [number, number] { return [8 - parseInt(s[1]), s.charCodeAt(0) - 97] }

function isWhite(p: Piece) { return p !== null && p === p.toUpperCase() }
function sameColor(a: Piece, b: Piece) { return a !== null && b !== null && isWhite(a) === isWhite(b) }

function pathClear(fr: number, fc: number, tr: number, tc: number, board: Piece[][]) {
  const dr = Math.sign(tr - fr), dc = Math.sign(tc - fc)
  let r = fr + dr, c = fc + dc
  while (r !== tr || c !== tc) { if (board[r][c]) return false; r += dr; c += dc }
  return true
}

function canMove(from: string, to: string, board: Piece[][], white: boolean): boolean {
  const [fr, fc] = rc(from), [tr, tc] = rc(to)
  const p = board[fr][fc]
  if (!p || isWhite(p) !== white) return false
  if (sameColor(p, board[tr][tc])) return false
  const dr = tr - fr, dc = tc - fc, adr = Math.abs(dr), adc = Math.abs(dc)

  switch (p.toLowerCase()) {
    case 'p': {
      const dir = isWhite(p) ? -1 : 1, start = isWhite(p) ? 6 : 1
      if (dc === 0 && dr === dir && !board[tr][tc]) return true
      if (dc === 0 && fr === start && dr === 2 * dir && !board[tr][tc] && !board[fr + dir][fc]) return true
      if (adc === 1 && dr === dir && board[tr][tc]) return true
      return false
    }
    case 'r': return (dr === 0 || dc === 0) && pathClear(fr, fc, tr, tc, board)
    case 'n': return (adr === 2 && adc === 1) || (adr === 1 && adc === 2)
    case 'b': return adr === adc && adr > 0 && pathClear(fr, fc, tr, tc, board)
    case 'q': return ((dr === 0 || dc === 0) || (adr === adc)) && (adr + adc > 0) && pathClear(fr, fc, tr, tc, board)
    case 'k': return adr <= 1 && adc <= 1 && (adr + adc > 0)
    default: return false
  }
}

function getValidSquares(from: string, board: Piece[][], white: boolean): string[] {
  const moves: string[] = []
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const to = sq(r, c)
    if (canMove(from, to, board, white)) moves.push(to)
  }
  return moves
}

function allMoves(board: Piece[][], white: boolean) {
  const moves: { from: string; to: string }[] = []
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c]
    if (p && isWhite(p) === white) {
      const f = sq(r, c)
      for (const t of getValidSquares(f, board, white)) moves.push({ from: f, to: t })
    }
  }
  return moves
}

function applyMove(board: Piece[][], from: string, to: string): Piece[][] {
  const nb = board.map(r => [...r])
  const [fr, fc] = rc(from), [tr, tc] = rc(to)
  const p = nb[fr][fc]
  nb[tr][tc] = p
  nb[fr][fc] = null
  // Pawn promotion
  if (p?.toLowerCase() === 'p' && (tr === 0 || tr === 7)) {
    nb[tr][tc] = isWhite(p) ? 'Q' : 'q'
  }
  return nb
}

function evaluate(board: Piece[][]) {
  let score = 0
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c]
    if (p) score += PIECE_VALUES[p] || 0
  }
  return score
}

function minimax(board: Piece[][], depth: number, maximizing: boolean, alpha: number, beta: number): number {
  if (depth === 0) return evaluate(board)
  const moves = allMoves(board, maximizing)
  if (moves.length === 0) return maximizing ? -999 : 999
  if (maximizing) {
    let best = -Infinity
    for (const m of moves) {
      best = Math.max(best, minimax(applyMove(board, m.from, m.to), depth - 1, false, alpha, beta))
      alpha = Math.max(alpha, best)
      if (beta <= alpha) break
    }
    return best
  } else {
    let best = Infinity
    for (const m of moves) {
      best = Math.min(best, minimax(applyMove(board, m.from, m.to), depth - 1, true, alpha, beta))
      beta = Math.min(beta, best)
      if (beta <= alpha) break
    }
    return best
  }
}

function getDifficultyFromParam(value: string | null) {
  if (value === 'easy') return 1
  if (value === 'hard') return 3
  return 2
}

// --- Component ---
export default function ChessGame() {
  const searchParams = useSearchParams()
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')
  const [whitesTurn, setWhitesTurn] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [valid, setValid] = useState<string[]>([])
  const [moves, setMoves] = useState<string[]>([])
  const [status, setStatus] = useState<'playing' | 'checkmate' | 'stalemate'>('playing')
  const [captured, setCaptured] = useState<{ white: string[]; black: string[] }>({ white: [], black: [] })
  const difficulty = getDifficultyFromParam(searchParams.get('difficulty'))
  const aiThinking = !whitesTurn && status === 'playing'

  const board = parseFEN(fen)

  const doMove = useCallback((from: string, to: string) => {
    const b = parseFEN(fen)
    const [tr, tc] = rc(to)
    const cap = b[tr][tc]
    const nb = applyMove(b, from, to)
    setFen(boardToFEN(nb))

    if (cap) {
      setCaptured(prev => {
        const key = isWhite(cap) ? 'white' : 'black'
        return { ...prev, [key]: [...prev[key], PIECE_SYMBOLS[cap] || ''] }
      })
    }

    setMoves(prev => [...prev, `${from}${to}`])
    setWhitesTurn(w => !w)
    setSelected(null)
    setValid([])

    // Check game end
    const nextWhite = !whitesTurn
    const nextMoves = allMoves(nb, nextWhite)
    if (nextMoves.length === 0) {
      setStatus('checkmate')
    }
  }, [fen, whitesTurn])

  // AI move
  useEffect(() => {
    if (whitesTurn || status !== 'playing') return
    const timer = setTimeout(() => {
      const b = parseFEN(fen)
      const mvs = allMoves(b, false) // black = AI
      if (mvs.length === 0) {
        setStatus('stalemate')
        return
      }

      let best = mvs[0], bestVal = -Infinity
      if (difficulty === 1 && Math.random() < 0.4) {
        best = mvs[Math.floor(Math.random() * mvs.length)]
      } else {
        for (const m of mvs) {
          const v = minimax(applyMove(b, m.from, m.to), difficulty, false, -Infinity, Infinity)
          if (v > bestVal) { bestVal = v; best = m }
        }
      }
      doMove(best.from, best.to)
    }, 600)
    return () => clearTimeout(timer)
  }, [whitesTurn, fen, status, difficulty, doMove])

  const handleClick = (r: number, c: number) => {
    if (status !== 'playing' || !whitesTurn || aiThinking) return
    const s = sq(r, c)
    const p = board[r][c]

    if (selected) {
      if (valid.includes(s)) {
        doMove(selected, s)
      } else if (p && isWhite(p)) {
        setSelected(s)
        setValid(getValidSquares(s, board, true))
      } else {
        setSelected(null); setValid([])
      }
    } else if (p && isWhite(p)) {
      setSelected(s)
      setValid(getValidSquares(s, board, true))
    }
  }

  const reset = () => {
    setFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')
    setWhitesTurn(true); setSelected(null); setValid([]); setMoves([])
    setStatus('playing'); setCaptured({ white: [], black: [] })
  }

  const diffLabel = difficulty === 1 ? 'Easy' : difficulty === 3 ? 'Hard' : 'Medium'

  return (
    <div className="min-h-screen bg-brand-primary">
      <div className="sticky top-0 z-40 bg-brand-primary/95 backdrop-blur-md border-b border-[#eedfc8]/10 px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <Link href="/games" className="text-[#eedfc8]/70 hover:text-[#eedfc8]"><i className="ri-arrow-left-line text-xl" /></Link>
          <h1 className="text-[#eedfc8] font-bold">Chess vs AI ({diffLabel})</h1>
          <button onClick={reset} className="text-[#eedfc8]/70 hover:text-[#eedfc8]"><i className="ri-refresh-line text-xl" /></button>
        </div>
      </div>

      <div className="px-4 pt-4 max-w-md mx-auto space-y-4">
        {/* AI info */}
        <div className="card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#eedfc8]/10 rounded-lg flex items-center justify-center text-lg">&#x1F916;</div>
            <div>
              <p className="text-[#eedfc8] font-semibold text-sm">AI ({diffLabel})</p>
              <p className="text-[#eedfc8]/40 text-xs">Black pieces</p>
            </div>
          </div>
          <div className="text-xs text-[#eedfc8]/50">{captured.black.join(' ')}</div>
          {!whitesTurn && status === 'playing' && <div className="w-2 h-2 bg-brand-accent2 rounded-full pulse-dot" />}
        </div>

        {/* Board */}
        <div className="aspect-square w-full max-w-[min(100%,400px)] mx-auto">
          <div className="grid grid-cols-8 gap-0 rounded-lg overflow-hidden border-2 border-[#eedfc8]/20">
            {board.map((row, r) => row.map((piece, c) => {
              const s = sq(r, c)
              const light = (r + c) % 2 === 0
              const isSel = selected === s
              const isValid = valid.includes(s)
              return (
                <button
                  key={s}
                  onClick={() => handleClick(r, c)}
                  className={`aspect-square flex items-center justify-center text-[clamp(1.2rem,5vw,2.2rem)] transition-all relative
                    ${light ? 'bg-[#eedfc8]' : 'bg-brand-accent3'}
                    ${isSel ? 'ring-2 ring-brand-accent2 ring-inset z-10' : ''}
                    ${isValid ? 'after:absolute after:w-[30%] after:h-[30%] after:rounded-full after:bg-brand-accent2/40' : ''}
                    ${isValid && piece ? 'ring-2 ring-brand-accent1/60 ring-inset' : ''}
                  `}
                >
                  {piece && <span className={isWhite(piece) ? 'drop-shadow-sm' : 'drop-shadow-sm'}>{PIECE_SYMBOLS[piece]}</span>}
                </button>
              )
            }))}
          </div>
        </div>

        {/* Player info */}
        <div className="card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-accent2/20 rounded-lg flex items-center justify-center text-[#eedfc8] font-bold text-sm">You</div>
            <div>
              <p className="text-[#eedfc8] font-semibold text-sm">You</p>
              <p className="text-[#eedfc8]/40 text-xs">White pieces</p>
            </div>
          </div>
          <div className="text-xs text-[#eedfc8]/50">{captured.white.join(' ')}</div>
          {whitesTurn && status === 'playing' && <div className="w-2 h-2 bg-green-400 rounded-full pulse-dot" />}
        </div>

        {/* Status */}
        {status !== 'playing' && (
          <div className="card text-center">
            <p className="text-brand-accent2 font-bold text-lg mb-2">
              {status === 'checkmate' ? (whitesTurn ? 'AI Wins!' : 'You Win!') : 'Stalemate!'}
            </p>
            <button onClick={reset} className="btn-primary">Play Again</button>
          </div>
        )}

        {aiThinking && (
          <div className="text-center text-[#eedfc8]/50 text-sm flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-[#eedfc8]/20 border-t-[#eedfc8]/60 rounded-full animate-spin" />
            AI is thinking...
          </div>
        )}

        {/* Move history */}
        <div className="card">
          <h3 className="text-[#eedfc8]/70 text-xs font-semibold mb-2">MOVES ({moves.length})</h3>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {moves.length === 0 ? <span className="text-[#eedfc8]/30 text-xs">No moves yet</span> : moves.map((m, i) => (
              <span key={i} className="text-[10px] font-mono text-[#eedfc8]/60 bg-[#eedfc8]/5 px-1.5 py-0.5 rounded">
                {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ''}{m}
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pb-8">
          <button onClick={reset} className="flex-1 btn-secondary text-sm">New Game</button>
          <button onClick={() => setStatus('checkmate')} className="flex-1 btn-accent text-sm">Resign</button>
        </div>
      </div>
    </div>
  )
}
