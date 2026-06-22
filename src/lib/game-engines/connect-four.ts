export type ConnectFourPlayer = 'red' | 'yellow'
export type ConnectFourCell = ConnectFourPlayer | null
export type ConnectFourBoard = ConnectFourCell[][]
export type ConnectFourMove = { board: ConnectFourBoard; row: number; col: number }
export type ConnectFourWin = { winner: ConnectFourPlayer | null; line: Array<[number, number]> | null }

export const CONNECT_FOUR_ROWS = 6
export const CONNECT_FOUR_COLUMNS = 7

const DIRECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
]

export function createBoard(): ConnectFourBoard {
  return Array.from({ length: CONNECT_FOUR_ROWS }, () => Array<ConnectFourCell>(CONNECT_FOUR_COLUMNS).fill(null))
}

export function cloneBoard(board: ConnectFourBoard): ConnectFourBoard {
  return board.map((row) => [...row])
}

export function nextPlayer(player: ConnectFourPlayer): ConnectFourPlayer {
  return player === 'red' ? 'yellow' : 'red'
}

export function getAvailableColumns(board: ConnectFourBoard): number[] {
  return Array.from({ length: CONNECT_FOUR_COLUMNS }, (_, column) => column).filter((column) => board[0][column] === null)
}

export function dropDisc(
  board: ConnectFourBoard,
  column: number,
  player: ConnectFourPlayer,
): ConnectFourMove | null {
  if (column < 0 || column >= CONNECT_FOUR_COLUMNS || board[0][column] !== null) return null

  const next = cloneBoard(board)
  for (let row = CONNECT_FOUR_ROWS - 1; row >= 0; row -= 1) {
    if (next[row][column] === null) {
      next[row][column] = player
      return { board: next, row, col: column }
    }
  }
  return null
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < CONNECT_FOUR_ROWS && col >= 0 && col < CONNECT_FOUR_COLUMNS
}

export function checkWinner(board: ConnectFourBoard): ConnectFourWin {
  for (let row = 0; row < CONNECT_FOUR_ROWS; row += 1) {
    for (let col = 0; col < CONNECT_FOUR_COLUMNS; col += 1) {
      const player = board[row][col]
      if (!player) continue

      for (const [rowStep, colStep] of DIRECTIONS) {
        const line: Array<[number, number]> = []
        for (let offset = 0; offset < 4; offset += 1) {
          const nextRow = row + rowStep * offset
          const nextCol = col + colStep * offset
          if (!inBounds(nextRow, nextCol) || board[nextRow][nextCol] !== player) break
          line.push([nextRow, nextCol])
        }
        if (line.length === 4) return { winner: player, line }
      }
    }
  }

  return { winner: null, line: null }
}

export function isBoardFull(board: ConnectFourBoard): boolean {
  return getAvailableColumns(board).length === 0
}

export function chooseConnectFourAiColumn(board: ConnectFourBoard, player: ConnectFourPlayer): number | null {
  const columns = getAvailableColumns(board)
  if (columns.length === 0) return null
  const opponent = nextPlayer(player)

  for (const column of columns) {
    const move = dropDisc(board, column, player)
    if (move && checkWinner(move.board).winner === player) return column
  }

  for (const column of columns) {
    const move = dropDisc(board, column, opponent)
    if (move && checkWinner(move.board).winner === opponent) return column
  }

  return [...columns].sort((first, second) => Math.abs(first - 3) - Math.abs(second - 3))[0]
}
