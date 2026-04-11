import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit as firestoreLimit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import { formatRelativeTime, normalizeKeywords, toDate } from './platform'

type FirestoreRecord = Record<string, unknown>

type GroupInput = {
  name: string
  description: string
  category: string
  isPrivate?: boolean
  type?: 'virtual' | 'in-person' | 'hybrid'
  location?: string | null
  latitude?: number | null
  longitude?: number | null
  tags?: string[]
}

function withId<T extends FirestoreRecord>(id: string, data: T) {
  return { id, ...data } as T & { id: string }
}

function sortByNewest(first: FirestoreRecord, second: FirestoreRecord) {
  return (toDate(second.created_at) ?? new Date(0)).getTime() - (toDate(first.created_at) ?? new Date(0)).getTime()
}

function sortByDateAsc(first: FirestoreRecord, second: FirestoreRecord, field: string) {
  return (toDate(first[field] as string | number | Date) ?? new Date(8640000000000000)).getTime()
    - (toDate(second[field] as string | number | Date) ?? new Date(8640000000000000)).getTime()
}

function tallyPhrases(
  values: Array<string | Array<string | null | undefined> | null | undefined>,
  limitCount = 6,
) {
  const counts = new Map<string, { label: string; count: number }>()

  values.forEach((value) => {
    const items = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : typeof value === 'string'
        ? value.split(',').map((item) => item.trim())
        : []

    items
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        const key = item.toLowerCase()
        const current = counts.get(key)
        counts.set(key, {
          label: current?.label || item,
          count: (current?.count || 0) + 1,
        })
      })
  })

  return Array.from(counts.values())
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label))
    .slice(0, limitCount)
}

async function getProfileSummary(userId: string | null | undefined) {
  if (!userId) return null
  const snap = await getDoc(doc(db, 'profiles', userId))
  return snap.exists() ? withId(snap.id, snap.data()) : null
}

async function userAlreadyInCollection(
  collectionName: string,
  userField: string,
  userId: string,
  matchField: string,
  matchValue: string,
) {
  const snap = await getDocs(query(collection(db, collectionName), where(userField, '==', userId)))
  return snap.docs.find((document) => document.data()[matchField] === matchValue)
}

export class DatabaseService {
  static async getProfile(userId: string) {
    const snap = await getDoc(doc(db, 'profiles', userId))
    if (!snap.exists()) return null
    return withId(snap.id, snap.data())
  }

  static async listProfiles() {
    const snap = await getDocs(collection(db, 'profiles'))
    return snap.docs.map((document) => withId(document.id, document.data()))
  }

  static async updateProfile(userId: string, updates: FirestoreRecord) {
    const ref = doc(db, 'profiles', userId)
    await updateDoc(ref, { ...updates, updated_at: serverTimestamp() })
    const snap = await getDoc(ref)
    return snap.exists() ? withId(snap.id, snap.data()) : null
  }

  static async getAvailableAngels(excludeUserId?: string) {
    const snap = await getDocs(collection(db, 'angels'))
    const angels: Array<FirestoreRecord & { id: string; profile: FirestoreRecord | null }> = await Promise.all(
      snap.docs.map(async (document) => {
        const data = document.data()
        const profile = await getProfileSummary(data.user_id as string | undefined)
        return { ...withId(document.id, data), profile }
      }),
    )

    return angels
      .filter((angel) => Boolean(angel['is_available']) && angel['user_id'] !== excludeUserId)
      .filter((angel) => (((angel['current_souls'] as number | undefined) ?? 0) < ((angel['max_souls'] as number | undefined) ?? 0)))
      .sort((first, second) => (((second['rating'] as number | undefined) ?? 0) - ((first['rating'] as number | undefined) ?? 0)))
  }

  static async getUserAngels(soulId: string) {
    const snap = await getDocs(
      query(
        collection(db, 'angel_soul_relationships'),
        where('soul_id', '==', soulId),
        where('relationship_status', '==', 'active'),
      ),
    )

    const relationships = await Promise.all(
      snap.docs.map(async (document) => {
        const data = document.data()
        const angelSnap = await getDoc(doc(db, 'angels', data.angel_id as string))
        if (!angelSnap.exists()) return withId(document.id, data)

        const angel = angelSnap.data()
        const profile = await getProfileSummary(angel.user_id as string | undefined)

        return {
          ...withId(document.id, data),
          angel: {
            ...withId(angelSnap.id, angel),
            profile,
          },
        }
      }),
    )

    return relationships
  }

