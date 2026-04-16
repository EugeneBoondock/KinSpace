export type CheckersPiece = {
  color: 'red' | 'black'
  king: boolean
} | null

export type CheckersBoard = CheckersPiece[][]
export type CheckersColor = 'red' | 'black'
export type CheckersDifficulty = 'easy' | 'medium' | 'hard'

export type Move = {
  from: [number, number]
  to: [number, number]
  captures: Array<[number, number]>
}

export function initialBoard(): CheckersBoard {
  const board: CheckersBoard = Array.from({ length: 8 }, () => Array(8).fill(null))
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      if ((row + col) % 2 === 1) {
        if (row < 3) board[row][col] = { color: 'red', king: false }
        else if (row > 4) board[row][col] = { color: 'black', king: false }
      }
    }
  }
  return board
}

function cloneBoard(board: CheckersBoard): CheckersBoard {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)))
}

function dirsFor(piece: NonNullable<CheckersPiece>) {
  if (piece.king) return [[-1, -1], [-1, 1], [1, -1], [1, 1]]
  return piece.color === 'red' ? [[1, -1], [1, 1]] : [[-1, -1], [-1, 1]]
}

function inBounds(row: number, col: number) {
  return row >= 0 && row < 8 && col >= 0 && col < 8
}

export function movesForPiece(board: CheckersBoard, row: number, col: number): Move[] {
  const piece = board[row][col]
  if (!piece) return []

  const jumps: Move[] = []
  const steps: Move[] = []

  for (const [dr, dc] of dirsFor(piece)) {
    const sr = row + dr
    const sc = col + dc
    if (!inBounds(sr, sc)) continue
    if (board[sr][sc] === null) {
      steps.push({ from: [row, col], to: [sr, sc], captures: [] })
      continue
    }
    if (board[sr][sc]!.color !== piece.color) {
      const jr = row + dr * 2
      const jc = col + dc * 2
      if (inBounds(jr, jc) && board[jr][jc] === null) {
        jumps.push({ from: [row, col], to: [jr, jc], captures: [[sr, sc]] })
      }
    }
  }

  // Extend jumps with chains
  const chained: Move[] = []
  for (const jump of jumps) {
    const next = cloneBoard(board)
    next[jump.to[0]][jump.to[1]] = next[jump.from[0]][jump.from[1]]
    next[jump.from[0]][jump.from[1]] = null
    for (const [cr, cc] of jump.captures) next[cr][cc] = null
    const further = movesForPiece(next, jump.to[0], jump.to[1]).filter((move) => move.captures.length > 0)
    if (further.length === 0) {
      chained.push(jump)
    } else {
      for (const extension of further) {
        chained.push({
          from: jump.from,
          to: extension.to,
          captures: [...jump.captures, ...extension.captures],
        })
      }
    }
  }

  return chained.length > 0 ? chained : steps
}

export function allMovesFor(board: CheckersBoard, color: CheckersColor): Move[] {
  const all: Move[] = []
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row][col]
      if (piece && piece.color === color) {
        all.push(...movesForPiece(board, row, col))
      }
    }
  }
  // Jump mandatory rule
  const jumps = all.filter((move) => move.captures.length > 0)
  return jumps.length > 0 ? jumps : all
}

export function applyMove(board: CheckersBoard, move: Move): CheckersBoard {
  const next = cloneBoard(board)
  const piece = next[move.from[0]][move.from[1]]
  if (!piece) return next
  next[move.from[0]][move.from[1]] = null
  next[move.to[0]][move.to[1]] = piece
  for (const [cr, cc] of move.captures) next[cr][cc] = null
  if (!piece.king) {
    if (piece.color === 'red' && move.to[0] === 7) piece.king = true
    if (piece.color === 'black' && move.to[0] === 0) piece.king = true
  }
  return next
}

export function checkWinner(board: CheckersBoard): CheckersColor | null {
  let red = 0
  let black = 0
  for (const row of board) for (const cell of row) {
    if (!cell) continue
    if (cell.color === 'red') red += 1
    if (cell.color === 'black') black += 1
  }
  if (red === 0) return 'black'
  if (black === 0) return 'red'
  return null
}

function evaluate(board: CheckersBoard, color: CheckersColor) {
  let score = 0
  for (const row of board) for (const cell of row) {
    if (!cell) continue
    const value = cell.king ? 3 : 1
    score += cell.color === color ? value : -value
  }
  return score
}

function minimax(board: CheckersBoard, depth: number, color: CheckersColor, aiColor: CheckersColor, alpha: number, beta: number): { score: number; move: Move | null } {
  if (depth === 0 || checkWinner(board)) {
    return { score: evaluate(board, aiColor), move: null }
  }
  const moves = allMovesFor(board, color)
  if (moves.length === 0) return { score: evaluate(board, aiColor) - 50, move: null }

  let bestMove: Move | null = null
  if (color === aiColor) {
    let best = -Infinity
    for (const move of moves) {
      const next = applyMove(board, move)
      const { score } = minimax(next, depth - 1, color === 'red' ? 'black' : 'red', aiColor, alpha, beta)
      if (score > best) { best = score; bestMove = move }
      alpha = Math.max(alpha, best)
      if (beta <= alpha) break
    }
    return { score: best, move: bestMove }
  }
  let best = Infinity
  for (const move of moves) {
    const next = applyMove(board, move)
    const { score } = minimax(next, depth - 1, color === 'red' ? 'black' : 'red', aiColor, alpha, beta)
    if (score < best) { best = score; bestMove = move }
    beta = Math.min(beta, best)
    if (beta <= alpha) break
  }
  return { score: best, move: bestMove }
}

export function computeAiMove(board: CheckersBoard, aiColor: CheckersColor, difficulty: CheckersDifficulty = 'medium'): Move | null {
  const moves = allMovesFor(board, aiColor)
  if (moves.length === 0) return null
  const depth = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 3 : 5
  if (difficulty === 'easy' && Math.random() < 0.4) {
    return moves[Math.floor(Math.random() * moves.length)]
  }
  return minimax(board, depth, aiColor, aiColor, -Infinity, Infinity).move ?? moves[0]
}
