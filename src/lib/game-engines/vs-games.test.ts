import assert from 'node:assert/strict'
import test from 'node:test'
import {
  checkWinner as checkConnectFourWinner,
  createBoard as createConnectFourBoard,
  dropDisc,
  getAvailableColumns,
} from './connect-four'
import {
  applyMove as applyReversiMove,
  countPieces,
  getLegalMoves,
  getWinner as getReversiWinner,
  initialBoard as initialReversiBoard,
} from './reversi'
import {
  compareMoves,
  createRound,
  revealRound,
  type RpsMove,
} from './rock-paper-scissors'
import {
  applyMove as applyGoMove,
  createBoard as createGoBoard,
  getCapturesAfterMove,
  getLegalMoves as getGoLegalMoves,
} from './go'
import {
  applyMove as applyXiangqiMove,
  createInitialBoard as createXiangqiBoard,
  getLegalMovesForPiece as getXiangqiLegalMoves,
} from './xiangqi'
import {
  applyMove as applyGomokuMove,
  checkWinner as checkGomokuWinner,
  createBoard as createGomokuBoard,
} from './gomoku'
import {
  createState as createDotsState,
  drawLine as drawDotsLine,
} from './dots-and-boxes'
import {
  attackCell,
  createFleetBoard,
  hasShipsRemaining,
} from './battleship'

test('connect four drops discs into the lowest open row and detects a horizontal win', () => {
  let board = createConnectFourBoard()

  for (const column of [0, 0, 1, 1, 2, 2, 3]) {
    const player = column === 3 ? 'red' : column < 3 && board[5][column] === null ? 'red' : 'yellow'
    const result = dropDisc(board, column, player)
    assert.ok(result, `column ${column} should accept a disc`)
    board = result.board
  }

  assert.deepEqual(getAvailableColumns(board), [0, 1, 2, 3, 4, 5, 6])
  assert.equal(checkConnectFourWinner(board).winner, 'red')
})

test('reversi starts with four legal black moves and flips captured pieces', () => {
  const board = initialReversiBoard()
  const legalMoves = getLegalMoves(board, 'black').map((move) => `${move.row},${move.col}`)

  assert.deepEqual(legalMoves.sort(), ['2,3', '3,2', '4,5', '5,4'])

  const next = applyReversiMove(board, { row: 2, col: 3 }, 'black')
  assert.equal(next[3][3], 'black')
  assert.deepEqual(countPieces(next), { black: 4, white: 1, empty: 59 })
  assert.equal(getReversiWinner(next), null)
})

test('rock paper scissors keeps selections hidden until both players choose', () => {
  let round = createRound()
  round = revealRound(round, 'player1', 'rock')

  assert.equal(round.revealed, false)
  assert.equal(round.winner, null)

  round = revealRound(round, 'player2', 'scissors')
  assert.equal(round.revealed, true)
  assert.equal(round.winner, 'player1')
  assert.equal(compareMoves('paper' as RpsMove, 'scissors' as RpsMove), 'player2')
})

test('go allows legal placement and captures stones without liberties', () => {
  let board = createGoBoard(5)
  board = applyGoMove(board, { row: 1, col: 2 }, 'white').board
  board = applyGoMove(board, { row: 0, col: 2 }, 'black').board
  board = applyGoMove(board, { row: 1, col: 1 }, 'black').board
  board = applyGoMove(board, { row: 1, col: 3 }, 'black').board

  const result = applyGoMove(board, { row: 2, col: 2 }, 'black')
  assert.equal(result.board[1][2], null)
  assert.deepEqual(getCapturesAfterMove(result.board, { row: 2, col: 2 }, 'black'), [])
  assert.ok(getGoLegalMoves(result.board, 'white').length > 0)
})

test('xiangqi starts with Chinese chess pieces and moves a soldier forward', () => {
  const board = createXiangqiBoard()
  const moves = getXiangqiLegalMoves(board, { row: 6, col: 0 })

  assert.ok(moves.some((move) => move.row === 5 && move.col === 0))
  const next = applyXiangqiMove(board, { row: 6, col: 0 }, { row: 5, col: 0 })
  assert.equal(next[5][0]?.type, 'soldier')
  assert.equal(next[6][0], null)
})

test('gomoku detects five in a row', () => {
  let board = createGomokuBoard(15)
  for (let col = 0; col < 5; col += 1) {
    board = applyGomokuMove(board, { row: 7, col }, 'black')
  }

  assert.equal(checkGomokuWinner(board).winner, 'black')
})

test('dots and boxes awards a point when the fourth edge closes a box', () => {
  let state = createDotsState(2, 2)
  state = drawDotsLine(state, { orientation: 'h', row: 0, col: 0 }, 'player1').state
  state = drawDotsLine(state, { orientation: 'v', row: 0, col: 0 }, 'player2').state
  state = drawDotsLine(state, { orientation: 'v', row: 0, col: 1 }, 'player1').state
  const result = drawDotsLine(state, { orientation: 'h', row: 1, col: 0 }, 'player2')

  assert.equal(result.state.boxes[0][0], 'player2')
  assert.equal(result.state.scores.player2, 1)
})

test('battleship attacks reveal hits and ships can remain afloat', () => {
  const board = createFleetBoard(8)
  const target = board.ships[0].cells[0]
  const result = attackCell(board, target)

  assert.equal(result.hit, true)
  assert.equal(result.board.shots[target.row][target.col], 'hit')
  assert.equal(hasShipsRemaining(result.board), true)
})
