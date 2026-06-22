'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { playSfx } from '@/lib/audio/sfx'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { RealtimeService } from '@/lib/realtime'
import {
  applyRoundToScore,
  chooseRpsAiMove,
  createRound,
  revealRound,
  type RpsMove,
  type RpsPlayer,
  type RpsRound,
  type RpsScore,
} from '@/lib/game-engines/rock-paper-scissors'

type RoomPlayer = { user_id?: string; player_order?: number }
type RpsState = {
  round: RpsRound
  score: RpsScore
  target: number
  localTurn: RpsPlayer
}

const moveLabels: Record<RpsMove, string> = {
  rock: 'Rock',
  paper: 'Paper',
  scissors: 'Scissors',
}

const moveIcons: Record<RpsMove, string> = {
  rock: 'ri-circle-line',
  paper: 'ri-file-paper-2-line',
  scissors: 'ri-scissors-line',
}

function freshState(): RpsState {
  return {
    round: createRound(),
    score: { player1: 0, player2: 0, draw: 0 },
    target: 5,
    localTurn: 'player1',
  }
}

function normalizeState(value: unknown): RpsState {
  const state = value as Partial<RpsState> | null
  if (!state || !state.round || !state.score) return freshState()
  return {
    round: {
      player1: state.round.player1 ?? null,
      player2: state.round.player2 ?? null,
      revealed: Boolean(state.round.revealed),
      winner: state.round.winner ?? null,
    },
    score: {
      player1: Number(state.score.player1 ?? 0),
      player2: Number(state.score.player2 ?? 0),
      draw: Number(state.score.draw ?? 0),
    },
    target: Number(state.target ?? 5),
    localTurn: state.localTurn === 'player2' ? 'player2' : 'player1',
  }
}

function playerForOrder(order: number | null): RpsPlayer | null {
  if (order === 1) return 'player1'
  if (order === 2) return 'player2'
  return null
}

function playerName(player: RpsPlayer) {
  return player === 'player1' ? 'Player 1' : 'Player 2'
}

export default function RockPaperScissorsPage() {
  const params = useSearchParams()
  const roomId = params.get('mode') === 'room' ? params.get('gameId') : null
  const aiMode = params.get('mode') === 'ai' && !roomId
  const { user } = useAuth()

  const [state, setState] = useState<RpsState>(() => freshState())
  const [players, setPlayers] = useState<RoomPlayer[]>([])
  const [saving, setSaving] = useState(false)

  const playerOrder = useMemo(() => {
    if (!roomId || !user) return null
    return players.find((player) => player.user_id === user.userId)?.player_order ?? null
  }, [players, roomId, user])

  const roomPlayer = playerForOrder(playerOrder)
  const activePlayer = roomId ? roomPlayer : aiMode ? 'player1' : state.localTurn
  const matchWinner =
    state.score.player1 >= state.target ? 'player1' :
      state.score.player2 >= state.target ? 'player2' :
        null

  const persistState = useCallback(
    async (next: RpsState) => {
      setState(next)
      if (!roomId) return
      setSaving(true)
      try {
        await DatabaseService.updateGameState(roomId, next)
      } catch (error) {
        console.error('Failed to sync Rock Paper Scissors state:', error)
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

  function chooseMove(move: RpsMove) {
    if (!activePlayer || matchWinner || state.round.revealed || state.round[activePlayer]) return
    let round = revealRound(state.round, activePlayer, move)
    if (aiMode && activePlayer === 'player1' && !round.revealed) {
      round = revealRound(round, 'player2', chooseRpsAiMove())
    }
    const nextScore = round.revealed ? applyRoundToScore(state.score, round) : state.score
    const next: RpsState = {
      ...state,
      round,
      score: nextScore,
      localTurn: activePlayer === 'player1' ? 'player2' : 'player1',
    }
    const matchOver = nextScore.player1 >= state.target || nextScore.player2 >= state.target
    if (matchOver) playSfx('win')
    else if (round.revealed) playSfx(round.winner === 'draw' ? 'pop' : 'success')
    else playSfx('move')
    void persistState(next)
  }

  function nextRound() {
    void persistState({ ...state, round: createRound(), localTurn: 'player1' })
  }

  function resetMatch() {
    void persistState(freshState())
  }

  const statusText = matchWinner
    ? `${playerName(matchWinner)} wins the match`
    : state.round.revealed
      ? state.round.winner === 'draw'
        ? 'Round draw'
        : `${playerName(state.round.winner as RpsPlayer)} wins the round`
      : roomId && !roomPlayer
        ? 'Join the room to pick'
        : activePlayer
          ? `${playerName(activePlayer)} pick`
          : 'Waiting for players'

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
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Rock Paper Scissors</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Pick in secret, reveal when both players are ready, and race to five round wins.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">{statusText}</span>
              <span className="badge">P1 {state.score.player1}</span>
              <span className="badge">P2 {state.score.player2}</span>
              {aiMode && <span className="badge">P2 is AI</span>}
              <span className="badge">Draw {state.score.draw}</span>
              {roomPlayer && <span className="badge">You are {playerName(roomPlayer)}</span>}
              {saving && <span className="badge">Syncing</span>}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="grid gap-4 md:grid-cols-2">
            {(['player1', 'player2'] as RpsPlayer[]).map((player) => {
              const picked = Boolean(state.round[player])
              const visible = state.round.revealed
              return (
                <div
                  key={player}
                  className={`rounded-3xl border border-[#eedfc8]/10 bg-[#eedfc8]/5 p-5 ${
                    activePlayer === player && !state.round.revealed ? 'ring-2 ring-[#D19A58]/60' : ''
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
                    {playerName(player)}
                  </p>
                  <p className="mt-3 text-2xl font-bold text-[#eedfc8]">
                    {visible && state.round[player] ? moveLabels[state.round[player] as RpsMove] : picked ? 'Locked' : 'Waiting'}
                  </p>
                  <p className="mt-1 text-sm text-[#eedfc8]/50">
                    {visible ? 'Revealed' : picked ? 'Choice saved' : 'No pick yet'}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {(['rock', 'paper', 'scissors'] as RpsMove[]).map((move) => (
              <button
                key={move}
                type="button"
                onClick={() => chooseMove(move)}
                disabled={!activePlayer || Boolean(matchWinner) || state.round.revealed || Boolean(state.round[activePlayer])}
                className="flex min-h-28 flex-col items-center justify-center rounded-3xl border border-[#eedfc8]/10 bg-[#eedfc8]/6 p-4 text-[#eedfc8] transition hover:bg-[#eedfc8]/12 disabled:opacity-45"
              >
                <i className={`${moveIcons[move]} text-3xl text-[#D19A58]`} aria-hidden="true" />
                <span className="mt-2 text-sm font-semibold">{moveLabels[move]}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {state.round.revealed && !matchWinner && (
              <button type="button" onClick={nextRound} className="btn-primary !rounded-2xl !px-4 !py-2 text-sm">
                Next round
              </button>
            )}
            <button type="button" onClick={resetMatch} className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">
              Reset match
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
