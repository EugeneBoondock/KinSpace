export type ReversiPlayer = 'black' | 'white'
export type ReversiCell = ReversiPlayer | null
export type ReversiBoard = ReversiCell[][]
export type ReversiMove = { row: number; col: number; flips?: Array<[number, number]> }

const SIZE = 8
const DIRECTIONS: Array<[number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
]

export function initialBoard(): ReversiBoard {
  const board = Array.from({ length: SIZE }, () => Array<ReversiCell>(SIZE).fill(null))
  board[3][3] = 'white'
  board[3][4] = 'black'
  board[4][3] = 'black'
  board[4][4] = 'white'
  return board
}

export function cloneBoard(board: ReversiBoard): ReversiBoard {
  return board.map((row) => [...row])
}

export function nextPlayer(player: ReversiPlayer): ReversiPlayer {
  return player === 'black' ? 'white' : 'black'
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE
}

function flipsForMove(board: ReversiBoard, row: number, col: number, player: ReversiPlayer): Array<[number, number]> {
  if (!inBounds(row, col) || board[row][col] !== null) return []
  const opponent = nextPlayer(player)
  const flips: Array<[number, number]> = []

  for (const [rowStep, colStep] of DIRECTIONS) {
    const line: Array<[number, number]> = []
    let nextRow = row + rowStep
    let nextCol = col + colStep

    while (inBounds(nextRow, nextCol) && board[nextRow][nextCol] === opponent) {
      line.push([nextRow, nextCol])
      nextRow += rowStep
      nextCol += colStep
    }

    if (line.length > 0 && inBounds(nextRow, nextCol) && board[nextRow][nextCol] === player) {
      flips.push(...line)
    }
  }

  return flips
}

export function getLegalMoves(board: ReversiBoard, player: ReversiPlayer): ReversiMove[] {
  const moves: ReversiMove[] = []
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const flips = flipsForMove(board, row, col, player)
      if (flips.length > 0) moves.push({ row, col, flips })
    }
  }
  return moves
}

export function applyMove(board: ReversiBoard, move: ReversiMove, player: ReversiPlayer): ReversiBoard {
  const flips = move.flips ?? flipsForMove(board, move.row, move.col, player)
  if (flips.length === 0) return board

  const next = cloneBoard(board)
  next[move.row][move.col] = player
  for (const [row, col] of flips) next[row][col] = player
  return next
}

export function countPieces(board: ReversiBoard): { black: number; white: number; empty: number } {
  const counts = { black: 0, white: 0, empty: 0 }
  for (const row of board) {
    for (const cell of row) {
      if (cell === 'black') counts.black += 1
      else if (cell === 'white') counts.white += 1
      else counts.empty += 1
    }
  }
  return counts
}

export function getWinner(board: ReversiBoard): ReversiPlayer | 'draw' | null {
  if (getLegalMoves(board, 'black').length > 0 || getLegalMoves(board, 'white').length > 0) return null
  const counts = countPieces(board)
  if (counts.black === counts.white) return 'draw'
  return counts.black > counts.white ? 'black' : 'white'
}

export function chooseReversiAiMove(board: ReversiBoard, player: ReversiPlayer): ReversiMove | null {
  const moves = getLegalMoves(board, player)
  if (moves.length === 0) return null
  return [...moves].sort((first, second) => (second.flips?.length ?? 0) - (first.flips?.length ?? 0))[0]
}
