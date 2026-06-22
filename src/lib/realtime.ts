'use client'

import { rpc } from './rpc-client'

type Listener = (data: unknown) => void
const POLL_MS = 3000

/**
 * Polling-based realtime (replaces Firestore onSnapshot). Each subscribe()
 * fetches immediately, then polls on an interval, and returns an unsubscribe.
 * Same API surface as the old RealtimeService so callers are unchanged.
 */
export class RealtimeService {
  private static timers = new Map<string, ReturnType<typeof setInterval>>()

  private static poll(key: string, fetcher: () => Promise<unknown>, cb: Listener) {
    this.unsubscribe(key)
    let cancelled = false
    const run = () =>
      fetcher()
        .then((data) => {
          if (!cancelled) cb(data)
        })
        .catch(() => undefined)
    run()
    const timer = setInterval(run, POLL_MS)
    this.timers.set(key, timer)
    return () => {
      cancelled = true
      this.unsubscribe(key)
    }
  }

  static subscribeToGame(gameId: string, onGameUpdate: (data: unknown) => void) {
    return this.poll(`game:${gameId}`, () => rpc('getGame', [gameId]), onGameUpdate)
  }

  static subscribeToChat(roomId: string, onNewMessage: (messages: unknown) => void) {
    return this.poll(`chat:${roomId}`, () => rpc('getMessages', [roomId]), onNewMessage)
  }

  static subscribeToGameLobby(onGameUpdate: (games: unknown) => void) {
    return this.poll('game-lobby', () => rpc('getActiveGames', []), onGameUpdate)
  }

  static subscribeToGamePlayers(gameId: string, onPlayersUpdate: (players: unknown) => void) {
    return this.poll(`game-players:${gameId}`, () => rpc('getGamePlayers', [gameId]), onPlayersUpdate)
  }

  static subscribeToPosts(onUpdate: (posts: unknown) => void) {
    return this.poll('community-posts', () => rpc('getCommunityPosts', [50]), onUpdate)
  }

  static unsubscribe(key: string) {
    const timer = this.timers.get(key)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(key)
    }
  }

  static unsubscribeAll() {
    this.timers.forEach((timer) => clearInterval(timer))
    this.timers.clear()
  }
}