  static async chooseAngel(soulId: string, angelId: string) {
    const existing = await userAlreadyInCollection(
      'angel_soul_relationships',
      'soul_id',
      soulId,
      'angel_id',
      angelId,
    )

    if (existing) return existing.id

    const relationship = await addDoc(collection(db, 'angel_soul_relationships'), {
      soul_id: soulId,
      angel_id: angelId,
      relationship_status: 'active',
      started_at: serverTimestamp(),
      last_checkin: null,
      next_checkin: null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })

    await updateDoc(doc(db, 'angels', angelId), {
      current_souls: increment(1),
      updated_at: serverTimestamp(),
    })

    return relationship.id
  }

  static async getMentors() {
    const snap = await getDocs(collection(db, 'mentors'))
    const mentors: Array<FirestoreRecord & { id: string; profile: FirestoreRecord | null }> = await Promise.all(
      snap.docs.map(async (document) => {
        const data = document.data()
        const profile = await getProfileSummary(data.user_id as string | undefined)
        return { ...withId(document.id, data), profile }
      }),
    )

    return mentors.sort((first, second) => ((second.rating as number | undefined) ?? 0) - ((first.rating as number | undefined) ?? 0))
  }

  static async getCommunityActivities(limitCount = 12) {
    const snap = await getDocs(collection(db, 'community_activities'))
    const activities: Array<FirestoreRecord & { id: string; organizer: FirestoreRecord | null; formatted_date: string }> = await Promise.all(
      snap.docs.map(async (document) => {
        const data = document.data()
        const organizer = await getProfileSummary(data.organizer_id as string | undefined)
        return {
          ...withId(document.id, data),
          organizer,
          formatted_date: formatRelativeTime(data.scheduled_at as string | number | Date),
        }
      }),
    )

    return activities
      .filter((activity) => (activity.status as string | undefined) !== 'cancelled')
      .sort((first, second) => sortByDateAsc(first, second, 'scheduled_at'))
      .slice(0, limitCount)
  }

  static async joinActivity(activityId: string, userId: string) {
    const existing = await userAlreadyInCollection('activity_members', 'user_id', userId, 'activity_id', activityId)
    if (existing) return existing.id

    const participant = await addDoc(collection(db, 'activity_members'), {
      activity_id: activityId,
      user_id: userId,
      created_at: serverTimestamp(),
    })

    await updateDoc(doc(db, 'community_activities', activityId), {
      participants_count: increment(1),
      updated_at: serverTimestamp(),
    })

    return participant.id
  }

  static async getCommunityPosts(limitCount = 20, options?: { userId?: string }) {
    const snap = options?.userId
      ? await getDocs(query(collection(db, 'community_posts'), where('user_id', '==', options.userId)))
      : await getDocs(query(collection(db, 'community_posts'), orderBy('created_at', 'desc'), firestoreLimit(limitCount)))

    const posts = await Promise.all(
      snap.docs.map(async (document) => {
        const data = document.data()
        const profile = await getProfileSummary(data.user_id as string | undefined)
        return { ...withId(document.id, data), profile }
      }),
    )

    return posts.sort(sortByNewest).slice(0, limitCount)
  }

