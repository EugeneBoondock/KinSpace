'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { RealtimeService } from '@/lib/realtime'
import {
  applyMove,
  chooseReversiAiMove,
  countPieces,
  getLegalMoves,
  getWinner,
  initialBoard,
  nextPlayer,
  type ReversiBoard,
  type ReversiMove,
  type ReversiPlayer,
} from '@/lib/game-engines/reversi'

type RoomPlayer = { user_id?: string; player_order?: number }
type ReversiState = {
  board: ReversiBoard
  turn: ReversiPlayer
  winner: ReversiPlayer | 'draw' | null
}

function freshState(): ReversiState {
  return { board: initialBoard(), turn: 'black', winner: null }
}

function normalizeState(value: unknown): ReversiState {
  const state = value as Partial<ReversiState> | null
  if (!state || !Array.isArray(state.board)) return freshState()
  return {
    board: state.board,
    turn: state.turn === 'white' ? 'white' : 'black',
    winner: state.winner === 'black' || state.winner === 'white' || state.winner === 'draw' ? state.winner : null,
  }
}

function colorForOrder(order: number | null): ReversiPlayer | null {
  if (order === 1) return 'black'
  if (order === 2) return 'white'
  return null
}

function nextTurnFor(board: ReversiBoard, current: ReversiPlayer): { turn: ReversiPlayer; winner: ReversiState['winner'] } {
  const opponent = nextPlayer(current)
  if (getLegalMoves(board, opponent).length > 0) return { turn: opponent, winner: null }
  if (getLegalMoves(board, current).length > 0) return { turn: current, winner: null }
  return { turn: current, winner: getWinner(board) }
}

export default function ReversiPage() {
  const params = useSearchParams()
  const roomId = params.get('mode') === 'room' ? params.get('gameId') : null
  const aiMode = params.get('mode') === 'ai' && !roomId
  const { user } = useAuth()

  const [state, setState] = useState<ReversiState>(() => freshState())
  const [players, setPlayers] = useState<RoomPlayer[]>([])
  const [saving, setSaving] = useState(false)

  const playerOrder = useMemo(() => {
    if (!roomId || !user) return null
    return players.find((player) => player.user_id === user.userId)?.player_order ?? null
  }, [players, roomId, user])

  const roomColor = colorForOrder(playerOrder)
  const legalMoves = useMemo(() => getLegalMoves(state.board, state.turn), [state.board, state.turn])
  const legalMoveMap = useMemo(() => {
    const map = new Map<string, ReversiMove>()
    for (const move of legalMoves) map.set(`${move.row}-${move.col}`, move)
    return map
  }, [legalMoves])
  const counts = useMemo(() => countPieces(state.board), [state.board])
  const canMove = roomId ? roomColor === state.turn : !aiMode || state.turn === 'black'

  const persistState = useCallback(
    async (next: ReversiState) => {
      setState(next)
      if (!roomId) return
      setSaving(true)
      try {
        await DatabaseService.updateGameState(roomId, next)
      } catch (error) {
        console.error('Failed to sync Reversi state:', error)
      } finally {
        setSaving(false)
      }
    },
    [roomId],
  )

  useEffect(() => {
    if (!roomId) return

    let active = true
    DatabaseService.getGame(roomId)
      .then((room) => {
        if (!active) return
        setState(normalizeState((room as { game_state?: unknown } | null)?.game_state))
      })
      .catch(() => undefined)
    DatabaseService.getGamePlayers(roomId)
      .then((roomPlayers) => {
        if (active) setPlayers(Array.isArray(roomPlayers) ? roomPlayers as RoomPlayer[] : [])
      })
      .catch(() => undefined)

    const unsubscribeRoom = RealtimeService.subscribeToGame(roomId, (room) => {
      setState(normalizeState((room as { game_state?: unknown } | null)?.game_state))
    })
    const unsubscribePlayers = RealtimeService.subscribeToGamePlayers(roomId, (roomPlayers) => {
      setPlayers(Array.isArray(roomPlayers) ? roomPlayers as RoomPlayer[] : [])
    })

    return () => {
      active = false
      unsubscribeRoom()
      unsubscribePlayers()
    }
  }, [roomId])

  function playMove(row: number, col: number) {
    if (state.winner || !canMove) return
    const move = legalMoveMap.get(`${row}-${col}`)
    if (!move) return
    let board = applyMove(state.board, move, state.turn)
    let turnResult = nextTurnFor(board, state.turn)

    if (aiMode && !turnResult.winner && turnResult.turn === 'white') {
      const aiMove = chooseReversiAiMove(board, 'white')
      if (aiMove) {
        board = applyMove(board, aiMove, 'white')
        turnResult = nextTurnFor(board, 'white')
      }
    }

    void persistState({ board, ...turnResult })
  }

  function reset() {
    void persistState(freshState())
  }

  const statusText = state.winner
    ? state.winner === 'draw'
      ? 'Draw board'
      : `${state.winner === 'black' ? 'Black' : 'White'} wins`
    : roomId && !roomColor
      ? 'Join the room to play'
      : canMove
        ? `${state.turn === 'black' ? 'Black' : 'White'} to move`
        : `Waiting for ${state.turn === 'black' ? 'Black' : 'White'}`

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <Link href="/games" className="text-sm text-[#D19A58]">
            Back to games
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/45">
                VS game {roomId ? '- live room' : aiMode ? '- VS AI' : '- local'}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Reversi</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Place a disc to trap your opponent in straight lines. Captured discs flip to your side.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">{statusText}</span>
              {aiMode && <span className="badge">You are black</span>}
              <span className="badge">Black {counts.black}</span>
              <span className="badge bg-[#eedfc8]/12 text-[#eedfc8]">White {counts.white}</span>
              {roomColor && <span className="badge">You are {roomColor}</span>}
              {saving && <span className="badge">Syncing</span>}
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center">
          <div className="grid grid-cols-8 gap-0 rounded-2xl border border-[#eedfc8]/10 bg-[#17312a] p-2">
            {state.board.map((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const move = legalMoveMap.get(`${rowIndex}-${colIndex}`)
                return (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    type="button"
                    onClick={() => playMove(rowIndex, colIndex)}
                    disabled={Boolean(state.winner) || !canMove || !move}
                    aria-label={`Square ${rowIndex + 1}, ${colIndex + 1}`}
                    className={`flex h-10 w-10 items-center justify-center border border-[#eedfc8]/8 transition sm:h-12 sm:w-12 ${
                      move ? 'bg-[#D19A58]/18 hover:bg-[#D19A58]/28' : 'bg-[#eedfc8]/6'
                    }`}
                  >
                    {cell && (
                      <span
                        className={`h-7 w-7 rounded-full border sm:h-9 sm:w-9 ${
                          cell === 'black'
                            ? 'border-[#eedfc8]/20 bg-[#0f1f1b]'
                            : 'border-[#0f1f1b]/20 bg-[#eedfc8]'
                        }`}
                      />
                    )}
                  </button>
                )
              }),
            )}
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={reset} className="btn-primary !rounded-2xl !px-4 !py-2 text-sm">
              New match
            </button>
            {roomId && (
              <Link href={`/games/rooms/${roomId}`} className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">
                Room lobby
              </Link>
            )}
          </div>
        </section>
      </div>
      <BottomNav />
    </PageFrame>
  )
}
