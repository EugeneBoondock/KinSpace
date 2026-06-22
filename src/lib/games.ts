export type GameId =
  | 'chess'
  | 'checkers'
  | 'tictactoe'
  | 'connect-four'
  | 'reversi'
  | 'rock-paper-scissors'
  | 'go'
  | 'xiangqi'
  | 'gomoku'
  | 'battleship'
  | 'dots-and-boxes'
  | 'wordle'
  | 'sudoku'
  | '2048'
  | 'minesweeper'
  | 'tetris'
  | 'memory'
  | 'snake'
  | 'uno'
  | 'drawing'
  | 'lightsout'
  | 'simon'
  | 'wordsearch'

export type GameDifficulty = 'easy' | 'medium' | 'hard'

export type GameCategory = 'strategy' | 'puzzle' | 'arcade' | 'social' | 'vs'

export type GameLogo =
  | { kind: 'emoji'; value: string }
  | { kind: 'text'; value: string }
  | { kind: 'connect-four' }
  | { kind: 'reversi' }
  | { kind: 'rps' }
  | { kind: 'go' }
  | { kind: 'xiangqi' }
  | { kind: 'gomoku' }
  | { kind: 'battleship' }
  | { kind: 'dots' }

export type GameTutorialStep = {
  title: string
  body: string
}

export type GameDefinition = {
  id: GameId
  name: string
  icon: string
  logo: GameLogo
  category: GameCategory
  playersLabel: string
  duration: string
  difficultyLabel: string
  description: string
  maxPlayers: number
  practiceLabel: string
  aiLabel: string
  isMultiplayer: boolean
  supportsDifficulty?: boolean
  tutorialSteps: GameTutorialStep[]
  engine: string
}

type GameDefinitionInput = Omit<GameDefinition, 'logo' | 'aiLabel' | 'tutorialSteps'> &
  Partial<Pick<GameDefinition, 'logo' | 'aiLabel' | 'tutorialSteps'>>

function defaultTutorial(game: GameDefinitionInput): GameTutorialStep[] {
  const lastStep = game.isMultiplayer
    ? {
        title: 'Try VS AI',
        body: 'Choose the VS AI action to practise with an automated opponent before opening a live room.',
      }
    : {
        title: 'Replay at your pace',
        body: 'Use the page controls to reset, change difficulty, or build a new score when you are ready.',
      }

  return [
    {
      title: 'Read the goal',
      body: `Start by checking the goal and the turn badge for ${game.name}.`,
    },
    {
      title: 'Take your turn',
      body: 'Use the board controls, cards, keys, or action buttons shown on the page.',
    },
    lastStep,
  ]
}

function completeGame(game: GameDefinitionInput): GameDefinition {
  return {
    ...game,
    logo: game.logo ?? { kind: 'emoji', value: game.icon },
    aiLabel: game.aiLabel ?? (game.isMultiplayer ? 'Play vs AI' : game.practiceLabel),
    tutorialSteps: game.tutorialSteps ?? defaultTutorial(game),
  }
}

