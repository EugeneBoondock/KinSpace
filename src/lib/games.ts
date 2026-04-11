export type GameId = 'chess' | 'checkers' | 'tictactoe' | 'wordle' | 'uno' | 'drawing'

export type GameDifficulty = 'easy' | 'medium' | 'hard'

export type GameDefinition = {
  id: GameId
  name: string
  icon: string
  playersLabel: string
  duration: string
  difficultyLabel: string
  description: string
  maxPlayers: number
  practiceLabel: string
  supportsDifficulty?: boolean
}

export const gameCatalog: GameDefinition[] = [
  {
    id: 'chess',
    name: 'Chess',
    icon: '♛',
    playersLabel: '2 players',
    duration: '15-60 min',
    difficultyLabel: 'Advanced',
    description: 'Challenge the AI in a focused strategy match or open a live room to gather players.',
    maxPlayers: 2,
    practiceLabel: 'Play vs AI',
    supportsDifficulty: true,
  },
  {
    id: 'checkers',
    name: 'Checkers',
    icon: '⚫',
    playersLabel: '2 players',
    duration: '10-30 min',
    difficultyLabel: 'Medium',
    description: 'A clean local board for quick strategy rounds with room support for meetup coordination.',
    maxPlayers: 2,
    practiceLabel: 'Play local',
  },
  {
    id: 'tictactoe',
    name: 'Tic Tac Toe',
    icon: '⭕',
    playersLabel: '2 players',
    duration: '2-5 min',
    difficultyLabel: 'Easy',
    description: 'Fast matches against the AI with difficulty control and optional room coordination.',
    maxPlayers: 2,
    practiceLabel: 'Play vs AI',
    supportsDifficulty: true,
  },
  {
    id: 'wordle',
    name: 'Wordle',
    icon: '🔤',
    playersLabel: '1 player',
    duration: '5-15 min',
    difficultyLabel: 'Medium',
    description: 'A solo word challenge for quick focus breaks.',
    maxPlayers: 1,
    practiceLabel: 'Play solo',
  },
  {
    id: 'uno',
    name: 'UNO Cards',
    icon: '🃏',
    playersLabel: '2-6 players',
    duration: '15-45 min',
    difficultyLabel: 'Easy',
    description: 'Play against AI opponents or open a room to gather a table.',
    maxPlayers: 6,
    practiceLabel: 'Play now',
  },
  {
    id: 'drawing',
    name: 'Guess Drawing',
    icon: '🎨',
    playersLabel: '1-4 players',
    duration: '10-20 min',
    difficultyLabel: 'Fun',
    description: 'Draw, let the AI guess, and use rooms to organize creative group sessions.',
    maxPlayers: 4,
    practiceLabel: 'Start drawing',
  },
]

export function getGameDefinition(gameType: string | null | undefined) {
  return gameCatalog.find((game) => game.id === gameType)
}

export function getGameHref(
  gameType: string | null | undefined,
  options?: {
    difficulty?: GameDifficulty
    mode?: string
    gameId?: string
  },
) {
  const game = getGameDefinition(gameType)
  if (!game) return '/games'

  const searchParams = new URLSearchParams()

  if (options?.difficulty && game.supportsDifficulty) {
    searchParams.set('difficulty', options.difficulty)
  }

  if (options?.mode) {
    searchParams.set('mode', options.mode)
  }

  if (options?.gameId) {
    searchParams.set('gameId', options.gameId)
  }

  const query = searchParams.toString()
  return `/games/${game.id}${query ? `?${query}` : ''}`
}
