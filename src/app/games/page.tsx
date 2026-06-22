'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'
import {
  gameCatalog,
  gameCategories,
  getGameDefinition,
  getGameHref,
  type GameCategory,
  type GameDifficulty,
  type GameId,
  type GameLogo,
} from '@/lib/games'
import { formatCompactNumber, formatRelativeTime } from '@/lib/platform'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  LinkButton,
  Modal,
  Skeleton,
} from '@/components/ui'
import { cn } from '@/lib/cn'

type ActiveTab = 'practice' | 'vs' | 'rooms'

type GameRoom = Record<string, unknown> & {
  id: string
  host?: Record<string, unknown> | null
}

const tabs: Array<{ id: ActiveTab; label: string; icon: string }> = [
  { id: 'practice', label: 'Practice', icon: 'ri-gamepad-line' },
  { id: 'vs', label: 'VS games', icon: 'ri-sword-line' },
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

function GameMark({ logo, fallback }: { logo: GameLogo; fallback: string }) {
  const frame = 'relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-background/10'

  if (logo.kind === 'connect-four') {
    return (
      <div className={frame} aria-hidden="true">
        <div className="grid grid-cols-2 gap-1.5">
          {['bg-[#B85C3A]', 'bg-[#D19A58]', 'bg-[#D19A58]', 'bg-[#B85C3A]'].map((color, index) => (
            <span key={index} className={cn('h-4 w-4 rounded-full shadow-inner', color)} />
          ))}
        </div>
      </div>
    )
  }

  if (logo.kind === 'reversi' || logo.kind === 'go') {
    return (
      <div className={frame} aria-hidden="true">
        <span className="absolute left-3 top-3 h-5 w-5 rounded-full bg-[#0f1f1b] shadow-md ring-1 ring-[#eedfc8]/20" />
        <span className="absolute bottom-3 right-3 h-5 w-5 rounded-full bg-[#eedfc8] shadow-md ring-1 ring-[#0f1f1b]/20" />
        {logo.kind === 'go' && <span className="absolute h-px w-10 bg-[#eedfc8]/25" />}
      </div>
    )
  }

  if (logo.kind === 'rps') {
    return (
      <div className={frame} aria-hidden="true">
        <i className="ri-hand-heart-line text-3xl text-[#eedfc8]" />
      </div>
    )
  }

  if (logo.kind === 'xiangqi') {
    return (
      <div className={frame} aria-hidden="true">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D19A58]/50 bg-[#B85C3A]/30 text-sm font-bold text-[#eedfc8]">
          XQ
        </span>
      </div>
    )
  }

  if (logo.kind === 'gomoku') {
    return (
      <div className={frame} aria-hidden="true">
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, index) => (
            <span key={index} className={cn('h-2.5 w-2.5 rounded-full', index % 2 ? 'bg-[#eedfc8]' : 'bg-[#0f1f1b]')} />
          ))}
        </div>
      </div>
    )
  }

  if (logo.kind === 'battleship') {
    return (
      <div className={frame} aria-hidden="true">
        <i className="ri-ship-2-line text-3xl text-[#eedfc8]" />
      </div>
    )
  }

  if (logo.kind === 'dots') {
    return (
      <div className={frame} aria-hidden="true">
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, index) => (
            <span key={index} className="h-1.5 w-1.5 rounded-full bg-[#eedfc8]" />
          ))}
        </div>
        <span className="absolute left-5 top-5 h-px w-5 bg-[#D19A58]" />
        <span className="absolute left-5 top-5 h-5 w-px bg-[#D19A58]" />
      </div>
    )
  }

  return (
    <div className={`${frame} text-3xl`} aria-hidden="true">
      {logo.kind === 'emoji' || logo.kind === 'text' ? logo.value : fallback}
    </div>
  )
}