// Ordering is intentional: calm solo puzzles first, then arcade solo, then the
// turn-based classics, and finally the multiplayer/social games.
const baseGameCatalog: GameDefinitionInput[] = [
  {
    id: 'memory',
    name: 'Memory Match',
    icon: '🎴',
    category: 'puzzle',
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
    id: 'lightsout',
    name: 'Lights Out',
    icon: '💡',
    category: 'puzzle',
    playersLabel: '1 player',
    duration: '3-10 min',
    difficultyLabel: 'Medium',
    description: 'Tap a tile to flip it and its neighbours. Turn the whole grid off to win.',
    maxPlayers: 1,
    practiceLabel: 'Play solo',
    isMultiplayer: false,
    supportsDifficulty: true,
    engine: 'inline engine',
  },
  {
    id: 'wordsearch',
    name: 'Word Search',
    icon: '🔍',
    category: 'puzzle',
    playersLabel: '1 player',
    duration: '5-15 min',
    difficultyLabel: 'Easy',
    description: 'Find the hidden words in the letter grid. Calming, unhurried hunting.',
    maxPlayers: 1,
    practiceLabel: 'Play solo',
    isMultiplayer: false,
    supportsDifficulty: true,
    engine: 'inline engine',
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
    id: 'simon',
    name: 'Simon',
    icon: '🎶',
    category: 'arcade',
    playersLabel: '1 player',
    duration: '2-10 min',
    difficultyLabel: 'Easy',
    description: 'Watch the colour sequence, then repeat it back. Each round adds one more.',
    maxPlayers: 1,
    practiceLabel: 'Play solo',
    isMultiplayer: false,
    supportsDifficulty: true,
    engine: 'inline engine',
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
    id: 'connect-four',
    name: 'Connect Four',
    icon: '4',
    logo: { kind: 'connect-four' },
    category: 'vs',
    playersLabel: '2 players',
    duration: '5-15 min',
    difficultyLabel: 'Easy',
    description: 'Drop discs, stack threats, and race to four in a row. Works as VS AI, local VS, or a live room board.',
    maxPlayers: 2,
    practiceLabel: 'Play vs AI',
    aiLabel: 'Play vs AI',
    isMultiplayer: true,
    engine: 'inline engine',
  },
  {
    id: 'reversi',
    name: 'Reversi',
    icon: 'RX',
    logo: { kind: 'reversi' },
    category: 'vs',
    playersLabel: '2 players',
    duration: '10-25 min',
    difficultyLabel: 'Medium',
    description: 'Place a disc, flip trapped lines, and own the board by the final move against a person or AI.',
    maxPlayers: 2,
    practiceLabel: 'Play vs AI',
    aiLabel: 'Play vs AI',
    isMultiplayer: true,
    engine: 'inline engine',
  },
  {
    id: 'rock-paper-scissors',
    name: 'Rock Paper Scissors',
    icon: 'VS',
    logo: { kind: 'rps' },
    category: 'vs',
    playersLabel: '2 players',
    duration: '2-5 min',
    difficultyLabel: 'Easy',
    description: 'Secret picks, instant reveal, and a first-to-five score for quick AI or head-to-head rounds.',
    maxPlayers: 2,
    practiceLabel: 'Play vs AI',
    aiLabel: 'Play vs AI',
    isMultiplayer: true,
    engine: 'inline engine',
  },
  {
    id: 'go',
    name: 'Go',
    icon: 'GO',
    logo: { kind: 'go' },
    category: 'vs',
    playersLabel: '2 players',
    duration: '20-60 min',
    difficultyLabel: 'Advanced',
    description: 'Claim space with black and white stones. Capture groups that run out of liberties.',
    maxPlayers: 2,
    practiceLabel: 'Play vs AI',
    aiLabel: 'Play vs AI',
    isMultiplayer: true,
    engine: 'liberty capture',
  },
  {
    id: 'xiangqi',
    name: 'Xiangqi',
    icon: 'XQ',
    logo: { kind: 'xiangqi' },
    category: 'vs',
    playersLabel: '2 players',
    duration: '20-45 min',
    difficultyLabel: 'Advanced',
    description: 'Chinese chess with generals, cannons, horses, soldiers, and palace movement.',
    maxPlayers: 2,
    practiceLabel: 'Play vs AI',
    aiLabel: 'Play vs AI',
    isMultiplayer: true,
    engine: 'inline engine',
  },
  {
    id: 'gomoku',
    name: 'Gomoku',
    icon: '5',
    logo: { kind: 'gomoku' },
    category: 'vs',
    playersLabel: '2 players',
    duration: '5-20 min',
    difficultyLabel: 'Medium',
    description: 'Place stones on a grid and make five in a row before your opponent does.',
    maxPlayers: 2,
    practiceLabel: 'Play vs AI',
    aiLabel: 'Play vs AI',
    isMultiplayer: true,
    engine: 'inline engine',
  },
  {
    id: 'battleship',
    name: 'Battleship',
    icon: 'SHIP',
    logo: { kind: 'battleship' },
    category: 'vs',
    playersLabel: '2 players',
    duration: '10-20 min',
    difficultyLabel: 'Easy',
    description: 'Call shots, find hidden ships, and sink the AI fleet before yours goes down.',
    maxPlayers: 2,
    practiceLabel: 'Play vs AI',
    aiLabel: 'Play vs AI',
    isMultiplayer: true,
    engine: 'inline engine',
  },
  {
    id: 'dots-and-boxes',
    name: 'Dots and Boxes',
    icon: 'BOX',
    logo: { kind: 'dots' },
    category: 'vs',
    playersLabel: '2 players',
    duration: '5-15 min',
    difficultyLabel: 'Easy',
    description: 'Draw the fourth side of a square to score. Keep the turn when you close a box.',
    maxPlayers: 2,
    practiceLabel: 'Play vs AI',
    aiLabel: 'Play vs AI',
    isMultiplayer: true,
    engine: 'inline engine',
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

export const gameCatalog: GameDefinition[] = baseGameCatalog.map(completeGame)

export const gameCategories: Array<{ id: GameCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'vs', label: 'VS' },
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
