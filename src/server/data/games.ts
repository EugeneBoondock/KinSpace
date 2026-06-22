import { eq, and, desc } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor, getProfileSummary, getProfileSummaries, sortByNewest } from './_shared'
import { games, gamePlayers, gameScores } from '@/server/db/schema'
import { createBoard as createConnectFourBoard } from '@/lib/game-engines/connect-four'
import { initialBoard as initialReversiBoard } from '@/lib/game-engines/reversi'
import { createRound } from '@/lib/game-engines/rock-paper-scissors'
import { createBoard as createGoBoard } from '@/lib/game-engines/go'
import { createInitialBoard as createXiangqiBoard } from '@/lib/game-engines/xiangqi'
import { createBoard as createGomokuBoard } from '@/lib/game-engines/gomoku'
import { createState as createDotsState } from '@/lib/game-engines/dots-and-boxes'
import { createFleetBoard } from '@/lib/game-engines/battleship'

/** Initial board/game state per game type (inlined from the old private helper). */
function getInitialGameState(gameType: string): unknown {
  switch (gameType) {
    case 'chess':
      return {
        board: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        turn: 'white',
        moves: [],
      }
    case 'checkers':
      return {
        board: Array(8)
          .fill(null)
          .map((_, row) =>
            Array(8)
              .fill(null)
              .map((__, column) => {
                if ((row + column) % 2 === 1) {
                  if (row < 3) return 'red'
                  if (row > 4) return 'black'
                }
                return null
              })),
        turn: 'red',
      }
    case 'tictactoe':
      return { board: Array(9).fill(null), turn: 'X', winner: null }
    case 'connect-four':
      return { board: createConnectFourBoard(), turn: 'red', winner: null, line: null }
    case 'reversi':
      return { board: initialReversiBoard(), turn: 'black', winner: null }
    case 'rock-paper-scissors':
      return {
        round: createRound(),
        score: { player1: 0, player2: 0, draw: 0 },
        target: 5,
        localTurn: 'player1',
      }
    case 'go':
      return { board: createGoBoard(9), turn: 'black', passes: { black: 0, white: 0 }, captures: { black: 0, white: 0 } }
    case 'xiangqi':
      return { board: createXiangqiBoard(), turn: 'red', winner: null }
    case 'gomoku':
      return { board: createGomokuBoard(15), turn: 'black', winner: null, line: [] }
    case 'dots-and-boxes':
      return { ...createDotsState(4, 4), turn: 'player1', winner: null }
    case 'battleship':
      return {
        playerBoard: createFleetBoard(8),
        aiBoard: createFleetBoard(8),
        turn: 'player',
        winner: null,
      }
    case 'wordle':
      return { word: null, guesses: [], currentGuess: '', gameOver: false }
    default:
      return {}
  }
}

export async function createGame(
  ctx: Ctx,
  hostId: string,
  gameType: string,
  maxPlayers: number,
  isPrivate = false) {
  // Derive the host from the authenticated actor, never trust the passed hostId.
  const actorId = requireActor(ctx)
  const roomCode = isPrivate ? Math.random().toString(36).substring(2, 8).toUpperCase() : null

  const gameId = crypto.randomUUID()
  await ctx.db.insert(games).values({
    id: gameId,
    hostId: actorId,
    gameType,
    maxPlayers,
    currentPlayers: 1,
    isPrivate,
    roomCode,
    status: 'waiting',
    gameState: getInitialGameState(gameType),
  })

  await ctx.db.insert(gamePlayers).values({
    id: crypto.randomUUID(),
    gameId,
    userId: actorId,
    playerOrder: 1,
  })

  return { id: gameId, gameType, roomCode }
}

export async function joinGame(ctx: Ctx, gameId: string, _userId: string) {
  // The joining user is always the authenticated actor.
  const actorId = requireActor(ctx)

  const existing = await ctx.db.query.gamePlayers.findFirst({
    where: and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.userId, actorId)),
  })
  if (existing) return existing.id

  const game = await ctx.db.query.games.findFirst({ where: eq(games.id, gameId) })
  if (!game) throw new Error('Game not found')

  if (game.currentPlayers >= game.maxPlayers) {
    throw new Error('Game is full')
  }

  const playerId = crypto.randomUUID()
  await ctx.db.insert(gamePlayers).values({
    id: playerId,
    gameId,
    userId: actorId,
    playerOrder: game.currentPlayers + 1,
  })

  await ctx.db
    .update(games)
    .set({
      currentPlayers: sql`${games.currentPlayers} + 1`,
      status: game.currentPlayers + 1 >= game.maxPlayers ? 'active' : 'waiting',
      updatedAt: new Date(),
    })
    .where(eq(games.id, gameId))

  return playerId
}

