export type MsCell = {
  mine: boolean
  revealed: boolean
  flagged: boolean
  neighbors: number
}

export type MsGrid = MsCell[][]
export type MsDifficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTY_CONFIG: Record<MsDifficulty, { rows: number; cols: number; mines: number }> = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 12, cols: 12, mines: 20 },
  hard: { rows: 16, cols: 16, mines: 40 },
}

export function emptyGrid(rows: number, cols: number): MsGrid {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ mine: false, revealed: false, flagged: false, neighbors: 0 })),
  )
}

function countNeighbors(grid: MsGrid, row: number, col: number) {
  let total = 0
  for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
    if (dr === 0 && dc === 0) continue
    const nr = row + dr
    const nc = col + dc
    if (nr < 0 || nc < 0 || nr >= grid.length || nc >= grid[0].length) continue
    if (grid[nr][nc].mine) total += 1
  }
  return total
}

export function plantMines(grid: MsGrid, mineCount: number, safeRow: number, safeCol: number): MsGrid {
  const rows = grid.length
  const cols = grid[0].length
  const next = grid.map((row) => row.map((cell) => ({ ...cell })))
  const candidates: Array<[number, number]> = []
  for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
    if (Math.abs(row - safeRow) <= 1 && Math.abs(col - safeCol) <= 1) continue
    candidates.push([row, col])
  }
  for (let placed = 0; placed < mineCount && candidates.length > 0; placed += 1) {
    const index = Math.floor(Math.random() * candidates.length)
    const [r, c] = candidates.splice(index, 1)[0]
    next[r][c].mine = true
  }
  for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
    next[row][col].neighbors = countNeighbors(next, row, col)
  }
  return next
}

export function reveal(grid: MsGrid, row: number, col: number): { grid: MsGrid; exploded: boolean } {
  const next = grid.map((each) => each.map((cell) => ({ ...cell })))
  const cell = next[row][col]
  if (cell.flagged || cell.revealed) return { grid: next, exploded: false }
  if (cell.mine) {
    cell.revealed = true
    return { grid: next, exploded: true }
  }
  const stack: Array<[number, number]> = [[row, col]]
  while (stack.length > 0) {
    const [r, c] = stack.pop()!
    const current = next[r][c]
    if (current.revealed || current.flagged) continue
    current.revealed = true
    if (current.neighbors === 0 && !current.mine) {
      for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue
        const nr = r + dr
        const nc = c + dc
        if (nr < 0 || nc < 0 || nr >= next.length || nc >= next[0].length) continue
        if (!next[nr][nc].revealed && !next[nr][nc].mine) stack.push([nr, nc])
      }
    }
  }
  return { grid: next, exploded: false }
}

export function toggleFlag(grid: MsGrid, row: number, col: number): MsGrid {
  const next = grid.map((each) => each.map((cell) => ({ ...cell })))
  const cell = next[row][col]
  if (!cell.revealed) cell.flagged = !cell.flagged
  return next
}

export function hasWon(grid: MsGrid): boolean {
  for (const row of grid) for (const cell of row) {
    if (!cell.mine && !cell.revealed) return false
  }
  return true
}
