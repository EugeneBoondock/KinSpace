export type TTTCell = 'X' | 'O' | null
export type TTTBoard = TTTCell[]
export type TTTDifficulty = 'easy' | 'medium' | 'hard'

const WINS: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

export function emptyBoard(): TTTBoard {
  return Array(9).fill(null)
}

export function checkWinner(board: TTTBoard): { winner: TTTCell; line: number[] | null } {
  for (const line of WINS) {
    const [a, b, c] = line
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line }
    }
  }
  return { winner: null, line: null }
}

export function isDraw(board: TTTBoard) {
  return board.every((cell) => cell !== null) && !checkWinner(board).winner
}

export function availableMoves(board: TTTBoard) {
  return board.map((cell, index) => (cell === null ? index : -1)).filter((index) => index >= 0)
}

function minimax(board: TTTBoard, player: 'X' | 'O', ai: 'X' | 'O'): { score: number; move: number | null } {
  const { winner } = checkWinner(board)
  if (winner === ai) return { score: 10, move: null }
  if (winner && winner !== ai) return { score: -10, move: null }
  if (isDraw(board)) return { score: 0, move: null }

  const isAiTurn = player === ai
  const best: { score: number; move: number | null } = {
    score: isAiTurn ? -Infinity : Infinity,
    move: null,
  }

  for (const index of availableMoves(board)) {
    board[index] = player
    const { score } = minimax(board, player === 'X' ? 'O' : 'X', ai)
    board[index] = null
    const adjusted = score + (isAiTurn ? -1 : 1) * 0 // no depth bias; short boards
    if (isAiTurn ? adjusted > best.score : adjusted < best.score) {
      best.score = adjusted
      best.move = index
    }
  }

  return best
}

export function computeAiMove(board: TTTBoard, ai: 'X' | 'O', difficulty: TTTDifficulty = 'medium'): number | null {
  const moves = availableMoves(board)
  if (moves.length === 0) return null

  if (difficulty === 'easy') {
    return moves[Math.floor(Math.random() * moves.length)]
  }

  if (difficulty === 'medium' && Math.random() < 0.4) {
    return moves[Math.floor(Math.random() * moves.length)]
  }

  return minimax([...board], ai, ai).move ?? moves[0]
}