export async function getActiveGames(ctx: Ctx, gameType?: string) {
  const rows = await ctx.db.query.games.findMany({
    where: and(eq(games.status, 'waiting'), eq(games.isPrivate, false)),
    orderBy: [desc(games.createdAt)],
  })

  const filtered = rows.filter((game) => !gameType || game.gameType === gameType)

  const profileMap = await getProfileSummaries(
    ctx.db,
    filtered.map((game) => game.hostId))

  const hydrated = filtered.map((game) => ({
    ...game,
    host: profileMap.get(game.hostId) ?? null,
  }))

  return sortByNewest(hydrated)
}

export async function getGame(ctx: Ctx, gameId: string) {
  const game = await ctx.db.query.games.findFirst({ where: eq(games.id, gameId) })
  if (!game) return null

  const host = await getProfileSummary(ctx.db, game.hostId)

  return { ...game, host }
}

export async function getGamePlayers(ctx: Ctx, gameId: string) {
  const rows = await ctx.db.query.gamePlayers.findMany({
    where: eq(gamePlayers.gameId, gameId),
  })

  const profileMap = await getProfileSummaries(
    ctx.db,
    rows.map((player) => player.userId))

  const players = rows.map((player) => ({
    ...player,
    profile: profileMap.get(player.userId) ?? null,
  }))

  return players.sort((first, second) => (first.playerOrder ?? 0) - (second.playerOrder ?? 0))
}

export async function updateGameState(ctx: Ctx, gameId: string, gameState: unknown) {
  // A move requires an authenticated actor.
  requireActor(ctx)

  await ctx.db
    .update(games)
    .set({ gameState, updatedAt: new Date() })
    .where(eq(games.id, gameId))
}

export async function leaveGame(ctx: Ctx, gameId: string, _userId: string) {
  // The leaving user is always the authenticated actor.
  const actorId = requireActor(ctx)

  const game = await ctx.db.query.games.findFirst({ where: eq(games.id, gameId) })
  if (!game) return { left: false, archived: false }

  const playerRows = await ctx.db.query.gamePlayers.findMany({
    where: and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.userId, actorId)),
  })
  if (playerRows.length === 0) return { left: false, archived: false }

  await ctx.db
    .delete(gamePlayers)
    .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.userId, actorId)))

  const remaining = Math.max(0, (game.currentPlayers ?? 1) - playerRows.length)

  // Host leaving closes the room for everyone.
  const isHost = game.hostId === actorId
  if (isHost || remaining === 0) {
    await ctx.db
      .update(games)
      .set({ status: 'archived', currentPlayers: remaining, updatedAt: new Date() })
      .where(eq(games.id, gameId))
    return { left: true, archived: true }
  }

  await ctx.db
    .update(games)
    .set({
      currentPlayers: remaining,
      status: game.status === 'active' ? 'waiting' : game.status,
      updatedAt: new Date(),
    })
    .where(eq(games.id, gameId))
  return { left: true, archived: false }
}

/**
 * Persist a single-player game score (one row per play) keyed by the game slug.
 * Best score and play count are derived on read in getUserGameScores.
 */
export async function recordGameScore(
  ctx: Ctx,
  _userId: string,
  gameId: string,
  score: number) {
  const userId = requireActor(ctx)
  const gameKey = String(gameId ?? '').trim()
  const value = Number.isFinite(score) ? Math.max(0, Math.round(score)) : 0
  if (!gameKey) return { recorded: false, gameId, score: value }

  await ctx.db.insert(gameScores).values({
    id: crypto.randomUUID(),
    userId,
    gameKey,
    score: value,
  })
  return { recorded: true, gameId: gameKey, score: value }
}

/**
 * A user's game stats for their profile: best score, play count, and last played
 * per game, best-first. Readable by any signed-in member (scores are not private);
 * profile-level visibility is enforced separately by getProfile.
 */
export async function getUserGameScores(ctx: Ctx, userId: string) {
  requireActor(ctx)
  if (!userId) return []
  const rows = await ctx.db.query.gameScores.findMany({ where: eq(gameScores.userId, userId) })

  const byGame = new Map<string, { game_key: string; best: number; plays: number; last_played_at: Date | null }>()
  for (const row of rows) {
    const key = row.gameKey
    const when = (row.createdAt as Date) ?? null
    const existing = byGame.get(key)
    if (!existing) {
      byGame.set(key, { game_key: key, best: row.score, plays: 1, last_played_at: when })
      continue
    }
    existing.best = Math.max(existing.best, row.score)
    existing.plays += 1
    if (when && (!existing.last_played_at || when.getTime() > existing.last_played_at.getTime())) {
      existing.last_played_at = when
    }
  }

  return Array.from(byGame.values()).sort((a, b) => b.best - a.best)
}