  static async createPost(
    userId: string,
    content: string,
    type: string,
    tags?: string[],
    isAnonymous = false,
  ) {
    const reference = await addDoc(collection(db, 'community_posts'), {
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

    await updateDoc(doc(db, 'profiles', userId), {
      postsCount: increment(1),
      updated_at: serverTimestamp(),
    })

    return { id: reference.id }
  }

  static async getUserLikedPostIds(userId: string) {
    const snap = await getDocs(query(collection(db, 'post_likes'), where('user_id', '==', userId)))
    return new Set(snap.docs.map((document) => document.data().post_id as string))
  }

  static async togglePostLike(postId: string, userId: string) {
    const likeId = `${postId}_${userId}`
    const likeRef = doc(db, 'post_likes', likeId)
    const likeSnap = await getDoc(likeRef)

    if (likeSnap.exists()) {
      await deleteDoc(likeRef)
      await updateDoc(doc(db, 'community_posts', postId), {
        likes_count: increment(-1),
        updated_at: serverTimestamp(),
      })
      return false
    }

    await setDoc(likeRef, {
      post_id: postId,
      user_id: userId,
      created_at: serverTimestamp(),
    })
    await updateDoc(doc(db, 'community_posts', postId), {
      likes_count: increment(1),
      updated_at: serverTimestamp(),
    })
    return true
  }

  static async sendMessage(
    senderId: string,
    receiverId: string | null,
    roomId: string | null,
    message: string,
    isAI = false,
  ) {
    const reference = await addDoc(collection(db, 'chat_messages'), {
      sender_id: senderId,
      receiver_id: receiverId,
      room_id: roomId,
      message,
      message_type: 'text',
      is_ai: isAI,
      read_at: null,
      created_at: serverTimestamp(),
    })

    return { id: reference.id }
  }

  static async getMessages(roomId: string, limitCount = 50) {
    const snap = await getDocs(query(collection(db, 'chat_messages'), where('room_id', '==', roomId)))
    return snap.docs
      .map((document) => withId(document.id, document.data()))
      .sort((first, second) => (toDate(first.created_at) ?? new Date(0)).getTime() - (toDate(second.created_at) ?? new Date(0)).getTime())
      .slice(-limitCount)
  }

  static async getGroups(category?: string) {
    const snap = category
      ? await getDocs(query(collection(db, 'groups'), where('category', '==', category)))
      : await getDocs(collection(db, 'groups'))

    return snap.docs
      .map((document) => withId(document.id, document.data()))
      .sort((first, second) => ((second.members_count as number | undefined) ?? 0) - ((first.members_count as number | undefined) ?? 0))
  }

  static async getUserGroupMemberships(userId: string) {
    const membershipSnap = await getDocs(query(collection(db, 'group_members'), where('user_id', '==', userId)))

    const memberships = await Promise.all(
      membershipSnap.docs.map(async (document) => {
        const data = document.data()
        const groupSnap = await getDoc(doc(db, 'groups', data.group_id as string))
        return {
          ...withId(document.id, data),
          group: groupSnap.exists() ? withId(groupSnap.id, groupSnap.data()) : null,
        }
      }),
    )

    return memberships.filter((membership) => membership.group)
  }

  static async getRecommendedGroups(userId: string, limitCount = 6) {
    const [profile, groups, memberships] = await Promise.all([
      this.getProfile(userId),
      this.getGroups(),
      this.getUserGroupMemberships(userId),
    ])

    const joinedGroupIds = new Set(memberships.map((membership) => membership.group?.id as string))
    const keywords = normalizeKeywords(
      profile?.bio as string | undefined,
      profile?.location as string | undefined,
      profile?.interests as string[] | undefined,
    )

    return groups
      .filter((group) => !joinedGroupIds.has(group.id as string))
      .map((group) => {
        const haystack = normalizeKeywords(
          group.name as string | undefined,
          group.description as string | undefined,
          group.category as string | undefined,
          group.tags as string[] | undefined,
          group.location as string | undefined,
        )

        const sharedKeywords = keywords.filter((keyword) => haystack.includes(keyword)).length
        const sizeBoost = Math.min(20, ((group.members_count as number | undefined) ?? 0) / 10)
        const score = sharedKeywords * 12 + sizeBoost

        return {
          ...group,
          recommendation_score: score,
        }
      })
      .sort(
        (first, second) =>
          ((second.recommendation_score as number | undefined) ?? 0) - ((first.recommendation_score as number | undefined) ?? 0),
      )
      .slice(0, limitCount)
  }

  static async createGroup(userId: string, data: GroupInput) {
    const reference = await addDoc(collection(db, 'groups'), {
      name: data.name,
      description: data.description,
      category: data.category,
      type: data.type || 'virtual',
      location: data.location || null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      tags: data.tags || [],
      is_private: data.isPrivate || false,
      created_by: userId,
      members_count: 1,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })

    await addDoc(collection(db, 'group_members'), {
      group_id: reference.id,
      user_id: userId,
      role: 'admin',
      joined_at: serverTimestamp(),
    })

    return { id: reference.id }
  }

  static async joinGroup(groupId: string, userId: string) {
    const existing = await userAlreadyInCollection('group_members', 'user_id', userId, 'group_id', groupId)
    if (existing) return existing.id

    const member = await addDoc(collection(db, 'group_members'), {
      group_id: groupId,
      user_id: userId,
      role: 'member',
      joined_at: serverTimestamp(),
    })

    await updateDoc(doc(db, 'groups', groupId), {
      members_count: increment(1),
      updated_at: serverTimestamp(),
    })

    return member.id
  }

  static async getSupportLocations(type?: string) {
    const snap = await getDocs(collection(db, 'support_locations'))
    const locations = snap.docs.map((document) => withId(document.id, document.data()))

    return locations
      .filter((location) => !type || location.type === type)
      .sort((first, second) => (((second.rating as number | undefined) ?? 0) - ((first.rating as number | undefined) ?? 0)))
  }

  static async getResources(filters?: { category?: string; type?: string; featured?: boolean }) {
    const snap = await getDocs(collection(db, 'resources'))
    const resources = snap.docs.map((document) => withId(document.id, document.data()))

    return resources
      .filter((resource) => !filters?.category || resource.category === filters.category)
      .filter((resource) => !filters?.type || resource.type === filters.type)
      .filter((resource) => !filters?.featured || resource.featured === true)
      .sort((first, second) => sortByNewest(first, second))
  }

  static async getCommunitySignals(limitCount = 6) {
    const [profiles, groups, resources] = await Promise.all([
      this.listProfiles(),
      this.getGroups(),
      this.getResources(),
    ])

    return {
      topConditions: tallyPhrases(
        profiles.map((profile) => profile.conditions as string[] | undefined),
        limitCount,
      ),
      topMedications: tallyPhrases(
        profiles.map((profile) => profile.medications as string[] | undefined),
        limitCount,
      ),
      topTopics: tallyPhrases(
        [
          ...groups.map((group) => [group.category as string | undefined, ...(group.tags as string[] | undefined || [])]),
          ...resources.map((resource) => [resource.category as string | undefined, ...(resource.tags as string[] | undefined || [])]),
          ...profiles.map((profile) => profile.interests as string[] | undefined),
        ],
        limitCount,
      ),
    }
  }

  static async getConnectionCandidates(userId: string, limitCount = 12) {
    const [profiles, membershipSnap, sentRequests, receivedRequests, currentProfile] = await Promise.all([
      this.listProfiles(),
      getDocs(collection(db, 'group_members')),
      this.getSentConnectionRequests(userId),
      this.getReceivedConnectionRequests(userId),
      this.getProfile(userId),
    ])

    const membershipsByUser = new Map<string, Set<string>>()

    membershipSnap.docs.forEach((document) => {
      const data = document.data()
      const memberUserId = data.user_id as string | undefined
      const groupId = data.group_id as string | undefined
      if (!memberUserId || !groupId) return

      const existing = membershipsByUser.get(memberUserId) ?? new Set<string>()
      existing.add(groupId)
      membershipsByUser.set(memberUserId, existing)
    })

    const excluded = new Set<string>([
      userId,
      ...sentRequests.map((request) => request.target_user_id as string),
      ...receivedRequests.map((request) => request.requester_id as string),
    ])

    const currentUserGroups = membershipsByUser.get(userId) ?? new Set<string>()

    return profiles
      .filter((profile) => !excluded.has(profile.id as string))
      .filter((profile) => profile.onboarding_complete !== false)
      .map((profile) => {
        const candidateGroups = membershipsByUser.get(profile.id as string) ?? new Set<string>()
        const sharedGroups = Array.from(candidateGroups).filter((groupId) => currentUserGroups.has(groupId)).length
        const ageGap = Math.abs(((profile.age as number | undefined) ?? 0) - ((currentProfile?.age as number | undefined) ?? 0))
        const locationMatch =
          typeof currentProfile?.location === 'string' &&
          typeof profile.location === 'string' &&
          currentProfile.location.trim().length > 0 &&
          currentProfile.location.trim().toLowerCase() === profile.location.trim().toLowerCase()

        const communicationMatch =
          currentProfile?.preferred_communication &&
          profile.preferred_communication &&
          currentProfile.preferred_communication === profile.preferred_communication

        const score = Math.max(
          42,
          Math.min(
            96,
            40 +
              sharedGroups * 18 +
              (locationMatch ? 12 : 0) +
              (communicationMatch ? 10 : 0) +
              (ageGap <= 5 ? 8 : ageGap <= 10 ? 4 : 0) +
              (typeof profile.bio === 'string' && profile.bio.trim() ? 6 : 0),
          ),
        )

        const highlights = [
          sharedGroups > 0 ? `${sharedGroups} shared group${sharedGroups === 1 ? '' : 's'}` : null,
          locationMatch ? 'same location' : null,
          communicationMatch ? `prefers ${profile.preferred_communication as string}` : null,
          typeof profile.bio === 'string' && profile.bio.trim() ? 'open profile' : null,
        ].filter(Boolean)

        return {
          ...profile,
          match_score: score,
          shared_groups_count: sharedGroups,
          connection_highlights: highlights,
        }
      })
      .sort((first, second) => ((second.match_score as number) - (first.match_score as number)))
      .slice(0, limitCount)
  }

  static async sendConnectionRequest(requesterId: string, targetUserId: string) {
    const existing = await userAlreadyInCollection(
      'connection_requests',
      'requester_id',
      requesterId,
      'target_user_id',
      targetUserId,
    )

    if (existing) return existing.id

    const request = await addDoc(collection(db, 'connection_requests'), {
      requester_id: requesterId,
      target_user_id: targetUserId,
      status: 'pending',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })

    return request.id
  }

  static async getSentConnectionRequests(userId: string) {
    const snap = await getDocs(query(collection(db, 'connection_requests'), where('requester_id', '==', userId)))
    return snap.docs.map((document) => withId(document.id, document.data()))
  }

  static async getReceivedConnectionRequests(userId: string) {
    const snap = await getDocs(query(collection(db, 'connection_requests'), where('target_user_id', '==', userId)))
    return snap.docs.map((document) => withId(document.id, document.data()))
  }

  static async updateConnectionRequest(requestId: string, status: 'accepted' | 'declined') {
    await updateDoc(doc(db, 'connection_requests', requestId), {
      status,
      updated_at: serverTimestamp(),
    })
  }

  static async createGame(hostId: string, gameType: string, maxPlayers: number, isPrivate = false) {
    const roomCode = isPrivate ? Math.random().toString(36).substring(2, 8).toUpperCase() : null

    const reference = await addDoc(collection(db, 'games'), {
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
      game_id: reference.id,
      user_id: hostId,
      player_order: 1,
      joined_at: serverTimestamp(),
    })

    return { id: reference.id, game_type: gameType, room_code: roomCode }
  }

  static async joinGame(gameId: string, userId: string) {
    const existing = await userAlreadyInCollection('game_players', 'user_id', userId, 'game_id', gameId)
    if (existing) return existing.id

    const gameRef = doc(db, 'games', gameId)
    const gameSnap = await getDoc(gameRef)
    if (!gameSnap.exists()) throw new Error('Game not found')

    const game = gameSnap.data()
    if ((game.current_players as number) >= (game.max_players as number)) {
      throw new Error('Game is full')
    }

    const player = await addDoc(collection(db, 'game_players'), {
      game_id: gameId,
      user_id: userId,
      player_order: (game.current_players as number) + 1,
      joined_at: serverTimestamp(),
    })

    await updateDoc(gameRef, {
      current_players: increment(1),
      status: (game.current_players as number) + 1 >= (game.max_players as number) ? 'active' : 'waiting',
      updated_at: serverTimestamp(),
    })

    return player.id
  }

  static async getActiveGames(gameType?: string) {
    const snap = await getDocs(collection(db, 'games'))
    const games: Array<FirestoreRecord & { id: string; host: FirestoreRecord | null }> = await Promise.all(
      snap.docs.map(async (document) => {
        const data = document.data()
        const host = await getProfileSummary(data.host_id as string | undefined)
        return { ...withId(document.id, data), host }
      }),
    )

    return games
      .filter((game) => game.status === 'waiting' && game.is_private === false)
      .filter((game) => !gameType || game.game_type === gameType)
      .sort(sortByNewest)
  }

  static async getGame(gameId: string) {
    const snap = await getDoc(doc(db, 'games', gameId))
    if (!snap.exists()) return null

    const data = snap.data()
    const host = await getProfileSummary(data.host_id as string | undefined)

    return {
      ...withId(snap.id, data),
      host,
    }
  }

  static async getGamePlayers(gameId: string) {
    const snap = await getDocs(query(collection(db, 'game_players'), where('game_id', '==', gameId)))
    const players: Array<FirestoreRecord & { id: string; profile: FirestoreRecord | null }> = await Promise.all(
      snap.docs.map(async (document) => {
        const data = document.data()
        const profile = await getProfileSummary(data.user_id as string | undefined)
        return { ...withId(document.id, data), profile }
      }),
    )

    return players.sort((first, second) => ((first.player_order as number | undefined) ?? 0) - ((second.player_order as number | undefined) ?? 0))
  }

  static async updateGameState(gameId: string, gameState: unknown) {
    await updateDoc(doc(db, 'games', gameId), {
      game_state: gameState,
      updated_at: serverTimestamp(),
    })
  }

  private static getInitialGameState(gameType: string) {
    switch (gameType) {
      case 'chess':
        return {
          board: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
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
                .map((__, column) => {
                  if ((row + column) % 2 === 1) {
                    if (row < 3) return 'red'
                    if (row > 4) return 'black'
                  }
                  return null
                }),
            ),
          turn: 'red',
        }
      case 'tictactoe':
        return { board: Array(9).fill(null), turn: 'X', winner: null }
      case 'wordle':
        return { word: 'REACT', guesses: [], currentGuess: '', gameOver: false }
      default:
        return {}
    }
  }
}
