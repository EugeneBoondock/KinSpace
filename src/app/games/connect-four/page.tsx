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
  checkWinner,
  chooseConnectFourAiColumn,
  createBoard,
  dropDisc,
  isBoardFull,
  nextPlayer,
  type ConnectFourBoard,
  type ConnectFourPlayer,
} from '@/lib/game-engines/connect-four'

type RoomPlayer = { user_id?: string; player_order?: number }
type ConnectFourState = {
  board: ConnectFourBoard
  turn: ConnectFourPlayer
  winner: ConnectFourPlayer | 'draw' | null
  line: Array<[number, number]> | null
}

function freshState(): ConnectFourState {
  return { board: createBoard(), turn: 'red', winner: null, line: null }
}

function normalizeState(value: unknown): ConnectFourState {
  const state = value as Partial<ConnectFourState> | null
  if (!state || !Array.isArray(state.board)) return freshState()
  return {
    board: state.board,
    turn: state.turn === 'yellow' ? 'yellow' : 'red',
    winner: state.winner === 'red' || state.winner === 'yellow' || state.winner === 'draw' ? state.winner : null,
    line: Array.isArray(state.line) ? state.line : null,
  }
}

function colorForOrder(order: number | null): ConnectFourPlayer | null {
  if (order === 1) return 'red'
  if (order === 2) return 'yellow'
  return null
}

export default function ConnectFourPage() {
  const params = useSearchParams()
  const roomId = params.get('mode') === 'room' ? params.get('gameId') : null
  const aiMode = params.get('mode') === 'ai' && !roomId
  const { user } = useAuth()

  const [state, setState] = useState<ConnectFourState>(() => freshState())
  const [players, setPlayers] = useState<RoomPlayer[]>([])
  const [saving, setSaving] = useState(false)

  const playerOrder = useMemo(() => {
    if (!roomId || !user) return null
    return players.find((player) => player.user_id === user.userId)?.player_order ?? null
  }, [players, roomId, user])

  const roomColor = colorForOrder(playerOrder)
  const canMove = roomId ? roomColor === state.turn : !aiMode || state.turn === 'red'

  const persistState = useCallback(
    async (next: ConnectFourState) => {
      setState(next)
      if (!roomId) return
      setSaving(true)
      try {
        await DatabaseService.updateGameState(roomId, next)
      } catch (error) {
        console.error('Failed to sync Connect Four state:', error)
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

  function playColumn(column: number) {
    if (state.winner || !canMove) return
    const move = dropDisc(state.board, column, state.turn)
    if (!move) return
    const win = checkWinner(move.board)
    let next: ConnectFourState = {
      board: move.board,
      turn: win.winner || isBoardFull(move.board) ? state.turn : nextPlayer(state.turn),
      winner: win.winner ?? (isBoardFull(move.board) ? 'draw' : null),
      line: win.line,
    }

    if (aiMode && !next.winner && next.turn === 'yellow') {
      const aiColumn = chooseConnectFourAiColumn(next.board, 'yellow')
      const aiMove = aiColumn === null ? null : dropDisc(next.board, aiColumn, 'yellow')
      if (aiMove) {
        const aiWin = checkWinner(aiMove.board)
        next = {
          board: aiMove.board,
          turn: aiWin.winner || isBoardFull(aiMove.board) ? 'yellow' : 'red',
          winner: aiWin.winner ?? (isBoardFull(aiMove.board) ? 'draw' : null),
          line: aiWin.line,
        }
      }
    }
    void persistState(next)
  }

  function reset() {
    void persistState(freshState())
  }

  const statusText = state.winner
    ? state.winner === 'draw'
      ? 'Draw board'
      : `${state.winner === 'red' ? 'Red' : 'Yellow'} wins`
    : roomId && !roomColor
      ? 'Join the room to play'
      : canMove
        ? `${state.turn === 'red' ? 'Red' : 'Yellow'} to move`
        : `Waiting for ${state.turn === 'red' ? 'Red' : 'Yellow'}`

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
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Connect Four</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Drop a disc into a column and connect four in a row before your opponent does.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">{statusText}</span>
              {aiMode && <span className="badge">You are red</span>}
              {roomColor && <span className="badge">You are {roomColor}</span>}
              {saving && <span className="badge">Syncing</span>}
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center">
          <div className="grid grid-cols-7 gap-1 rounded-3xl border border-[#eedfc8]/10 bg-[#10221d] p-2">
            {state.board.map((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const isWinning = state.line?.some(([lineRow, lineCol]) => lineRow === rowIndex && lineCol === colIndex)
                return (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    type="button"
                    onClick={() => playColumn(colIndex)}
                    disabled={Boolean(state.winner) || !canMove}
                    aria-label={`Column ${colIndex + 1}, row ${rowIndex + 1}`}
                    className={`flex h-11 w-11 items-center justify-center rounded-full border border-[#eedfc8]/10 bg-[#eedfc8]/8 transition hover:bg-[#eedfc8]/14 sm:h-14 sm:w-14 ${
                      isWinning ? 'ring-2 ring-[#D19A58]' : ''
                    }`}
                  >
                    {cell && (
                      <span
                        className={`h-8 w-8 rounded-full sm:h-10 sm:w-10 ${
                          cell === 'red' ? 'bg-[#B85C3A]' : 'bg-[#D19A58]'
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
