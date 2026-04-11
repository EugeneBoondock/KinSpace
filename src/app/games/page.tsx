'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import { gameCatalog, getGameDefinition, getGameHref, type GameDifficulty, type GameId } from '@/lib/games'
import { formatCompactNumber, formatRelativeTime } from '@/lib/platform'

type ActiveTab = 'practice' | 'rooms'

type GameRoom = Record<string, unknown> & {
  id: string
  host?: Record<string, unknown> | null
}

const tabs: Array<{ id: ActiveTab; label: string; icon: string }> = [
  { id: 'practice', label: 'Practice', icon: 'ri-gamepad-line' },
  { id: 'rooms', label: 'Live rooms', icon: 'ri-group-line' },
]

function getHostName(room: GameRoom) {
  const host = room.host ?? {}
  return (
    (host.full_name as string | undefined) ||
    (host.username as string | undefined) ||
    'Community host'
  )
}

export default function GamesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('practice')
  const [rooms, setRooms] = useState<GameRoom[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedGameId, setSelectedGameId] = useState<GameId>('chess')
  const [selectedCapacity, setSelectedCapacity] = useState(2)
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [refreshingRooms, setRefreshingRooms] = useState(false)
  const [practiceDifficulty, setPracticeDifficulty] = useState<Record<GameId, GameDifficulty>>({
    chess: 'medium',
    checkers: 'medium',
    tictactoe: 'medium',
    wordle: 'medium',
    uno: 'medium',
    drawing: 'medium',
  })

  const selectedGame = useMemo(
    () => gameCatalog.find((game) => game.id === selectedGameId) ?? gameCatalog[0],
    [selectedGameId],
  )

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, router, user])

  const loadRooms = useCallback(
    async (options?: { quiet?: boolean }) => {
      if (!user) return

      if (options?.quiet) setRefreshingRooms(true)
      else setLoading(true)

      try {
        const openRooms = await DatabaseService.getActiveGames()
        setRooms(openRooms as GameRoom[])
      } catch (error) {
        console.error('Failed to load games:', error)
      } finally {
        setLoading(false)
        setRefreshingRooms(false)
      }
    },
    [user],
  )

  useEffect(() => {
    if (user) {
      void loadRooms()
    }
  }, [loadRooms, user])

  function openCreateModal(gameId: GameId) {
    const game = gameCatalog.find((item) => item.id === gameId) ?? gameCatalog[0]
    setSelectedGameId(game.id)
    setSelectedCapacity(game.maxPlayers)
    setShowCreateModal(true)
  }

  async function handleCreateRoom() {
    if (!user) return

    setCreatingRoom(true)
    try {
      const room = await DatabaseService.createGame(
        user.userId,
        selectedGame.id,
        selectedCapacity,
        false,
      )

      setShowCreateModal(false)
      await loadRooms({ quiet: true })
      router.push(`/games/rooms/${room.id}`)
    } catch (error) {
      console.error('Failed to create game room:', error)
    } finally {
      setCreatingRoom(false)
    }
  }

  const openSeats = useMemo(
    () =>
      rooms.reduce(
        (total, room) =>
          total +
          Math.max(
            0,
            ((room.max_players as number | undefined) ?? 0) -
              ((room.current_players as number | undefined) ?? 0),
          ),
        0,
      ),
    [rooms],
  )

  const gamesWithRooms = useMemo(() => {
    const counts = new Map<string, number>()
    rooms.forEach((room) => {
      const gameType = room.game_type as string | undefined
      if (!gameType) return
      counts.set(gameType, (counts.get(gameType) ?? 0) + 1)
    })
    return counts
  }, [rooms])

  if (authLoading || loading || (!user && !authLoading)) {
    return (
      <PageFrame>
        <div className="space-y-5">
          <div className="h-28 skeleton rounded-3xl" />
          <div className="h-14 skeleton rounded-full" />
          <div className="page-card-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-56 skeleton rounded-3xl" />
            ))}
          </div>
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
                Games
              </p>
              <h1 className="mt-3 text-3xl font-bold text-[#eedfc8]">
                Play together in live rooms
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#eedfc8]/60">
                Practice solo, challenge the AI, or open real rooms backed by Firestore so
                people can actually gather before a session.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-xs text-[#eedfc8]/50">
                <span className="badge">Games {formatCompactNumber(gameCatalog.length)}</span>
                <span className="badge">Open rooms {formatCompactNumber(rooms.length)}</span>
                <span className="badge">Seats open {formatCompactNumber(openSeats)}</span>
              </div>
            </div>

            <div className="border-t border-[#eedfc8]/10 bg-[#eedfc8]/4 p-6 lg:border-l lg:border-t-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">
                Live snapshot
              </p>
              <div className="mt-4 space-y-3">
                <div className="card-light !p-4">
                  <p className="text-xs text-[#eedfc8]/45">Rooms waiting for players</p>
                  <p className="mt-2 text-3xl font-bold text-[#D19A58]">
                    {formatCompactNumber(rooms.length)}
                  </p>
                </div>
                <div className="card-light !p-4">
                  <p className="text-xs text-[#eedfc8]/45">Most active game</p>
                  <p className="mt-2 text-sm font-semibold text-[#eedfc8]">
                    {gameCatalog
                      .slice()
                      .sort(
                        (first, second) =>
                          (gamesWithRooms.get(second.id) ?? 0) -
                          (gamesWithRooms.get(first.id) ?? 0),
                      )[0]?.name ?? 'No live rooms yet'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="flex gap-2 overflow-x-auto rounded-2xl bg-[#eedfc8]/5 p-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-w-fit items-center gap-2 rounded-2xl px-4 py-2.5 text-sm transition-all ${
                  activeTab === tab.id ? 'tab-active' : 'tab-inactive'
                }`}
              >
                <i className={tab.icon} />
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {activeTab === 'practice' ? (
          <section className="page-card-grid">
            {gameCatalog.map((game) => (
              <article key={game.id} className="card">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eedfc8]/10 text-3xl">
                    {game.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-[#eedfc8]">{game.name}</h2>
                      <span className="badge text-[10px]">{game.difficultyLabel}</span>
                      {(gamesWithRooms.get(game.id) ?? 0) > 0 && (
                        <span className="badge bg-[#D19A58]/12 text-[10px] text-[#D19A58]">
                          {formatCompactNumber(gamesWithRooms.get(game.id))}
                          {' '}live room
                          {(gamesWithRooms.get(game.id) ?? 0) === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[#eedfc8]/65">
                      {game.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-xs text-[#eedfc8]/45">
                  <span className="flex items-center gap-1.5">
                    <i className="ri-user-line" />
                    {game.playersLabel}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="ri-time-line" />
                    {game.duration}
                  </span>
                </div>

                {game.supportsDifficulty && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#eedfc8]/35">
                      Difficulty
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(['easy', 'medium', 'hard'] as GameDifficulty[]).map((level) => (
                        <button
                          key={level}
                          onClick={() =>
                            setPracticeDifficulty((current) => ({
                              ...current,
                              [game.id]: level,
                            }))
                          }
                          className={`rounded-2xl border px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                            practiceDifficulty[game.id] === level
                              ? 'border-[#D19A58]/50 bg-[#D19A58]/12 text-[#D19A58]'
                              : 'border-[#eedfc8]/10 bg-[#eedfc8]/4 text-[#eedfc8]/55 hover:bg-[#eedfc8]/8'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={getGameHref(game.id, {
                      difficulty: practiceDifficulty[game.id],
                    })}
                    className="btn-primary flex-1 !rounded-2xl !py-3 text-center text-sm"
                  >
                    {game.practiceLabel}
                  </Link>
                  {game.maxPlayers > 1 && (
                    <button
                      onClick={() => openCreateModal(game.id)}
                      className="btn-secondary flex-1 !rounded-2xl !py-3 text-sm"
                    >
                      Open live room
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>
        ) : (
          <div className="page-grid lg:grid-cols-[minmax(0,1.2fr)_20rem] lg:items-start">
            <section className="space-y-4">
              {rooms.length > 0 ? (
                rooms.map((room) => {
                  const game = getGameDefinition(room.game_type as string | undefined)

                  return (
                    <article key={room.id} className="card">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex items-start gap-4">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eedfc8]/10 text-3xl">
                            {game?.icon ?? '🎮'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-xl font-semibold text-[#eedfc8]">
                                {game?.name ?? 'Game room'}
                              </h2>
                              <span className="badge text-[10px]">
                                {(room.status as string | undefined) ?? 'waiting'}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-[#eedfc8]/60">
                              Hosted by {getHostName(room)} · Opened{' '}
                              {formatRelativeTime(room.created_at)}
                            </p>
                            <p className="mt-3 text-sm leading-relaxed text-[#eedfc8]/65">
                              {(room.current_players as number | undefined) ?? 0} of{' '}
                              {(room.max_players as number | undefined) ?? 0} seats filled.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-start gap-3 md:items-end">
                          <div className="rounded-2xl bg-[#eedfc8]/6 px-4 py-3 text-sm text-[#eedfc8]/70">
                            Room {room.room_code ? `#${room.room_code as string}` : 'is public'}
                          </div>
                          <Link
                            href={`/games/rooms/${room.id}`}
                            className="btn-primary !rounded-2xl !px-4 !py-2.5 text-sm"
                          >
                            Open room
                          </Link>
                        </div>
                      </div>
                    </article>
                  )
                })
              ) : (
                <div className="card-light text-center">
                  <i className="ri-group-line text-3xl text-[#eedfc8]/30" />
                  <p className="mt-3 text-sm text-[#eedfc8]/60">
                    No live rooms are waiting right now.
                  </p>
                  <p className="mt-1 text-xs text-[#eedfc8]/40">
                    Open one from the practice tab and it will appear here immediately.
                  </p>
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <section className="card">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="section-title !mb-0">Room tools</h2>
                  <button
                    onClick={() => void loadRooms({ quiet: true })}
                    className="text-sm font-medium text-[#D19A58]"
                  >
                    {refreshingRooms ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="card-light !p-4">
                    <p className="text-xs text-[#eedfc8]/45">Open seats</p>
                    <p className="mt-1 text-xl font-semibold text-[#eedfc8]">
                      {formatCompactNumber(openSeats)}
                    </p>
                  </div>
                  <div className="card-light !p-4">
                    <p className="text-xs text-[#eedfc8]/45">Recommended move</p>
                    <p className="mt-1 text-sm font-semibold text-[#eedfc8]">
                      {rooms.length > 0
                        ? 'Jump into a room with open seats'
                        : 'Create the first room for your game'}
                    </p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/55 p-4 md:items-center md:justify-center">
          <div className="w-full max-w-lg rounded-[1.75rem] border border-[#eedfc8]/10 bg-[#24423b] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#eedfc8]/10 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/35">
                  New room
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[#eedfc8]">
                  {selectedGame.name}
                </h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eedfc8]/6 text-[#eedfc8]/65"
              >
                <i className="ri-close-line text-xl" />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
              <div className="rounded-2xl bg-[#eedfc8]/6 p-4">
                <p className="text-sm leading-relaxed text-[#eedfc8]/65">
                  This creates a real room document in Firestore and adds you as the host.
                  People can join it from the live rooms list right away.
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-[#eedfc8]">Capacity</label>
                <select
                  value={selectedCapacity}
                  onChange={(event) => setSelectedCapacity(Number(event.target.value))}
                  className="input-field mt-2"
                >
                  {Array.from(
                    { length: Math.max(0, selectedGame.maxPlayers - 1) },
                    (_, index) => index + 2,
                  ).map((count) => (
                    <option key={count} value={count}>
                      {count} players
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1 !rounded-2xl !py-3 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRoom}
                  disabled={creatingRoom}
                  className="btn-primary flex-1 !rounded-2xl !py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creatingRoom ? 'Creating...' : 'Create room'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </PageFrame>
  )
}