export default function GamesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('practice')
  const [category, setCategory] = useState<GameCategory | 'all'>('all')
  const [rooms, setRooms] = useState<GameRoom[]>([])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [tutorialGameId, setTutorialGameId] = useState<GameId | null>(null)
  const [selectedGameId, setSelectedGameId] = useState<GameId>('chess')
  const [selectedCapacity, setSelectedCapacity] = useState(2)
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [refreshingRooms, setRefreshingRooms] = useState(false)
  const [practiceDifficulty, setPracticeDifficulty] = useState<Record<string, GameDifficulty>>({})

  const filteredGames = useMemo(() => {
    if (category === 'all') return gameCatalog
    return gameCatalog.filter((game) => game.category === category)
  }, [category])

  const vsGames = useMemo(() => gameCatalog.filter((game) => game.isMultiplayer), [])
  const visibleGames = activeTab === 'vs' ? vsGames : filteredGames

  const selectedGame = useMemo(
    () => gameCatalog.find((game) => game.id === selectedGameId) ?? gameCatalog[0],
    [selectedGameId],
  )
  const tutorialGame = useMemo(
    () => gameCatalog.find((game) => game.id === tutorialGameId) ?? null,
    [tutorialGameId],
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
    if (!user) return
    void loadRooms()
    DatabaseService.getProfile(user.userId)
      .then((profile) => {
        const high = (profile?.games_high_scores as Record<string, number> | undefined) ?? {}
        setScores(high)
      })
      .catch(() => undefined)
  }, [loadRooms, user])

  function openCreateModal(gameId: GameId) {
    const game = gameCatalog.find((item) => item.id === gameId) ?? gameCatalog[0]
    setSelectedGameId(game.id)
    setSelectedCapacity(Math.max(2, game.maxPlayers))
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

  const topScores = useMemo(() => {
    return Object.entries(scores)
      .map(([gameId, score]) => ({
        gameId,
        score,
        game: getGameDefinition(gameId),
      }))
      .filter((item) => item.game)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
  }, [scores])

  if (authLoading || loading || (!user && !authLoading)) {
    return (
      <PageFrame>
        <div className="space-y-6">
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-14 rounded-full" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-56 rounded-3xl" />
            ))}
          </div>
        </div>
        <BottomNav />
      </PageFrame>
    )
  }

  return (
    <PageFrame>
      <div className="space-y-6">
        <header className="space-y-3">
          <h1 className="text-2xl font-bold text-brand-background sm:text-3xl">
            Games
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-brand-background/70">
            A quick puzzle to catch your breath, a classic match against the computer,
            or an open room when you want real company. No pressure, no clock - play your way.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge>{formatCompactNumber(gameCatalog.length)} games</Badge>
            <Badge>{formatCompactNumber(rooms.length)} open rooms</Badge>
            <Badge tone="accent">{formatCompactNumber(openSeats)} seats open</Badge>
          </div>
        </header>

        {topScores.length > 0 && (
          <Card>
            <h2 className="text-sm font-semibold text-brand-background">Your best scores</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {topScores.map(({ gameId, score, game }) => (
                <div
                  key={gameId}
                  className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.06] p-4"
                >
                  <p className="text-xs text-brand-background/50">{game?.name}</p>
                  <p className="mt-1 text-2xl font-bold text-brand-accent2">
                    {score.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div
          role="tablist"
          aria-label="Games view"
          className="flex gap-2 overflow-x-auto rounded-2xl bg-brand-background/5 p-1.5"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex min-w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                  isActive
                    ? 'bg-brand-background/20 text-brand-background shadow-sm'
                    : 'text-brand-background/60 hover:text-brand-background/80',
                )}
              >
                <i className={tab.icon} aria-hidden="true" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {activeTab !== 'rooms' ? (
          <>
            {activeTab === 'practice' ? (
              <div
                role="group"
                aria-label="Filter games by category"
                className="flex gap-2 overflow-x-auto pb-1"
              >
                {gameCategories.map((option) => {
                  const isActive = category === option.id
                  return (
                    <button
                      key={option.id}
                      onClick={() => setCategory(option.id)}
                      aria-pressed={isActive}
                      className={cn(
                        'h-11 whitespace-nowrap rounded-full px-5 text-sm font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                        isActive
                          ? 'bg-brand-background text-brand-primary'
                          : 'bg-brand-background/[0.08] text-brand-background/65 hover:bg-brand-background/15',
                      )}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            ) : (
              <Card>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-brand-background">VS games</h2>
                    <p className="mt-1 text-sm leading-relaxed text-brand-background/60">
                      Head-to-head games for local play or live rooms. Start a board now, or open a room when someone else wants to join.
                    </p>
                  </div>
                  <Badge tone="accent">{formatCompactNumber(vsGames.length)} VS games</Badge>
                </div>
              </Card>
            )}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleGames.map((game) => (
                <Card key={game.id} role="group" aria-label={`${game.name} game`} className="flex flex-col">
                  <div className="flex items-start gap-4">
                    <GameMark logo={game.logo} fallback={game.icon} />
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold text-brand-background">{game.name}</h2>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge className="capitalize">{game.category}</Badge>
                        <Badge>{game.difficultyLabel}</Badge>
                        {(gamesWithRooms.get(game.id) ?? 0) > 0 && (
                          <Badge tone="accent">
                            {formatCompactNumber(gamesWithRooms.get(game.id))}
                            {' '}live room
                            {(gamesWithRooms.get(game.id) ?? 0) === 1 ? '' : 's'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-brand-background/65">
                    {game.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-brand-background/50">
                    <span className="flex items-center gap-1.5">
                      <i className="ri-user-line" aria-hidden="true" />
                      {game.playersLabel}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <i className="ri-time-line" aria-hidden="true" />
                      {game.duration}
                    </span>
                    <span className="flex items-center gap-1.5 text-brand-background/35">
                      {game.engine}
                    </span>
                  </div>

                  {game.supportsDifficulty && (
                    <fieldset className="mt-4">
                      <legend className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-background/40">
                        Difficulty
                      </legend>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {(['easy', 'medium', 'hard'] as GameDifficulty[]).map((level) => {
                          const isActive = (practiceDifficulty[game.id] ?? 'medium') === level
                          return (
                            <button
                              key={level}
                              onClick={() =>
                                setPracticeDifficulty((current) => ({
                                  ...current,
                                  [game.id]: level,
                                }))
                              }
                              aria-pressed={isActive}
                              className={cn(
                                'h-11 rounded-xl border text-xs font-semibold capitalize transition-colors',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40',
                                isActive
                                  ? 'border-brand-accent2/50 bg-brand-accent2/12 text-brand-accent2'
                                  : 'border-brand-background/10 bg-brand-background/[0.04] text-brand-background/55 hover:bg-brand-background/[0.08]',
                              )}
                            >
                              {level}
                            </button>
                          )
                        })}
                      </div>
                    </fieldset>
                  )}

                  <div className={cn('mt-5 grid gap-3', game.isMultiplayer ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
                    <LinkButton
                      href={getGameHref(game.id, {
                        difficulty: practiceDifficulty[game.id] ?? 'medium',
                        mode: game.isMultiplayer ? 'ai' : undefined,
                      })}
                      fullWidth
                      className="!rounded-xl"
                    >
                      {game.aiLabel}
                    </LinkButton>
                    <Button
                      variant="secondary"
                      fullWidth
                      onClick={() => setTutorialGameId(game.id)}
                      className="!rounded-xl"
                    >
                      Tutorial
                    </Button>
                    {game.isMultiplayer && (
                      <Button
                        variant="secondary"
                        fullWidth
                        onClick={() => openCreateModal(game.id)}
                        className="!rounded-xl whitespace-nowrap"
                      >
                        Open room
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </section>
          </>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_20rem] lg:items-start">
            <section className="space-y-4">
              {rooms.length > 0 ? (
                rooms.map((room) => {
                  const game = getGameDefinition(room.game_type as string | undefined)
                  return (
                    <Card key={room.id}>
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex items-start gap-4">
                          <div
                            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-background/10 text-3xl"
                            aria-hidden="true"
                          >
                            {game?.icon ?? '🎮'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-lg font-semibold text-brand-background">
                                {game?.name ?? 'Game room'}
                              </h2>
                              <Badge className="capitalize">
                                {(room.status as string | undefined) ?? 'waiting'}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm text-brand-background/60">
                              Hosted by {getHostName(room)} · Opened {formatRelativeTime(room.created_at)}
                            </p>
                            <p className="mt-3 text-sm leading-relaxed text-brand-background/65">
                              {(room.current_players as number | undefined) ?? 0} of{' '}
                              {(room.max_players as number | undefined) ?? 0} seats filled.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-start gap-3 md:items-end">
                          <div className="rounded-xl bg-brand-background/[0.06] px-4 py-2.5 text-sm text-brand-background/70">
                            Room {room.room_code ? `#${room.room_code as string}` : 'is public'}
                          </div>
                          <LinkButton
                            href={`/games/rooms/${room.id}`}
                            size="sm"
                            className="!rounded-xl"
                          >
                            Open room
                          </LinkButton>
                        </div>
                      </div>
                    </Card>
                  )
                })
              ) : (
                <EmptyState
                  icon={<i className="ri-group-line text-4xl" aria-hidden="true" />}
                  image="/images/app/empty-games.webp"
                  imageAlt="A cozy table set up for a board game"
                  title="No live rooms just yet"
                  description="The room list is quiet right now. Open a room from the Practice tab and it will show up here for others to join."
                  action={
                    <Button variant="secondary" onClick={() => setActiveTab('practice')}>
                      Browse games
                    </Button>
                  }
                />
              )}
            </section>

            <aside className="space-y-4">
              <Card>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-bold text-brand-background">Room tools</h2>
                  <button
                    onClick={() => void loadRooms({ quiet: true })}
                    className="rounded-full px-2 py-1 text-sm font-medium text-brand-accent2 transition-colors hover:text-brand-accent2/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-background/40"
                  >
                    {refreshingRooms ? 'Refreshing…' : 'Refresh'}
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.06] p-4">
                    <p className="text-xs text-brand-background/50">Open seats</p>
                    <p className="mt-1 text-xl font-semibold text-brand-background">
                      {formatCompactNumber(openSeats)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.06] p-4">
                    <p className="text-xs text-brand-background/50">Recommended move</p>
                    <p className="mt-1 text-sm font-semibold text-brand-background">
                      {rooms.length > 0
                        ? 'Jump into a room with open seats'
                        : 'Create the first room for your game'}
                    </p>
                  </div>
                </div>
              </Card>
            </aside>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(tutorialGame)}
        onClose={() => setTutorialGameId(null)}
        title={tutorialGame ? `${tutorialGame.name} tutorial` : 'Game tutorial'}
      >
        {tutorialGame && (
          <div className="space-y-4">
            <div className="flex items-start gap-4 rounded-2xl bg-brand-background/[0.06] p-4">
              <GameMark logo={tutorialGame.logo} fallback={tutorialGame.icon} />
              <div>
                <p className="text-sm font-semibold text-brand-background">{tutorialGame.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-brand-background/65">
                  {tutorialGame.description}
                </p>
              </div>
            </div>
            <ol className="space-y-3">
              {tutorialGame.tutorialSteps.map((step, index) => (
                <li key={step.title} className="rounded-2xl border border-brand-background/10 bg-brand-background/[0.04] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-background/40">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-1 text-sm font-bold text-brand-background">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-brand-background/65">{step.body}</p>
                </li>
              ))}
            </ol>
            <div className="grid gap-3 sm:grid-cols-2">
              <LinkButton
                href={getGameHref(tutorialGame.id, {
                  difficulty: practiceDifficulty[tutorialGame.id] ?? 'medium',
                  mode: tutorialGame.isMultiplayer ? 'ai' : undefined,
                })}
                fullWidth
                className="!rounded-xl"
              >
                {tutorialGame.aiLabel}
              </LinkButton>
              <Button variant="secondary" fullWidth onClick={() => setTutorialGameId(null)} className="!rounded-xl">
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={`New room · ${selectedGame.name}`}
      >
        <div className="space-y-5">
          <div className="rounded-2xl bg-brand-background/[0.06] p-4">
            <p className="text-sm leading-relaxed text-brand-background/65">
              This opens a real room and adds you as the host. People can join it from the
              live rooms list right away - leave whenever you need to.
            </p>
          </div>

          <Field label="Capacity" htmlFor="room-capacity">
            <select
              id="room-capacity"
              value={selectedCapacity}
              onChange={(event) => setSelectedCapacity(Number(event.target.value))}
              className="w-full rounded-xl border border-brand-background/15 bg-brand-background/[0.08] px-4 py-3 text-sm text-brand-background transition-colors focus:border-brand-background/40 focus:outline-none focus:ring-2 focus:ring-brand-background/10"
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
          </Field>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowCreateModal(false)}
              className="!rounded-xl"
            >
              Cancel
            </Button>
            <Button
              fullWidth
              onClick={handleCreateRoom}
              isLoading={creatingRoom}
              className="!rounded-xl"
            >
              {creatingRoom ? 'Creating…' : 'Create room'}
            </Button>
          </div>
        </div>
      </Modal>

      <BottomNav />
    </PageFrame>
  )
}
