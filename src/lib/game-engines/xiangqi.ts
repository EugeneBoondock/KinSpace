export type XiangqiColor = 'red' | 'black'
export type XiangqiPieceType = 'general' | 'advisor' | 'elephant' | 'horse' | 'chariot' | 'cannon' | 'soldier'
export type XiangqiPiece = { color: XiangqiColor; type: XiangqiPieceType }
export type XiangqiCell = XiangqiPiece | null
export type XiangqiBoard = XiangqiCell[][]
export type XiangqiPoint = { row: number; col: number }

export function createInitialBoard(): XiangqiBoard {
  const board: XiangqiBoard = Array.from({ length: 10 }, () => Array<XiangqiCell>(9).fill(null))
  const back: XiangqiPieceType[] = ['chariot', 'horse', 'elephant', 'advisor', 'general', 'advisor', 'elephant', 'horse', 'chariot']
  for (let col = 0; col < 9; col += 1) {
    board[0][col] = { color: 'black', type: back[col] }
    board[9][col] = { color: 'red', type: back[col] }
  }
  board[2][1] = { color: 'black', type: 'cannon' }
  board[2][7] = { color: 'black', type: 'cannon' }
  board[7][1] = { color: 'red', type: 'cannon' }
  board[7][7] = { color: 'red', type: 'cannon' }
  for (const col of [0, 2, 4, 6, 8]) {
    board[3][col] = { color: 'black', type: 'soldier' }
    board[6][col] = { color: 'red', type: 'soldier' }
  }
  return board
}

function cloneBoard(board: XiangqiBoard): XiangqiBoard {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)))
}

function inBounds(point: XiangqiPoint) {
  return point.row >= 0 && point.row < 10 && point.col >= 0 && point.col < 9
}

function sameSide(piece: XiangqiPiece, target: XiangqiCell) {
  return Boolean(target && target.color === piece.color)
}

function maybeAdd(board: XiangqiBoard, piece: XiangqiPiece, moves: XiangqiPoint[], point: XiangqiPoint) {
  if (!inBounds(point)) return
  if (sameSide(piece, board[point.row][point.col])) return
  moves.push(point)
}

function palaceContains(color: XiangqiColor, point: XiangqiPoint) {
  const rows = color === 'red' ? [7, 8, 9] : [0, 1, 2]
  return rows.includes(point.row) && point.col >= 3 && point.col <= 5
}

function crossedRiver(color: XiangqiColor, row: number) {
  return color === 'red' ? row <= 4 : row >= 5
}

function lineMoves(board: XiangqiBoard, point: XiangqiPoint, piece: XiangqiPiece, cannon = false) {
  const moves: XiangqiPoint[] = []
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  for (const [dr, dc] of dirs) {
    let row = point.row + dr
    let col = point.col + dc
    let screenSeen = false
    while (inBounds({ row, col })) {
      const target = board[row][col]
      if (!cannon) {
        if (!target) moves.push({ row, col })
        else {
          if (target.color !== piece.color) moves.push({ row, col })
          break
        }
      } else if (!screenSeen) {
        if (!target) moves.push({ row, col })
        else screenSeen = true
      } else if (target) {
        if (target.color !== piece.color) moves.push({ row, col })
        break
      }
      row += dr
      col += dc
    }
  }
  return moves
}

