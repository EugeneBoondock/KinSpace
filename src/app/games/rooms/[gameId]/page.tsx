'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { RealtimeService } from '@/lib/realtime'
import { getGameDefinition, getGameHref } from '@/lib/games'
import { formatCompactNumber, formatRelativeTime, getInitials } from '@/lib/platform'
import { useToast } from '@/components/Toast'

type GameRoom = Record<string, unknown> & {
  id: string
  host?: Record<string, unknown> | null
}

type GamePlayer = Record<string, unknown> & {
  id: string
  profile?: Record<string, unknown> | null
}

function getDisplayName(profile: Record<string, unknown> | null | undefined, fallback: string) {
  return (
    (profile?.full_name as string | undefined) ||
    (profile?.username as string | undefined) ||
    fallback
  )
}

export default function GameRoomPage() {
  const params = useParams<{ gameId: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { push: toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [room, setRoom] = useState<GameRoom | null>(null)
  const [players, setPlayers] = useState<GamePlayer[]>([])

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, router, user])

  const loadRoom = useCallback(async () => {
    if (!params.gameId) return

    setLoading(true)
    try {
      const [roomData, roomPlayers] = await Promise.all([
        DatabaseService.getGame(params.gameId),
        DatabaseService.getGamePlayers(params.gameId),
      ])

      setRoom(roomData as GameRoom | null)
      setPlayers(roomPlayers as GamePlayer[])
    } catch (error) {
      console.error('Failed to load room:', error)
    } finally {
      setLoading(false)
    }
  }, [params.gameId])

  useEffect(() => {
    void loadRoom()
  }, [loadRoom])

  // Real-time: subscribe to room + players updates so the lobby is always fresh.
  useEffect(() => {
    if (!params.gameId) return

    const unsubRoom = RealtimeService.subscribeToGame(params.gameId, (data) => {
      setRoom(data as GameRoom)
    })

    const unsubPlayers = RealtimeService.subscribeToGamePlayers(params.gameId, async (rawPlayers) => {
      // rawPlayers lack profile joins — hydrate in a single pass
      const hydrated = await Promise.all(
        rawPlayers.map(async (player) => {
          const userId = (player as { user_id?: string }).user_id
          if (!userId) return player as GamePlayer
          const profile = await DatabaseService.getProfile(userId).catch(() => null)
          return { ...player, profile } as GamePlayer
        }),
      )
      hydrated.sort((a, b) => ((a.player_order as number | undefined) ?? 0) - ((b.player_order as number | undefined) ?? 0))
      setPlayers(hydrated)
    })

    return () => {
      unsubRoom()
      unsubPlayers()
    }
  }, [params.gameId])

  const game = getGameDefinition(room?.game_type as string | undefined)
  const playerIds = useMemo(
    () => new Set(players.map((player) => player.user_id as string | undefined).filter(Boolean)),
    [players],
  )
  const isMember = Boolean(user?.userId && playerIds.has(user.userId))
  const isHost = user?.userId === (room?.host_id as string | undefined)
  const isFull =
    ((room?.current_players as number | undefined) ?? 0) >=
    ((room?.max_players as number | undefined) ?? 0)
  const canJoin = Boolean(room && user && !isMember && !isFull && room.status === 'waiting')

  async function handleJoinRoom() {
    if (!room || !user) return

    setJoining(true)
    try {
      await DatabaseService.joinGame(room.id, user.userId)
      toast('Joined the room', 'success')
    } catch (error) {
      console.error('Failed to join room:', error)
      toast('Could not join this room', 'error')
    } finally {
      setJoining(false)
    }
  }

  async function handleLeaveRoom() {
    if (!room || !user) return
    const confirmMessage = isHost
      ? 'Leaving as host closes the room for everyone. Continue?'
      : 'Leave this room?'
    if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) return

    setLeaving(true)
    try {
      const result = await DatabaseService.leaveGame(room.id, user.userId)
      toast(result.archived ? 'Room closed' : 'Left the room', 'success')
      router.push('/games')
    } catch (error) {
      console.error('Failed to leave room:', error)
      toast('Could not leave room', 'error')
    } finally {
      setLeaving(false)
    }
  }

  if (authLoading || loading || (!user && !authLoading)) {
    return (
      <PageFrame>
        <div className="space-y-5">
          <div className="h-28 skeleton rounded-3xl" />
          <div className="page-card-grid">
            <div className="h-44 skeleton rounded-3xl" />
            <div className="h-44 skeleton rounded-3xl" />
            <div className="h-44 skeleton rounded-3xl" />
          </div>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  if (!room) {
    return (
      <PageFrame>
        <div className="page-grid">
          <section className="card text-center">
            <i className="ri-error-warning-line text-3xl text-[#eedfc8]/30" />
            <h1 className="mt-3 text-2xl font-bold text-[#eedfc8]">Room not found</h1>
            <p className="mt-2 text-sm text-[#eedfc8]/60">
              This room may have been removed or the link is no longer valid.
            </p>
            <Link
              href="/games"
              className="btn-primary mt-5 inline-flex !rounded-2xl !px-5 !py-3 text-sm"
            >
              Back to games
            </Link>
          </section>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card overflow-hidden !p-0">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_20rem]">
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-3">
                <Link
                  href="/games"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eedfc8]/8 text-[#eedfc8]/70"
                >
                  <i className="ri-arrow-left-line text-xl" />
                </Link>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eedfc8]/10 text-3xl">
                  {game?.icon ?? '🎮'}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/35">
                    Live room
                  </p>
                  <h1 className="mt-1 text-3xl font-bold text-[#eedfc8]">
                    {game?.name ?? 'Game room'}
                  </h1>
                </div>
              </div>

              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[#eedfc8]/60">
                Hosted by {getDisplayName(room.host, 'Community host')} and created{' '}
                {formatRelativeTime(room.created_at)}. Use this lobby to gather players,
                share the room link, and open the game board once everyone is ready.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-xs text-[#eedfc8]/50">
                <span className="badge">
                  Players {formatCompactNumber(room.current_players as number | undefined)}/
                  {formatCompactNumber(room.max_players as number | undefined)}
                </span>
                <span className="badge">
                  Status {(room.status as string | undefined) ?? 'waiting'}
                </span>
                <span className="badge">
                  {room.room_code ? `Code ${room.room_code as string}` : 'Public room'}
                </span>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                {canJoin && (
                  <button
                    onClick={handleJoinRoom}
                    disabled={joining}
                    className="btn-primary !rounded-2xl !py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {joining ? 'Joining...' : 'Join this room'}
                  </button>
                )}
                {isMember && (
                  <Link
                    href={getGameHref(room.game_type as string | undefined, {
                      mode: 'room',
                      gameId: room.id,
                    })}
                    className="btn-primary !rounded-2xl !py-3 text-center text-sm"
                  >
                    Open local board
                  </Link>
                )}
                <button
                  onClick={async () => {
                    if (typeof window === 'undefined') return
                    const link = `${window.location.origin}/games/rooms/${room.id}`
                    try {
                      await navigator.clipboard.writeText(link)
                      toast('Room link copied', 'success')
                    } catch {
                      toast('Copy failed — long-press the URL to copy', 'error')
                    }
                  }}
                  className="btn-secondary !rounded-2xl !py-3 text-sm"
                >
                  Copy invite link
                </button>
                {isMember && (
                  <button
                    onClick={handleLeaveRoom}
                    disabled={leaving}
                    className="rounded-2xl border border-[#B85C3A]/30 bg-[#B85C3A]/10 px-4 py-3 text-sm font-medium text-[#B85C3A] transition-colors hover:bg-[#B85C3A]/20 disabled:opacity-50"
                  >
                    {leaving ? 'Leaving…' : isHost ? 'Close room' : 'Leave room'}
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-[#eedfc8]/10 bg-[#eedfc8]/4 p-6 lg:border-l lg:border-t-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
                Room status
              </p>
              <div className="mt-4 space-y-3">
                <div className="card-light !p-4">
                  <p className="text-xs text-[#eedfc8]/45">Seats still open</p>
                  <p className="mt-2 text-3xl font-bold text-[#D19A58]">
                    {formatCompactNumber(
                      Math.max(
                        0,
                        ((room.max_players as number | undefined) ?? 0) -
                          ((room.current_players as number | undefined) ?? 0),
                      ),
                    )}
                  </p>
                </div>
                <div className="card-light !p-4">
                  <p className="text-xs text-[#eedfc8]/45">Host controls</p>
                  <p className="mt-2 text-sm font-semibold text-[#eedfc8]">
                    {isHost
                      ? 'You are hosting this room.'
                      : `${getDisplayName(room.host, 'Community host')} is hosting.`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="page-grid lg:grid-cols-[minmax(0,1.2fr)_20rem] lg:items-start">
          <section className="card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title !mb-0">Players in the room</h2>
              <span className="text-sm text-[#eedfc8]/45">
                {formatCompactNumber(players.length)} joined
              </span>
            </div>

            <div className="mt-5 page-card-grid">
              {players.map((player) => {
                const name = getDisplayName(player.profile, 'Player')
                const isCurrentUser = player.user_id === user?.userId

                return (
                  <article key={player.id} className="card-light !p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D19A58]/18 text-sm font-bold text-[#D19A58]">
                        {getInitials(name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-[#eedfc8]">
                            {isCurrentUser ? `${name} (you)` : name}
                          </p>
                          {player.user_id === room.host_id && (
                            <span className="badge bg-[#D19A58]/12 text-[10px] text-[#D19A58]">
                              Host
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[#eedfc8]/40">
                          Joined {formatRelativeTime(player.joined_at)}
                        </p>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="card">
              <h2 className="section-title">What happens next</h2>
              <div className="space-y-3 text-sm leading-relaxed text-[#eedfc8]/60">
                <p>Share the room link or code with others so they can join from the lobby.</p>
                <p>
                  Once you are in the room, use the board button to jump into the current
                  game interface for your session.
                </p>
                {!isMember && !canJoin && (
                  <p>
                    This room is currently full, so you can watch the lobby until someone
                    leaves.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
