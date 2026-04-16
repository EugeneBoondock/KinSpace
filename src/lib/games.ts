export type GameId =
  | 'chess'
  | 'checkers'
  | 'tictactoe'
  | 'wordle'
  | 'sudoku'
  | '2048'
  | 'minesweeper'
  | 'tetris'
  | 'memory'
  | 'snake'
  | 'uno'
  | 'drawing'

export type GameDifficulty = 'easy' | 'medium' | 'hard'

export type GameCategory = 'strategy' | 'puzzle' | 'arcade' | 'social'

export type GameDefinition = {
  id: GameId
  name: string
  icon: string
  category: GameCategory
  playersLabel: string
  duration: string
  difficultyLabel: string
  description: string
  maxPlayers: number
  practiceLabel: string
  isMultiplayer: boolean
  supportsDifficulty?: boolean
  engine: string
}

export const gameCatalog: GameDefinition[] = [
  {
    id: 'chess',
    name: 'Chess',
    icon: '♛',
    category: 'strategy',
    playersLabel: '2 players',
    duration: '15-60 min',
    difficultyLabel: 'Advanced',
    description: 'Full chess backed by chess.js rules + js-chess-engine AI. Three difficulty levels.',
    maxPlayers: 2,
    practiceLabel: 'Play vs AI',
    isMultiplayer: true,
    supportsDifficulty: true,
    engine: 'chess.js + react-chessboard',
  },
  {
    id: 'checkers',
    name: 'Checkers',
    icon: '⚫',
    category: 'strategy',
    playersLabel: '2 players',
    duration: '10-30 min',
    difficultyLabel: 'Medium',
    description: 'Clean 8x8 board with kinging, jumps, and a minimax opponent.',
    maxPlayers: 2,
    practiceLabel: 'Play vs AI',
    isMultiplayer: true,
    supportsDifficulty: true,
    engine: 'inline engine',
  },
  {
    id: 'tictactoe',
    name: 'Tic Tac Toe',
    icon: '⭕',
    category: 'strategy',
    playersLabel: '2 players',
    duration: '2-5 min',
    difficultyLabel: 'Easy',
    description: 'Fast rounds with difficulty control and live-room support.',
    maxPlayers: 2,
    practiceLabel: 'Play vs AI',
    isMultiplayer: true,
    supportsDifficulty: true,
    engine: 'minimax',
  },
  {
    id: 'wordle',
    name: 'Wordle',
    icon: '🔤',
    category: 'puzzle',
    playersLabel: '1 player',
    duration: '5-15 min',
    difficultyLabel: 'Medium',
    description: 'Daily-style five-letter word challenge. Fresh word each game.',
    maxPlayers: 1,
    practiceLabel: 'Play solo',
    isMultiplayer: false,
    engine: 'dictionary',
  },
  {
    id: 'sudoku',
    name: 'Sudoku',
    icon: '🔢',
    category: 'puzzle',
    playersLabel: '1 player',
    duration: '10-30 min',
    difficultyLabel: 'Medium',
    description: 'Classic 9x9 logic puzzle. Pencil marks, hints, and three difficulties.',
    maxPlayers: 1,
    practiceLabel: 'Play solo',
    isMultiplayer: false,
    supportsDifficulty: true,
    engine: 'sudoku npm',
  },
  {
    id: '2048',
    name: '2048',
    icon: '🔲',
    category: 'arcade',
    playersLabel: '1 player',
    duration: '5-20 min',
    difficultyLabel: 'Easy',
    description: 'Merge tiles to reach 2048. Arrow keys or swipe. High scores saved to your profile.',
    maxPlayers: 1,
    practiceLabel: 'Play solo',
    isMultiplayer: false,
    engine: 'inline engine',
  },
  {
    id: 'minesweeper',
    name: 'Minesweeper',
    icon: '💣',
    category: 'arcade',
    playersLabel: '1 player',
    duration: '5-20 min',
    difficultyLabel: 'Medium',
    description: 'Uncover safe squares without hitting a mine. Three board sizes.',
    maxPlayers: 1,
    practiceLabel: 'Play solo',
    isMultiplayer: false,
    supportsDifficulty: true,
    engine: 'inline engine',
  },
  {
    id: 'tetris',
    name: 'Tetris',
    icon: '🟥',
    category: 'arcade',
    playersLabel: '1 player',
    duration: '5-30 min',
    difficultyLabel: 'Easy',
    description: 'Classic falling blocks. Keyboard controls, pause, and level-up speed.',
    maxPlayers: 1,
    practiceLabel: 'Play solo',
    isMultiplayer: false,
    engine: 'react-tetris',
  },
  {
    id: 'memory',
    name: 'Memory Match',
    icon: '🎴',
    category: 'arcade',
    playersLabel: '1 player',
    duration: '2-10 min',
    difficultyLabel: 'Easy',
    description: 'Flip cards to find matching pairs. Warm, forgiving, great as a micro-break.',
    maxPlayers: 1,
    practiceLabel: 'Play solo',
    isMultiplayer: false,
    supportsDifficulty: true,
    engine: 'inline engine',
  },
  {
    id: 'snake',
    name: 'Snake',
    icon: '🐍',
    category: 'arcade',
    playersLabel: '1 player',
    duration: '2-10 min',
    difficultyLabel: 'Easy',
    description: 'Eat, grow, do not hit the wall. Arrow keys and a steady rhythm.',
    maxPlayers: 1,
    practiceLabel: 'Play solo',
    isMultiplayer: false,
    supportsDifficulty: true,
    engine: 'inline engine',
  },
  {
    id: 'uno',
    name: 'UNO Cards',
    icon: '🃏',
    category: 'social',
    playersLabel: '2-6 players',
    duration: '15-45 min',
    difficultyLabel: 'Easy',
    description: 'Play with AI opponents or open a live room to gather a table.',
    maxPlayers: 6,
    practiceLabel: 'Play vs AI',
    isMultiplayer: true,
    engine: 'inline engine',
  },
  {
    id: 'drawing',
    name: 'Draw & Guess',
    icon: '🎨',
    category: 'social',
    playersLabel: '1-4 players',
    duration: '10-20 min',
    difficultyLabel: 'Fun',
    description: 'Sketch the prompt. Good as a warm-up in a group room.',
    maxPlayers: 4,
    practiceLabel: 'Start drawing',
    isMultiplayer: true,
    engine: 'canvas + prompts',
  },
]

export const gameCategories: Array<{ id: GameCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'puzzle', label: 'Puzzle' },
  { id: 'arcade', label: 'Arcade' },
  { id: 'social', label: 'Social' },
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
