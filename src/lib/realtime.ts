'use client'

import {
  doc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  type Unsubscribe,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'

export class RealtimeService {
  private static subscriptions: Map<string, Unsubscribe> = new Map()

  static subscribeToGame(
    gameId: string,
    onGameUpdate: (data: DocumentData) => void
  ) {
    const key = `game:${gameId}`
    this.unsubscribe(key)

    const unsub = onSnapshot(doc(db, 'games', gameId), (snap) => {
      if (snap.exists()) onGameUpdate({ id: snap.id, ...snap.data() })
    })

    this.subscriptions.set(key, unsub)
    return unsub
  }

  static subscribeToChat(
    roomId: string,
    onNewMessage: (messages: DocumentData[]) => void
  ) {
    const key = `chat:${roomId}`
    this.unsubscribe(key)

    const q = query(
      collection(db, 'chat_messages'),
      where('room_id', '==', roomId),
      orderBy('created_at', 'asc')
    )

    const unsub = onSnapshot(q, (snap) => {
      const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      onNewMessage(messages)
    })

    this.subscriptions.set(key, unsub)
    return unsub
  }

  static subscribeToGameLobby(
    onGameUpdate: (games: DocumentData[]) => void
  ) {
    const key = 'game-lobby'
    this.unsubscribe(key)

    const q = query(
      collection(db, 'games'),
      where('status', '==', 'waiting'),
      where('is_private', '==', false)
    )

    const unsub = onSnapshot(q, (snap) => {
      const games = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      onGameUpdate(games)
    })

    this.subscriptions.set(key, unsub)
    return unsub
  }

  static subscribeToGamePlayers(
    gameId: string,
    onPlayersUpdate: (players: DocumentData[]) => void,
  ) {
    const key = `game-players:${gameId}`
    this.unsubscribe(key)

    const q = query(collection(db, 'game_players'), where('game_id', '==', gameId))

    const unsub = onSnapshot(q, (snap) => {
      const players = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      onPlayersUpdate(players)
    })

    this.subscriptions.set(key, unsub)
    return unsub
  }

  static subscribeToPosts(
    onUpdate: (posts: DocumentData[]) => void
  ) {
    const key = 'community-posts'
    this.unsubscribe(key)

    const q = query(
      collection(db, 'community_posts'),
      orderBy('created_at', 'desc')
    )

    const unsub = onSnapshot(q, (snap) => {
      const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      onUpdate(posts)
    })

    this.subscriptions.set(key, unsub)
    return unsub
  }

  static unsubscribe(key: string) {
    const unsub = this.subscriptions.get(key)
    if (unsub) {
      unsub()
      this.subscriptions.delete(key)
    }
  }

  static unsubscribeAll() {
    this.subscriptions.forEach((unsub) => unsub())
    this.subscriptions.clear()
  }
}
