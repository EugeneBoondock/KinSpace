export type DotsPlayer = 'player1' | 'player2'
export type DotsLine = { orientation: 'h' | 'v'; row: number; col: number }

export type DotsState = {
  rows: number
  cols: number
  horizontal: boolean[][]
  vertical: boolean[][]
  boxes: Array<Array<DotsPlayer | null>>
  scores: Record<DotsPlayer, number>
}

export function createState(rows = 4, cols = 4): DotsState {
  return {
    rows,
    cols,
    horizontal: Array.from({ length: rows + 1 }, () => Array(cols).fill(false)),
    vertical: Array.from({ length: rows }, () => Array(cols + 1).fill(false)),
    boxes: Array.from({ length: rows }, () => Array<DotsPlayer | null>(cols).fill(null)),
    scores: { player1: 0, player2: 0 },
  }
}

function cloneState(state: DotsState): DotsState {
  return {
    ...state,
    horizontal: state.horizontal.map((row) => [...row]),
    vertical: state.vertical.map((row) => [...row]),
    boxes: state.boxes.map((row) => [...row]),
    scores: { ...state.scores },
  }
}

function hasLine(state: DotsState, line: DotsLine) {
  return line.orientation === 'h'
    ? Boolean(state.horizontal[line.row]?.[line.col])
    : Boolean(state.vertical[line.row]?.[line.col])
}

function setLine(state: DotsState, line: DotsLine) {
  if (line.orientation === 'h') state.horizontal[line.row][line.col] = true
  else state.vertical[line.row][line.col] = true
}

function boxClosed(state: DotsState, row: number, col: number) {
  return (
    state.horizontal[row][col] &&
    state.horizontal[row + 1][col] &&
    state.vertical[row][col] &&
    state.vertical[row][col + 1]
  )
}

function candidateBoxes(state: DotsState, line: DotsLine) {
  if (line.orientation === 'h') {
    return [
      { row: line.row - 1, col: line.col },
      { row: line.row, col: line.col },
    ].filter((box) => box.row >= 0 && box.row < state.rows)
  }
  return [
    { row: line.row, col: line.col - 1 },
    { row: line.row, col: line.col },
  ].filter((box) => box.col >= 0 && box.col < state.cols)
}

export function drawLine(state: DotsState, line: DotsLine, player: DotsPlayer): { state: DotsState; scored: number; legal: boolean } {
  if (hasLine(state, line)) return { state, scored: 0, legal: false }
  const next = cloneState(state)
  setLine(next, line)

  let scored = 0
  for (const box of candidateBoxes(next, line)) {
    if (!next.boxes[box.row][box.col] && boxClosed(next, box.row, box.col)) {
      next.boxes[box.row][box.col] = player
      next.scores[player] += 1
      scored += 1
    }
  }

  return { state: next, scored, legal: true }
}

export function getAvailableLines(state: DotsState): DotsLine[] {
  const lines: DotsLine[] = []
  for (let row = 0; row < state.horizontal.length; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      if (!state.horizontal[row][col]) lines.push({ orientation: 'h', row, col })
    }
  }
  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.vertical[row].length; col += 1) {
      if (!state.vertical[row][col]) lines.push({ orientation: 'v', row, col })
    }
  }
  return lines
}

export function chooseDotsAiLine(state: DotsState, player: DotsPlayer): DotsLine | null {
  const lines = getAvailableLines(state)
  return lines.find((line) => drawLine(state, line, player).scored > 0) ?? lines[0] ?? null
}

export function getWinner(state: DotsState): DotsPlayer | 'draw' | null {
  if (getAvailableLines(state).length > 0) return null
  if (state.scores.player1 === state.scores.player2) return 'draw'
  return state.scores.player1 > state.scores.player2 ? 'player1' : 'player2'
}