export function getLegalMovesForPiece(board: XiangqiBoard, point: XiangqiPoint): XiangqiPoint[] {
  const piece = board[point.row]?.[point.col]
  if (!piece) return []

  if (piece.type === 'chariot') return lineMoves(board, point, piece)
  if (piece.type === 'cannon') return lineMoves(board, point, piece, true)

  const moves: XiangqiPoint[] = []
  if (piece.type === 'soldier') {
    const forward = piece.color === 'red' ? -1 : 1
    maybeAdd(board, piece, moves, { row: point.row + forward, col: point.col })
    if (crossedRiver(piece.color, point.row)) {
      maybeAdd(board, piece, moves, { row: point.row, col: point.col - 1 })
      maybeAdd(board, piece, moves, { row: point.row, col: point.col + 1 })
    }
    return moves
  }

  if (piece.type === 'general') {
    for (const next of [
      { row: point.row + 1, col: point.col },
      { row: point.row - 1, col: point.col },
      { row: point.row, col: point.col + 1 },
      { row: point.row, col: point.col - 1 },
    ]) {
      if (palaceContains(piece.color, next)) maybeAdd(board, piece, moves, next)
    }
    return moves
  }

  if (piece.type === 'advisor') {
    for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const next = { row: point.row + dr, col: point.col + dc }
      if (palaceContains(piece.color, next)) maybeAdd(board, piece, moves, next)
    }
    return moves
  }

  if (piece.type === 'elephant') {
    for (const [dr, dc] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) {
      const eye = { row: point.row + dr / 2, col: point.col + dc / 2 }
      const next = { row: point.row + dr, col: point.col + dc }
      const riverOk = piece.color === 'red' ? next.row >= 5 : next.row <= 4
      if (riverOk && inBounds(eye) && !board[eye.row][eye.col]) maybeAdd(board, piece, moves, next)
    }
    return moves
  }

  if (piece.type === 'horse') {
    const jumps = [
      { move: { row: -2, col: -1 }, leg: { row: -1, col: 0 } },
      { move: { row: -2, col: 1 }, leg: { row: -1, col: 0 } },
      { move: { row: 2, col: -1 }, leg: { row: 1, col: 0 } },
      { move: { row: 2, col: 1 }, leg: { row: 1, col: 0 } },
      { move: { row: -1, col: -2 }, leg: { row: 0, col: -1 } },
      { move: { row: 1, col: -2 }, leg: { row: 0, col: -1 } },
      { move: { row: -1, col: 2 }, leg: { row: 0, col: 1 } },
      { move: { row: 1, col: 2 }, leg: { row: 0, col: 1 } },
    ]
    for (const jump of jumps) {
      const leg = { row: point.row + jump.leg.row, col: point.col + jump.leg.col }
      if (inBounds(leg) && board[leg.row][leg.col]) continue
      maybeAdd(board, piece, moves, { row: point.row + jump.move.row, col: point.col + jump.move.col })
    }
  }

  return moves
}

export function applyMove(board: XiangqiBoard, from: XiangqiPoint, to: XiangqiPoint): XiangqiBoard {
  const piece = board[from.row]?.[from.col]
  if (!piece) return board
  if (!getLegalMovesForPiece(board, from).some((move) => move.row === to.row && move.col === to.col)) return board
  const next = cloneBoard(board)
  next[to.row][to.col] = next[from.row][from.col]
  next[from.row][from.col] = null
  return next
}

export function getAllMoves(board: XiangqiBoard, color: XiangqiColor) {
  const moves: Array<{ from: XiangqiPoint; to: XiangqiPoint }> = []
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const piece = board[row][col]
      if (piece?.color !== color) continue
      for (const to of getLegalMovesForPiece(board, { row, col })) moves.push({ from: { row, col }, to })
    }
  }
  return moves
}

export function chooseXiangqiAiMove(board: XiangqiBoard, color: XiangqiColor) {
  const moves = getAllMoves(board, color)
  return moves.find((move) => board[move.to.row][move.to.col]?.color !== color && board[move.to.row][move.to.col]) ?? moves[0] ?? null
}

export function getWinner(board: XiangqiBoard): XiangqiColor | null {
  let red = false
  let black = false
  for (const row of board) {
    for (const piece of row) {
      if (piece?.type === 'general' && piece.color === 'red') red = true
      if (piece?.type === 'general' && piece.color === 'black') black = true
    }
  }
  if (!red) return 'black'
  if (!black) return 'red'
  return null
}
