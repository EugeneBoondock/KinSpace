export type GoPlayer = 'black' | 'white'
export type GoCell = GoPlayer | null
export type GoBoard = GoCell[][]
export type GoPoint = { row: number; col: number }

export function createBoard(size = 9): GoBoard {
  return Array.from({ length: size }, () => Array<GoCell>(size).fill(null))
}

function inBounds(board: GoBoard, point: GoPoint) {
  return point.row >= 0 && point.row < board.length && point.col >= 0 && point.col < board.length
}

function opponent(player: GoPlayer): GoPlayer {
  return player === 'black' ? 'white' : 'black'
}

function cloneBoard(board: GoBoard): GoBoard {
  return board.map((row) => [...row])
}

function neighbours(board: GoBoard, point: GoPoint): GoPoint[] {
  return [
    { row: point.row - 1, col: point.col },
    { row: point.row + 1, col: point.col },
    { row: point.row, col: point.col - 1 },
    { row: point.row, col: point.col + 1 },
  ].filter((next) => inBounds(board, next))
}

function key(point: GoPoint) {
  return `${point.row},${point.col}`
}

function groupAt(board: GoBoard, point: GoPoint) {
  const color = board[point.row]?.[point.col]
  const stones: GoPoint[] = []
  const liberties = new Set<string>()
  if (!color) return { color, stones, liberties }

  const seen = new Set<string>([key(point)])
  const stack = [point]
  while (stack.length > 0) {
    const current = stack.pop()!
    stones.push(current)
    for (const next of neighbours(board, current)) {
      const value = board[next.row][next.col]
      if (value === null) {
        liberties.add(key(next))
      } else if (value === color && !seen.has(key(next))) {
        seen.add(key(next))
        stack.push(next)
      }
    }
  }

  return { color, stones, liberties }
}

function removeGroup(board: GoBoard, stones: GoPoint[]) {
  for (const stone of stones) board[stone.row][stone.col] = null
}

export function getCapturesAfterMove(board: GoBoard, point: GoPoint, player: GoPlayer): GoPoint[] {
  const captured: GoPoint[] = []
  for (const next of neighbours(board, point)) {
    if (board[next.row][next.col] !== opponent(player)) continue
    const group = groupAt(board, next)
    if (group.liberties.size === 0) captured.push(...group.stones)
  }
  return captured
}

export function applyMove(board: GoBoard, point: GoPoint, player: GoPlayer): { board: GoBoard; captured: GoPoint[]; legal: boolean } {
  if (!inBounds(board, point) || board[point.row][point.col] !== null) {
    return { board, captured: [], legal: false }
  }

  const next = cloneBoard(board)
  next[point.row][point.col] = player
  const captured = getCapturesAfterMove(next, point, player)
  removeGroup(next, captured)

  const ownGroup = groupAt(next, point)
  if (ownGroup.liberties.size === 0) {
    return { board, captured: [], legal: false }
  }

  return { board: next, captured, legal: true }
}

export function getLegalMoves(board: GoBoard, player: GoPlayer): GoPoint[] {
  const moves: GoPoint[] = []
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      if (applyMove(board, { row, col }, player).legal) moves.push({ row, col })
    }
  }
  return moves
}

export function countStones(board: GoBoard) {
  let black = 0
  let white = 0
  for (const row of board) {
    for (const cell of row) {
      if (cell === 'black') black += 1
      if (cell === 'white') white += 1
    }
  }
  return { black, white }
}

export function chooseGoAiMove(board: GoBoard, player: GoPlayer): GoPoint | null {
  const legal = getLegalMoves(board, player)
  if (legal.length === 0) return null

  for (const move of legal) {
    const result = applyMove(board, move, player)
    if (result.captured.length > 0) return move
  }

  const center = Math.floor(board.length / 2)
  return legal.find((move) => move.row === center && move.col === center) ?? legal[Math.floor(legal.length / 2)]
}
