export type GomokuPlayer = 'black' | 'white'
export type GomokuCell = GomokuPlayer | null
export type GomokuBoard = GomokuCell[][]
export type GomokuPoint = { row: number; col: number }

export function createBoard(size = 15): GomokuBoard {
  return Array.from({ length: size }, () => Array<GomokuCell>(size).fill(null))
}

function inBounds(board: GomokuBoard, point: GomokuPoint) {
  return point.row >= 0 && point.row < board.length && point.col >= 0 && point.col < board.length
}

export function applyMove(board: GomokuBoard, point: GomokuPoint, player: GomokuPlayer): GomokuBoard {
  if (!inBounds(board, point) || board[point.row][point.col] !== null) return board
  const next = board.map((row) => [...row])
  next[point.row][point.col] = player
  return next
}

export function checkWinner(board: GomokuBoard): { winner: GomokuPlayer | 'draw' | null; line: GomokuPoint[] } {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      const player = board[row][col]
      if (!player) continue
      for (const [dr, dc] of directions) {
        const line = Array.from({ length: 5 }, (_, index) => ({ row: row + dr * index, col: col + dc * index }))
        if (line.every((point) => inBounds(board, point) && board[point.row][point.col] === player)) {
          return { winner: player, line }
        }
      }
    }
  }

  const full = board.every((line) => line.every(Boolean))
  return { winner: full ? 'draw' : null, line: [] }
}

export function getLegalMoves(board: GomokuBoard): GomokuPoint[] {
  const moves: GomokuPoint[] = []
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      if (!board[row][col]) moves.push({ row, col })
    }
  }
  return moves
}

function opponent(player: GomokuPlayer): GomokuPlayer {
  return player === 'black' ? 'white' : 'black'
}

export function chooseGomokuAiMove(board: GomokuBoard, player: GomokuPlayer): GomokuPoint | null {
  const legal = getLegalMoves(board)
  if (legal.length === 0) return null

  for (const move of legal) {
    if (checkWinner(applyMove(board, move, player)).winner === player) return move
  }
  for (const move of legal) {
    if (checkWinner(applyMove(board, move, opponent(player))).winner === opponent(player)) return move
  }

  const center = Math.floor(board.length / 2)
  return legal.find((move) => move.row === center && move.col === center) ?? legal[0]
}
