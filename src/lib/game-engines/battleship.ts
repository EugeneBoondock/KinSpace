export type BattleShot = 'hit' | 'miss' | null
export type BattlePoint = { row: number; col: number }
export type BattleShip = { name: string; cells: BattlePoint[] }
export type BattleBoard = {
  size: number
  ships: BattleShip[]
  shots: BattleShot[][]
}

export function createFleetBoard(size = 8): BattleBoard {
  const ships: BattleShip[] = [
    { name: 'Carrier', cells: [0, 1, 2].map((col) => ({ row: 1, col })) },
    { name: 'Cruiser', cells: [4, 5, 6].map((row) => ({ row, col: 5 })) },
    { name: 'Skiff', cells: [5, 6].map((col) => ({ row: 6, col })) },
  ]
  return {
    size,
    ships,
    shots: Array.from({ length: size }, () => Array<BattleShot>(size).fill(null)),
  }
}

function cloneBoard(board: BattleBoard): BattleBoard {
  return {
    size: board.size,
    ships: board.ships.map((ship) => ({ ...ship, cells: ship.cells.map((cell) => ({ ...cell })) })),
    shots: board.shots.map((row) => [...row]),
  }
}

function inBounds(board: BattleBoard, point: BattlePoint) {
  return point.row >= 0 && point.row < board.size && point.col >= 0 && point.col < board.size
}

function shipAt(board: BattleBoard, point: BattlePoint) {
  return board.ships.find((ship) => ship.cells.some((cell) => cell.row === point.row && cell.col === point.col)) ?? null
}

export function attackCell(board: BattleBoard, point: BattlePoint): { board: BattleBoard; hit: boolean; sunk: string | null; legal: boolean } {
  if (!inBounds(board, point) || board.shots[point.row][point.col]) {
    return { board, hit: false, sunk: null, legal: false }
  }
  const next = cloneBoard(board)
  const ship = shipAt(next, point)
  next.shots[point.row][point.col] = ship ? 'hit' : 'miss'

  const sunk = ship && ship.cells.every((cell) => next.shots[cell.row][cell.col] === 'hit') ? ship.name : null
  return { board: next, hit: Boolean(ship), sunk, legal: true }
}

export function hasShipsRemaining(board: BattleBoard) {
  return board.ships.some((ship) => ship.cells.some((cell) => board.shots[cell.row][cell.col] !== 'hit'))
}

export function chooseBattleshipAiShot(board: BattleBoard): BattlePoint | null {
  for (let row = 0; row < board.size; row += 1) {
    for (let col = 0; col < board.size; col += 1) {
      if (!board.shots[row][col]) return { row, col }
    }
  }
  return null
}
