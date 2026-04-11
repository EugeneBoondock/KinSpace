import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  increment,
} from 'firebase/firestore'
import { db } from './firebase'

export class DatabaseService {
  // Profile operations
  static async getProfile(userId: string) {
    const snap = await getDoc(doc(db, 'profiles', userId))
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() }
  }

  static async updateProfile(userId: string, updates: Record<string, unknown>) {
    const ref = doc(db, 'profiles', userId)
    await updateDoc(ref, { ...updates, updated_at: serverTimestamp() })
    const snap = await getDoc(ref)
    return { id: snap.id, ...snap.data() }
  }

  // Angels operations
  static async getAvailableAngels(excludeUserId: string) {
    const q = query(
      collection(db, 'angels'),
      where('is_available', '==', true),
      where('user_id', '!=', excludeUserId)
    )
    const snap = await getDocs(q)
    const angels = []
    for (const d of snap.docs) {
      const data = d.data()
      if (data.current_souls < data.max_souls) {
        const profileSnap = await getDoc(doc(db, 'profiles', data.user_id))
        angels.push({ id: d.id, ...data, profile: profileSnap.exists() ? profileSnap.data() : null })
      }
    }
    return angels
  }

  static async getUserAngels(soulId: string) {
    const q = query(
      collection(db, 'angel_soul_relationships'),
      where('soul_id', '==', soulId),
      where('relationship_status', '==', 'active')
    )
    const snap = await getDocs(q)
    const relationships = []
    for (const d of snap.docs) {
      const data = d.data()
      const angelSnap = await getDoc(doc(db, 'angels', data.angel_id))
      let profile = null
      if (angelSnap.exists()) {
        const angelData = angelSnap.data()
        const profileSnap = await getDoc(doc(db, 'profiles', angelData.user_id))
        profile = profileSnap.exists() ? profileSnap.data() : null
      }
      relationships.push({
        id: d.id,
        ...data,
        angel: angelSnap.exists() ? { ...angelSnap.data(), profile } : null,
      })
    }
    return relationships
  }

  static async chooseAngel(soulId: string, angelId: string) {
    const ref = await addDoc(collection(db, 'angel_soul_relationships'), {
      soul_id: soulId,
      angel_id: angelId,
      relationship_status: 'active',
      started_at: serverTimestamp(),
      last_checkin: null,
      next_checkin: null,
      created_at: serverTimestamp(),
    })
    await updateDoc(doc(db, 'angels', angelId), {
      current_souls: increment(1),
    })
    return ref.id
  }

  // Games operations
  static async createGame(
    hostId: string,
    gameType: string,
    maxPlayers: number,
    isPrivate = false
  ) {
    const roomCode = isPrivate
      ? Math.random().toString(36).substring(2, 8).toUpperCase()
      : null

    const ref = await addDoc(collection(db, 'games'), {
      host_id: hostId,
      game_type: gameType,
      max_players: maxPlayers,
      current_players: 1,
      is_private: isPrivate,
      room_code: roomCode,
      status: 'waiting',
      game_state: this.getInitialGameState(gameType),
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })

    await addDoc(collection(db, 'game_players'), {
      game_id: ref.id,
      user_id: hostId,
      player_order: 1,
      joined_at: serverTimestamp(),
    })

    return { id: ref.id, game_type: gameType, room_code: roomCode }
  }

  static async joinGame(gameId: string, userId: string) {
    const gameRef = doc(db, 'games', gameId)
    const gameSnap = await getDoc(gameRef)
    if (!gameSnap.exists()) throw new Error('Game not found')

    const game = gameSnap.data()
    if (game.current_players >= game.max_players) throw new Error('Game is full')

    await addDoc(collection(db, 'game_players'), {
      game_id: gameId,
      user_id: userId,
      player_order: game.current_players + 1,
      joined_at: serverTimestamp(),
    })

    await updateDoc(gameRef, {
      current_players: increment(1),
      status: game.current_players + 1 >= game.max_players ? 'active' : 'waiting',
      updated_at: serverTimestamp(),
    })
  }

  static async getActiveGames(gameType?: string) {
    const constraints = [
      where('status', '==', 'waiting'),
      where('is_private', '==', false),
    ]
    if (gameType) constraints.push(where('game_type', '==', gameType))

    const q = query(collection(db, 'games'), ...constraints)
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  }

  static async updateGameState(gameId: string, gameState: unknown) {
    await updateDoc(doc(db, 'games', gameId), {
      game_state: gameState,
      updated_at: serverTimestamp(),
    })
  }

  // Community posts
  static async getCommunityPosts(limitCount = 20) {
    const q = query(
      collection(db, 'community_posts'),
      orderBy('created_at', 'desc'),
      firestoreLimit(limitCount)
    )
    const snap = await getDocs(q)
    const posts = []
    for (const d of snap.docs) {
      const data = d.data()
      const profileSnap = await getDoc(doc(db, 'profiles', data.user_id))
      posts.push({
        id: d.id,
        ...data,
        profile: profileSnap.exists() ? profileSnap.data() : null,
      })
    }
    return posts
  }

  static async createPost(
    userId: string,
    content: string,
    type: string,
    tags?: string[],
    isAnonymous = false
  ) {
    const ref = await addDoc(collection(db, 'community_posts'), {
      user_id: userId,
      content,
      type,
      tags: tags || [],
      likes_count: 0,
      comments_count: 0,
      is_anonymous: isAnonymous,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })
    return { id: ref.id }
  }

  static async likePost(postId: string) {
    await updateDoc(doc(db, 'community_posts', postId), {
      likes_count: increment(1),
    })
  }

  // Chat messages
  static async sendMessage(
    senderId: string,
    receiverId: string | null,
    roomId: string | null,
    message: string,
    isAI = false
  ) {
    const ref = await addDoc(collection(db, 'chat_messages'), {
      sender_id: senderId,
      receiver_id: receiverId,
      room_id: roomId,
      message,
      message_type: 'text',
      is_ai: isAI,
      read_at: null,
      created_at: serverTimestamp(),
    })
    return { id: ref.id }
  }

  static async getMessages(roomId: string, limitCount = 50) {
    const q = query(
      collection(db, 'chat_messages'),
      where('room_id', '==', roomId),
      orderBy('created_at', 'asc'),
      firestoreLimit(limitCount)
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  }

  // Groups
  static async getGroups(category?: string) {
    const constraints = category
      ? [where('category', '==', category)]
      : []
    const q = query(collection(db, 'groups'), ...constraints)
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  }

  static async joinGroup(groupId: string, userId: string) {
    await addDoc(collection(db, 'group_members'), {
      group_id: groupId,
      user_id: userId,
      joined_at: serverTimestamp(),
    })
    await updateDoc(doc(db, 'groups', groupId), {
      members_count: increment(1),
    })
  }

  // Helper function for initial game states
  private static getInitialGameState(gameType: string) {
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
                .map((_, col) => {
                  if ((row + col) % 2 === 1) {
                    if (row < 3) return 'red'
                    if (row > 4) return 'black'
                  }
                  return null
                })
            ),
          turn: 'red',
        }
      case 'tictactoe':
        return { board: Array(9).fill(null), turn: 'X' }
      case 'wordle':
        return { word: 'REACT', guesses: [], currentGuess: '', gameOver: false }
      default:
        return {}
    }
  }
}
