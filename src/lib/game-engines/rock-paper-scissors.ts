export type RpsMove = 'rock' | 'paper' | 'scissors'
export type RpsPlayer = 'player1' | 'player2'
export type RpsWinner = RpsPlayer | 'draw' | null

export type RpsRound = {
  player1: RpsMove | null
  player2: RpsMove | null
  revealed: boolean
  winner: RpsWinner
}

export type RpsScore = {
  player1: number
  player2: number
  draw: number
}

const BEATS: Record<RpsMove, RpsMove> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
}

export function createRound(): RpsRound {
  return { player1: null, player2: null, revealed: false, winner: null }
}

export function compareMoves(player1: RpsMove, player2: RpsMove): Exclude<RpsWinner, null> {
  if (player1 === player2) return 'draw'
  return BEATS[player1] === player2 ? 'player1' : 'player2'
}

export function revealRound(round: RpsRound, player: RpsPlayer, move: RpsMove): RpsRound {
  const next = { ...round, [player]: move }
  if (!next.player1 || !next.player2) return { ...next, revealed: false, winner: null }
  return {
    ...next,
    revealed: true,
    winner: compareMoves(next.player1, next.player2),
  }
}

export function applyRoundToScore(score: RpsScore, round: RpsRound): RpsScore {
  if (!round.revealed || !round.winner) return score
  return { ...score, [round.winner]: score[round.winner] + 1 }
}

export function chooseRpsAiMove(): RpsMove {
  const moves: RpsMove[] = ['rock', 'paper', 'scissors']
  return moves[Math.floor(Math.random() * moves.length)]
}
