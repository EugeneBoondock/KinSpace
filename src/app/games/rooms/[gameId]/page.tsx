'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { RealtimeService } from '@/lib/realtime'
import { getGameDefinition, getGameHref } from '@/lib/games'
import { formatCompactNumber, formatRelativeTime, getInitials } from '@/lib/platform'
import { useToast } from '@/components/Toast'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  Skeleton,
} from '@/components/ui'

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
      // rawPlayers lack profile joins - hydrate in a single pass
      const list = Array.isArray(rawPlayers) ? (rawPlayers as Array<Record<string, unknown>>) : []
      const hydrated = await Promise.all(
        list.map(async (player) => {
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
        <div className="space-y-6">
          <Skeleton className="h-28 rounded-3xl" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-44 rounded-3xl" />
            <Skeleton className="h-44 rounded-3xl" />
            <Skeleton className="h-44 rounded-3xl" />
          </div>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  if (!room) {
    return (
      <PageFrame>
        <EmptyState
          icon={<i className="ri-error-warning-line text-4xl" aria-hidden="true" />}
          title="Room not found"
          description="This room may have been closed, or the link is no longer valid. Let's get you back to the games."
          action={<LinkButton href="/games">Back to games</LinkButton>}
        />
        <BottomNav />
      </PageFrame>
    )
  }

  const seatsOpen = Math.max(
    0,
    ((room.max_players as number | undefined) ?? 0) -
      ((room.current_players as number | undefined) ?? 0),
  )

  return (
    <PageFrame>
      <div className="space-y-6">
        <div>
          <LinkButton
            href="/games"
            variant="ghost"
            size="sm"
            leadingIcon={<i className="ri-arrow-left-line" aria-hidden="true" />}
            className="!px-3"
          >
            Back to games
          </LinkButton>
        </div>

        <Card className="!p-0 overflow-hidden">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_20rem]">
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-background/10 text-3xl"
                  aria-hidden="true"
                >
                  {game?.icon ?? '🎮'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-background/40">
                    Live room
                  </p>
                  <h1 className="mt-1 text-2xl font-bold text-brand-background sm:text-3xl">
                    {game?.name ?? 'Game room'}
                  </h1>
                </div>
              </div>

              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-brand-background/65">
                Hosted by {getDisplayName(room.host, 'Community host')}, opened{' '}
                {formatRelativeTime(room.created_at)}. Gather a few people here, share the
                link, then open the board when everyone&apos;s ready. No rush.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <Badge>
                  Players {formatCompactNumber(room.current_players as number | undefined)}/
                  {formatCompactNumber(room.max_players as number | undefined)}
                </Badge>
                <Badge className="capitalize">
                  {(room.status as string | undefined) ?? 'waiting'}
                </Badge>
                <Badge>
                  {room.room_code ? `Code ${room.room_code as string}` : 'Public room'}
                </Badge>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {canJoin && (
                  <Button onClick={handleJoinRoom} isLoading={joining} className="!rounded-xl">
                    {joining ? 'Joining…' : 'Join this room'}
                  </Button>
                )}
                {isMember && (
                  <LinkButton
                    href={getGameHref(room.game_type as string | undefined, {
                      mode: 'room',
                      gameId: room.id,
                    })}
                    className="!rounded-xl"
                  >
                    Open board
                  </LinkButton>
                )}
                <Button
                  variant="secondary"
                  leadingIcon={<i className="ri-link" aria-hidden="true" />}
                  onClick={async () => {
                    if (typeof window === 'undefined') return
                    const link = `${window.location.origin}/games/rooms/${room.id}`
                    try {
                      await navigator.clipboard.writeText(link)
                      toast('Room link copied', 'success')
                    } catch {
                      toast('Copy failed - long-press the URL to copy', 'error')
                    }
                  }}
                  className="!rounded-xl"
                >
                  Copy invite link
                </Button>
                {isMember && (
                  <Button
                    variant="danger"
                    onClick={handleLeaveRoom}
                    isLoading={leaving}
                    className="!rounded-xl !bg-brand-accent1/10 !text-brand-accent1 hover:!bg-brand-accent1/20 border border-brand-accent1/30"
                  >
                    {leaving ? 'Leaving…' : isHost ? 'Close room' : 'Leave room'}
                  </Button>
                )}
              </div>
            </div>

            <div className="border-t border-brand-background/10 bg-brand-background/[0.04] p-6 lg:border-l lg:border-t-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-background/40">
                Room status
              </p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.06] p-4">
                  <p className="text-xs text-brand-background/50">Seats still open</p>
                  <p className="mt-2 text-3xl font-bold text-brand-accent2">
                    {formatCompactNumber(seatsOpen)}
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.06] p-4">
                  <p className="text-xs text-brand-background/50">Host controls</p>
                  <p className="mt-2 text-sm font-semibold text-brand-background">
                    {isHost
                      ? 'You are hosting this room.'
                      : `${getDisplayName(room.host, 'Community host')} is hosting.`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_20rem] lg:items-start">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-brand-background">Players in the room</h2>
              <span className="text-sm text-brand-background/50">
                {formatCompactNumber(players.length)} joined
              </span>
            </div>

            {players.length > 0 ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {players.map((player) => {
                  const name = getDisplayName(player.profile, 'Player')
                  const isCurrentUser = player.user_id === user?.userId

                  return (
                    <div
                      key={player.id}
                      className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.06] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-accent2/18 text-sm font-bold text-brand-accent2"
                          aria-hidden="true"
                        >
                          {getInitials(name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-brand-background">
                              {isCurrentUser ? `${name} (you)` : name}
                            </p>
                            {player.user_id === room.host_id && (
                              <Badge tone="accent">Host</Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-brand-background/40">
                            Joined {formatRelativeTime(player.joined_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="mt-5 text-sm text-brand-background/55">
                No one has joined yet. Share the invite link to get things started.
              </p>
            )}
          </Card>

          <aside className="space-y-4">
            <Card>
              <h2 className="mb-3 text-sm font-bold text-brand-background">What happens next</h2>
              <div className="space-y-3 text-sm leading-relaxed text-brand-background/60">
                <p>Share the room link or code so others can join from the lobby.</p>
                <p>
                  Once you&apos;re in, use the board button to jump into the game interface for
                  your session.
                </p>
                {!isMember && !canJoin && (
                  <p>
                    This room is currently full, so you can watch the lobby until someone
                    leaves.
                  </p>
                )}
              </div>
            </Card>
          </aside>
        </div>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
