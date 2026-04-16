export type Tile = number // 0 = empty
export type Grid = Tile[][]
export type Direction = 'up' | 'down' | 'left' | 'right'

export const SIZE = 4

export function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0))
}

export function addRandomTile(grid: Grid): Grid {
  const empty: Array<[number, number]> = []
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (grid[row][col] === 0) empty.push([row, col])
    }
  }
  if (empty.length === 0) return grid
  const [r, c] = empty[Math.floor(Math.random() * empty.length)]
  const next = grid.map((row) => [...row])
  next[r][c] = Math.random() < 0.9 ? 2 : 4
  return next
}

export function initialGrid(): Grid {
  return addRandomTile(addRandomTile(emptyGrid()))
}

function slideRow(row: number[]): { row: number[]; gained: number } {
  const compact = row.filter((value) => value !== 0)
  const result: number[] = []
  let gained = 0
  let index = 0
  while (index < compact.length) {
    if (index + 1 < compact.length && compact[index] === compact[index + 1]) {
      const merged = compact[index] * 2
      result.push(merged)
      gained += merged
      index += 2
    } else {
      result.push(compact[index])
      index += 1
    }
  }
  while (result.length < SIZE) result.push(0)
  return { row: result, gained }
}

function transpose(grid: Grid): Grid {
  const next = emptyGrid()
  for (let row = 0; row < SIZE; row += 1) for (let col = 0; col < SIZE; col += 1) next[col][row] = grid[row][col]
  return next
}

function reverse(grid: Grid): Grid {
  return grid.map((row) => [...row].reverse())
}

export function move(grid: Grid, direction: Direction): { grid: Grid; gained: number; moved: boolean } {
  let working = grid
  if (direction === 'up') working = transpose(working)
  if (direction === 'down') working = transpose(reverse(transpose(reverse(working))))
  if (direction === 'right') working = reverse(working)

  let gained = 0
  const next: Grid = working.map((row) => {
    const slid = slideRow(row)
    gained += slid.gained
    return slid.row
  })

  let result = next
  if (direction === 'up') result = transpose(result)
  if (direction === 'down') result = transpose(reverse(transpose(reverse(result))))
  if (direction === 'right') result = reverse(result)

  const moved = JSON.stringify(result) !== JSON.stringify(grid)
  return { grid: result, gained, moved }
}

export function isGameOver(grid: Grid): boolean {
  for (let row = 0; row < SIZE; row += 1) for (let col = 0; col < SIZE; col += 1) {
    if (grid[row][col] === 0) return false
    if (col + 1 < SIZE && grid[row][col] === grid[row][col + 1]) return false
    if (row + 1 < SIZE && grid[row][col] === grid[row + 1][col]) return false
  }
  return true
}

export function hasWon(grid: Grid): boolean {
  for (const row of grid) for (const cell of row) if (cell >= 2048) return true
  return false
}
