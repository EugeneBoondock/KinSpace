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

type ResourceInput = {
  title: string
  excerpt: string
  url?: string | null
  source?: string | null
  category: string
  type: string
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
    media?: Array<{ url: string; type: 'image' | 'video' | 'audio' }>,
  ) {
    const reference = await addDoc(collection(db, 'community_posts'), {
      user_id: userId,
      content,
      type,
      tags: tags || [],
      media: media || [],
      likes_count: 0,
      reaction_counts: {},
      comments_count: 0,
      rekindle_count: 0,
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

  static async updatePost(postId: string, userId: string, updates: { content?: string }) {
    const postRef = doc(db, 'community_posts', postId)
    const postSnap = await getDoc(postRef)
    if (!postSnap.exists()) throw new Error('Post not found')
    if (postSnap.data().user_id !== userId) throw new Error('Not authorized')

    await updateDoc(postRef, {
      ...updates,
      edited: true,
      updated_at: serverTimestamp(),
    })
  }

  static async rekindlePost(postId: string, userId: string, comment?: string) {
    const originalRef = doc(db, 'community_posts', postId)
    const originalSnap = await getDoc(originalRef)
    if (!originalSnap.exists()) throw new Error('Original post not found')

    const original = originalSnap.data()
    const originalProfile = await getProfileSummary(original.user_id as string | undefined)

    const reference = await addDoc(collection(db, 'community_posts'), {
      user_id: userId,
      content: comment || '',
      type: 'rekindle',
      tags: [],
      media: [],
      likes_count: 0,
      reaction_counts: {},
      comments_count: 0,
      rekindle_count: 0,
      is_anonymous: false,
      rekindle_of: postId,
      rekindle_original: {
        id: postId,
        content: original.content,
        user_id: original.user_id,
        media: original.media || [],
        is_anonymous: original.is_anonymous,
        author_name: original.is_anonymous
          ? 'Anonymous'
          : (originalProfile?.full_name as string | undefined)
            || (originalProfile?.username as string | undefined)
            || 'Community member',
        created_at: original.created_at,
      },
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })

    await updateDoc(originalRef, {
      rekindle_count: increment(1),
      updated_at: serverTimestamp(),
    })

    await updateDoc(doc(db, 'profiles', userId), {
      postsCount: increment(1),
      updated_at: serverTimestamp(),
    })

    return { id: reference.id }
  }

  static async isUsernameTaken(username: string, excludeUserId?: string): Promise<boolean> {
    const normalized = username.trim().toLowerCase()
    if (!normalized) return false
    const snap = await getDocs(collection(db, 'profiles'))
    return snap.docs.some((document) => {
      const data = document.data()
      if (excludeUserId && document.id === excludeUserId) return false
      return typeof data.username === 'string' && data.username.trim().toLowerCase() === normalized
    })
  }

  static async getUserLikedPostIds(userId: string) {
    const snap = await getDocs(query(collection(db, 'post_likes'), where('user_id', '==', userId)))
    return new Set(snap.docs.map((document) => document.data().post_id as string))
  }

  static async getUserPostReactions(userId: string) {
    const snap = await getDocs(query(collection(db, 'post_reactions'), where('user_id', '==', userId)))
    return new Set(
      snap.docs.map((document) => {
        const data = document.data()
        return `${data.post_id as string}:${data.reaction as string}`
      }),
    )
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

  static async togglePostReaction(postId: string, userId: string, reaction: string) {
    const reactionId = `${postId}_${userId}_${reaction}`
    const reactionRef = doc(db, 'post_reactions', reactionId)
    const reactionSnap = await getDoc(reactionRef)

    if (reactionSnap.exists()) {
      await deleteDoc(reactionRef)
      await updateDoc(doc(db, 'community_posts', postId), {
        [`reaction_counts.${reaction}`]: increment(-1),
        updated_at: serverTimestamp(),
      })
      return false
    }

    await setDoc(reactionRef, {
      post_id: postId,
      user_id: userId,
      reaction,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })

    await updateDoc(doc(db, 'community_posts', postId), {
      [`reaction_counts.${reaction}`]: increment(1),
      updated_at: serverTimestamp(),
    })

    return true
  }

  static async addPostComment(postId: string, userId: string, content: string, isAnonymous = false) {
    const reference = await addDoc(collection(db, 'post_comments'), {
      post_id: postId,
      user_id: userId,
      content,
      is_anonymous: isAnonymous,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })

    await updateDoc(doc(db, 'community_posts', postId), {
      comments_count: increment(1),
      updated_at: serverTimestamp(),
    })

    return { id: reference.id }
  }

  static async getCommentsForPosts(postIds: string[], limitCount = 3) {
    const uniquePostIds = Array.from(new Set(postIds.filter(Boolean)))
    if (uniquePostIds.length === 0) return new Map<string, Array<FirestoreRecord & { id: string; profile: FirestoreRecord | null }>>()

    const batches: string[][] = []
    for (let index = 0; index < uniquePostIds.length; index += 10) {
      batches.push(uniquePostIds.slice(index, index + 10))
    }

    const snapshots = await Promise.all(
      batches.map((batch) =>
        getDocs(query(collection(db, 'post_comments'), where('post_id', 'in', batch))),
      ),
    )

    const comments = await Promise.all(
      snapshots
        .flatMap((snapshot) => snapshot.docs)
        .map(async (document) => {
          const data = document.data()
          const profile = await getProfileSummary(data.user_id as string | undefined)
          return { ...withId(document.id, data), profile }
        }),
    )

    const grouped = new Map<string, Array<FirestoreRecord & { id: string; profile: FirestoreRecord | null }>>()

    comments
      .sort((first, second) => sortByDateAsc(first, second, 'created_at'))
      .forEach((comment) => {
        const postId = (comment as FirestoreRecord).post_id as string | undefined
        if (!postId) return

        const existing = grouped.get(postId) ?? []
        existing.push(comment)
        grouped.set(postId, existing.slice(-limitCount))
      })

    return grouped
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

  static async leaveGroup(groupId: string, userId: string) {
    const snap = await getDocs(
      query(
        collection(db, 'group_members'),
        where('group_id', '==', groupId),
        where('user_id', '==', userId),
      ),
    )
    if (snap.empty) return false
    await Promise.all(snap.docs.map((document) => deleteDoc(doc(db, 'group_members', document.id))))
    await updateDoc(doc(db, 'groups', groupId), {
      members_count: increment(-snap.size),
      updated_at: serverTimestamp(),
    }).catch(() => undefined)
    return true
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

  static async createResource(userId: string, data: ResourceInput) {
    const reference = await addDoc(collection(db, 'resources'), {
      title: data.title,
      excerpt: data.excerpt,
      url: data.url || null,
      source: data.source || 'Community submitted',
      category: data.category,
      type: data.type,
      tags: data.tags || [],
      featured: false,
      submitted_by: userId,
      status: 'published',
      created_at: serverTimestamp(),
      published_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })

    return { id: reference.id }
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

  // ---------- Connect Strands (hydrated connection requests) ----------

  static async getStrandWithUser(currentUserId: string, otherUserId: string) {
    const [sent, received] = await Promise.all([
      getDocs(
        query(
          collection(db, 'connection_requests'),
          where('requester_id', '==', currentUserId),
          where('target_user_id', '==', otherUserId),
        ),
      ),
      getDocs(
        query(
          collection(db, 'connection_requests'),
          where('requester_id', '==', otherUserId),
          where('target_user_id', '==', currentUserId),
        ),
      ),
    ])
    const all = [...sent.docs, ...received.docs].map((document) => withId(document.id, document.data()))
    if (all.length === 0) return null
    // Prefer the most recent
    all.sort(sortByNewest)
    const top = all[0]
    return {
      ...top,
      direction: (top.requester_id as string) === currentUserId ? ('sent' as const) : ('received' as const),
    }
  }

  static async cancelConnectionRequest(requestId: string) {
    await deleteDoc(doc(db, 'connection_requests', requestId))
  }

  static async getStrandSummary(userId: string) {
    const [sent, received] = await Promise.all([
      DatabaseService.getSentConnectionRequests(userId),
      DatabaseService.getReceivedConnectionRequests(userId),
    ])

    type HydratedStrand = FirestoreRecord & {
      id: string
      direction: 'sent' | 'received'
      profile: FirestoreRecord | null
    }

    const hydrate = async (
      requests: Array<FirestoreRecord & { id: string }>,
      direction: 'sent' | 'received',
    ): Promise<HydratedStrand[]> =>
      Promise.all(
        requests.map(async (request): Promise<HydratedStrand> => {
          const otherId =
            direction === 'sent'
              ? (request.target_user_id as string | undefined)
              : (request.requester_id as string | undefined)
          const profile = await getProfileSummary(otherId ?? null)
          return { ...request, direction, profile }
        }),
      )

    const [sentHydrated, receivedHydrated] = await Promise.all([
      hydrate(sent, 'sent'),
      hydrate(received, 'received'),
    ])

    return {
      pendingReceived: receivedHydrated.filter((request) => request.status === 'pending').sort(sortByNewest),
      pendingSent: sentHydrated.filter((request) => request.status === 'pending').sort(sortByNewest),
      accepted: [...sentHydrated, ...receivedHydrated]
        .filter((request) => request.status === 'accepted')
        .sort(sortByNewest),
      declined: [...sentHydrated, ...receivedHydrated]
        .filter((request) => request.status === 'declined')
        .sort(sortByNewest),
    }
  }

  static async getStrandCounts(userId: string) {
    const summary = await DatabaseService.getStrandSummary(userId)
    return {
      pendingReceived: summary.pendingReceived.length,
      pendingSent: summary.pendingSent.length,
      accepted: summary.accepted.length,
    }
  }

  // ---------- Ask (community + AI symptom questions) ----------

  static async createAskQuestion(
    userId: string,
    data: {
      question: string
      body?: string
      scope?: 'public' | 'group'
      group_id?: string | null
      is_anonymous?: boolean
      related_conditions?: string[]
    },
  ) {
    const ref = await addDoc(collection(db, 'ask_questions'), {
      user_id: userId,
      question: data.question,
      body: data.body ?? '',
      scope: data.scope ?? 'public',
      group_id: data.group_id ?? null,
      is_anonymous: Boolean(data.is_anonymous),
      related_conditions: data.related_conditions ?? [],
      tags: [],
      ai_answer: null,
      ai_plain_summary: null,
      ai_red_flags: [],
      ai_self_care: [],
      ai_see_professional: [],
      ai_sources: [],
      ai_reddit_threads: [],
      answers_count: 0,
      upvotes: 0,
      status: 'pending-answer',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })
    return { id: ref.id }
  }

  static async attachAskAiAnswer(
    questionId: string,
    payload: {
      answer_markdown: string
      plain_language_summary?: string
      red_flags?: string[]
      self_care?: string[]
      see_professional?: string[]
      tags?: string[]
      sources?: Array<{ index: number; title: string; url: string; domain: string }>
      reddit_threads?: Array<{ title: string; url: string; subreddit: string; snippet: string }>
    },
  ) {
    await updateDoc(doc(db, 'ask_questions', questionId), {
      ai_answer: payload.answer_markdown,
      ai_plain_summary: payload.plain_language_summary ?? null,
      ai_red_flags: payload.red_flags ?? [],
      ai_self_care: payload.self_care ?? [],
      ai_see_professional: payload.see_professional ?? [],
      tags: payload.tags ?? [],
      ai_sources: payload.sources ?? [],
      ai_reddit_threads: payload.reddit_threads ?? [],
      status: 'answered',
      updated_at: serverTimestamp(),
    })
  }

  static async getAskQuestions(options?: {
    limit?: number
    tag?: string
    search?: string
    groupId?: string | null
  }) {
    const snap = await getDocs(collection(db, 'ask_questions'))
    const items: Array<FirestoreRecord & { id: string; profile: FirestoreRecord | null }> = await Promise.all(
      snap.docs.map(async (document) => {
        const data = document.data()
        const profile = data.is_anonymous ? null : await getProfileSummary(data.user_id as string | undefined)
        return { ...withId(document.id, data), profile }
      }),
    )

    const tag = options?.tag
    const search = options?.search?.toLowerCase().trim()
    const groupId = options?.groupId

    return items
      .filter((item) => {
        if (groupId && item.group_id !== groupId) return false
        if (!groupId && item.scope === 'group') return false // don't show group-scoped in public feed
        if (tag) {
          const tags = (item.tags as string[] | undefined) ?? []
          if (!tags.includes(tag)) return false
        }
        if (search) {
          const haystack = `${item.question ?? ''} ${item.body ?? ''}`.toLowerCase()
          if (!haystack.includes(search)) return false
        }
        return true
      })
      .sort(sortByNewest)
      .slice(0, options?.limit ?? 30)
  }

  static async getAskQuestion(questionId: string) {
    const snap = await getDoc(doc(db, 'ask_questions', questionId))
    if (!snap.exists()) return null
    const data = snap.data()
    const profile = data.is_anonymous ? null : await getProfileSummary(data.user_id as string | undefined)
    return { ...withId(snap.id, data), profile }
  }

  /** Naive similarity: match on shared significant words in the question. */
  static async findRelatedAskQuestions(query: string, excludeIds: string[] = [], limit = 4) {
    const words = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 8)
    if (words.length === 0) return []

    const snap = await getDocs(collection(db, 'ask_questions'))
    const scored = snap.docs
      .map((document) => {
        const data = document.data()
        const text = `${data.question ?? ''} ${data.body ?? ''}`.toLowerCase()
        const score = words.reduce((total, word) => (text.includes(word) ? total + 1 : total), 0)
        return { id: document.id, data, score }
      })
      .filter((entry) => entry.score > 0 && !excludeIds.includes(entry.id))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return scored.map((entry) => ({
      id: entry.id,
      question: entry.data.question as string,
      created_at: entry.data.created_at,
    }))
  }

  static async addAskAnswer(
    questionId: string,
    userId: string,
    content: string,
    isAnonymous = false,
  ) {
    const ref = await addDoc(collection(db, 'ask_answers'), {
      question_id: questionId,
      user_id: userId,
      content,
      is_anonymous: isAnonymous,
      upvotes: 0,
      is_ai: false,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })

    await updateDoc(doc(db, 'ask_questions', questionId), {
      answers_count: increment(1),
      updated_at: serverTimestamp(),
    }).catch(() => undefined)

    return { id: ref.id }
  }

  static async getAskAnswers(questionId: string, limit = 40) {
    const snap = await getDocs(
      query(collection(db, 'ask_answers'), where('question_id', '==', questionId)),
    )
    const items = await Promise.all(
      snap.docs.map(async (document) => {
        const data = document.data()
        const profile = data.is_anonymous ? null : await getProfileSummary(data.user_id as string | undefined)
        return { ...withId(document.id, data), profile }
      }),
    )
    return items
      .sort((first, second) => {
        const firstVotes = ((first as unknown as Record<string, number>).upvotes ?? 0)
        const secondVotes = ((second as unknown as Record<string, number>).upvotes ?? 0)
        return secondVotes - firstVotes
      })
      .slice(0, limit)
  }

  static async upvoteAskAnswer(userId: string, answerId: string) {
    const voteId = `${answerId}_${userId}`
    const voteRef = doc(db, 'ask_answer_votes', voteId)
    const existing = await getDoc(voteRef)
    if (existing.exists()) {
      await deleteDoc(voteRef)
      await updateDoc(doc(db, 'ask_answers', answerId), { upvotes: increment(-1) }).catch(() => undefined)
      return { voted: false }
    }
    await setDoc(voteRef, {
      answer_id: answerId,
      user_id: userId,
      created_at: serverTimestamp(),
    })
    await updateDoc(doc(db, 'ask_answers', answerId), { upvotes: increment(1) }).catch(() => undefined)
    return { voted: true }
  }

  // ---------- Mood check-ins with pattern detection ----------

  /** Recommended to call alongside updateProfile({daily_mood}) from the dashboard. */
  static async recordMoodCheckin(
    userId: string,
    data: { mood: string; note?: string },
  ) {
    const today = new Date()
    const dayKey = `${userId}_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    await setDoc(
      doc(db, 'mood_checkins', dayKey),
      {
        user_id: userId,
        mood: data.mood,
        note: data.note ?? '',
        day: today.toISOString().slice(0, 10),
        created_at: serverTimestamp(),
      },
      { merge: true },
    )
    return { id: dayKey }
  }

  static async getMoodCheckins(userId: string, days = 14) {
    const snap = await getDocs(
      query(collection(db, 'mood_checkins'), where('user_id', '==', userId)),
    )
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    return snap.docs
      .map((document) => withId(document.id, document.data()))
      .filter((entry) => {
        const when = toDate(entry.created_at) ?? toDate(entry.day)
        if (!when) return false
        return when.getTime() >= cutoff
      })
      .sort((a, b) => (toDate(a.created_at) ?? new Date(0)).getTime() - (toDate(b.created_at) ?? new Date(0)).getTime())
  }

  /** Cheap pattern detector — returns a terse human note if the last 7 days trends in one direction. */
  static async analyzeMoodPattern(userId: string): Promise<{
    streak: number
    recent: string[]
    hint: string | null
  }> {
    const recent = await DatabaseService.getMoodCheckins(userId, 14)
    const moods = recent.map((entry) => (entry.mood as string) ?? '').filter(Boolean)
    if (moods.length === 0) return { streak: 0, recent: [], hint: null }

    const heavy = moods.filter((mood) => mood === 'heavy' || mood === 'tired' || mood === 'stretched').length
    const bright = moods.filter((mood) => mood === 'hopeful' || mood === 'grounded').length

    const tail = moods.slice(-5)
    let streak = 1
    for (let index = tail.length - 2; index >= 0; index -= 1) {
      if (tail[index] === tail[tail.length - 1]) streak += 1
      else break
    }

    let hint: string | null = null
    if (streak >= 4 && (tail[tail.length - 1] === 'heavy' || tail[tail.length - 1] === 'tired')) {
      hint = `You've logged "${tail[tail.length - 1]}" ${streak} days in a row. Worth checking in with a real human — your care team or an Angel here.`
    } else if (heavy >= Math.max(4, Math.floor(moods.length * 0.6))) {
      hint = `Mood has been mostly heavy the last couple of weeks. Consider slowing one thing down this week.`
    } else if (bright >= Math.floor(moods.length * 0.7)) {
      hint = `You've had a steady bright patch. If you want to protect it, the Guide can help you name what's working.`
    }

    return { streak, recent: moods, hint }
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

  static async leaveGame(gameId: string, userId: string) {
    const gameRef = doc(db, 'games', gameId)
    const gameSnap = await getDoc(gameRef)
    if (!gameSnap.exists()) return { left: false, archived: false }
    const game = gameSnap.data()

    const snap = await getDocs(
      query(
        collection(db, 'game_players'),
        where('game_id', '==', gameId),
        where('user_id', '==', userId),
      ),
    )
    if (snap.empty) return { left: false, archived: false }

    await Promise.all(snap.docs.map((document) => deleteDoc(doc(db, 'game_players', document.id))))

    const remaining = Math.max(0, ((game.current_players as number | undefined) ?? 1) - snap.size)

    // Host leaving closes the room for everyone
    const isHost = (game.host_id as string | undefined) === userId
    if (isHost || remaining === 0) {
      await updateDoc(gameRef, {
        status: 'archived',
        current_players: remaining,
        updated_at: serverTimestamp(),
      })
      return { left: true, archived: true }
    }

    await updateDoc(gameRef, {
      current_players: remaining,
      status: game.status === 'active' ? 'waiting' : game.status,
      updated_at: serverTimestamp(),
    })
    return { left: true, archived: false }
  }

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
        return { word: null, guesses: [], currentGuess: '', gameOver: false }
      default:
        return {}
    }
  }

  // ---------- Game high scores ----------

  static async recordGameScore(userId: string, gameId: string, score: number) {
    try {
      const ref = doc(db, 'profiles', userId)
      const snap = await getDoc(ref)
      if (!snap.exists()) return
      const current = (snap.data().games_high_scores as Record<string, number> | undefined) ?? {}
      if ((current[gameId] ?? 0) >= score) return
      await updateDoc(ref, {
        [`games_high_scores.${gameId}`]: score,
        updated_at: serverTimestamp(),
      })
    } catch (error) {
      console.error('Failed to record high score:', error)
    }
  }

  // ---------- StuffThatWorks-style insights: conditions/treatments/experiences ----------

  static async getConditions(filters?: { category?: string; search?: string }) {
    const snap = await getDocs(collection(db, 'conditions'))
    const items = snap.docs.map((document) => withId(document.id, document.data()))
    const normalized = items
      .filter((item) => !filters?.category || item.category === filters.category)
      .filter((item) => {
        if (!filters?.search) return true
        const haystack = `${item.name} ${Array.isArray(item.aliases) ? (item.aliases as string[]).join(' ') : ''} ${item.summary ?? ''}`.toLowerCase()
        return haystack.includes(filters.search.toLowerCase())
      })
      .sort((first, second) => ((second.member_count as number | undefined) ?? 0) - ((first.member_count as number | undefined) ?? 0))
    return normalized
  }

  static async getCondition(slug: string) {
    const direct = await getDoc(doc(db, 'conditions', slug))
    if (direct.exists()) return withId(direct.id, direct.data())

    // Alias/name fallback so /conditions/complex-ptsd resolves to the seeded /conditions/cptsd doc.
    const lowered = slug.toLowerCase()
    const snap = await getDocs(collection(db, 'conditions'))
    for (const document of snap.docs) {
      const data = document.data()
      const name = String(data.name ?? '').toLowerCase()
      if (name === lowered) return withId(document.id, data)
      const normalisedName = name.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (normalisedName === lowered) return withId(document.id, data)
      if (Array.isArray(data.aliases)) {
        for (const alias of data.aliases) {
          if (typeof alias !== 'string') continue
          const aliasLower = alias.toLowerCase()
          const aliasSlug = aliasLower.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          if (aliasLower === lowered || aliasSlug === lowered) return withId(document.id, data)
        }
      }
    }
    return null
  }

  static async getTreatments(filters?: { kind?: string }) {
    const snap = await getDocs(collection(db, 'treatments'))
    return snap.docs
      .map((document) => withId(document.id, document.data()))
      .filter((item) => !filters?.kind || item.kind === filters.kind)
      .sort((a, b) => ((a.name as string) ?? '').localeCompare((b.name as string) ?? ''))
  }

  static async getTreatment(slug: string) {
    const snap = await getDoc(doc(db, 'treatments', slug))
    if (!snap.exists()) return null
    return withId(snap.id, snap.data())
  }

  static async createTreatment(userId: string, data: { name: string; kind: string; summary?: string }) {
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const ref = doc(db, 'treatments', slug)
    const existing = await getDoc(ref)
    if (existing.exists()) return { id: slug, created: false }
    await setDoc(ref, {
      name: data.name,
      slug,
      kind: data.kind,
      summary: data.summary ?? '',
      warnings: [],
      submitted_by: userId,
      status: 'pending',
      created_at: serverTimestamp(),
    })
    return { id: slug, created: true }
  }

  static async getTopTreatments(conditionSlug: string, limitCount = 10) {
    const snap = await getDocs(
      query(collection(db, 'condition_treatments'), where('condition_slug', '==', conditionSlug)),
    )
    const rows = snap.docs.map((document) => withId(document.id, document.data()))
    const enriched = await Promise.all(
      rows
        .sort((a, b) => ((b.effectiveness_avg as number | undefined) ?? 0) - ((a.effectiveness_avg as number | undefined) ?? 0))
        .slice(0, limitCount)
        .map(async (row) => {
          const treatmentSnap = await getDoc(doc(db, 'treatments', row.treatment_slug as string))
          return {
            ...row,
            treatment: treatmentSnap.exists() ? withId(treatmentSnap.id, treatmentSnap.data()) : null,
          }
        }),
    )
    return enriched
  }

  static async getConditionsForTreatment(treatmentSlug: string, limitCount = 10) {
    const snap = await getDocs(
      query(collection(db, 'condition_treatments'), where('treatment_slug', '==', treatmentSlug)),
    )
    const rows = snap.docs.map((document) => withId(document.id, document.data()))
    const enriched = await Promise.all(
      rows
        .sort((a, b) => ((b.effectiveness_avg as number | undefined) ?? 0) - ((a.effectiveness_avg as number | undefined) ?? 0))
        .slice(0, limitCount)
        .map(async (row) => {
          const conditionSnap = await getDoc(doc(db, 'conditions', row.condition_slug as string))
          return {
            ...row,
            condition: conditionSnap.exists() ? withId(conditionSnap.id, conditionSnap.data()) : null,
          }
        }),
    )
    return enriched
  }

  static async createExperience(
    userId: string,
    data: {
      condition_slug: string
      treatment_slug: string
      effectiveness: number
      side_effects?: number
      duration_weeks?: number
      story?: string
      is_anonymous?: boolean
      tags?: string[]
    },
  ) {
    const experienceRef = await addDoc(collection(db, 'experiences'), {
      user_id: userId,
      condition_slug: data.condition_slug,
      treatment_slug: data.treatment_slug,
      effectiveness: data.effectiveness,
      side_effects: data.side_effects ?? 0,
      duration_weeks: data.duration_weeks ?? null,
      story_markdown: data.story ?? '',
      tags: data.tags ?? [],
      helpful_count: 0,
      is_anonymous: Boolean(data.is_anonymous),
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })

    await DatabaseService.recomputeConditionTreatment(data.condition_slug, data.treatment_slug)

    // Only increment member_count the first time this user shares for this condition.
    const prior = await getDocs(
      query(
        collection(db, 'experiences'),
        where('user_id', '==', userId),
        where('condition_slug', '==', data.condition_slug),
      ),
    )
    if (prior.size <= 1) {
      await updateDoc(doc(db, 'conditions', data.condition_slug), {
        member_count: increment(1),
        updated_at: serverTimestamp(),
      }).catch(() => undefined)
    }

    return { id: experienceRef.id }
  }

  static async recomputeConditionTreatment(conditionSlug: string, treatmentSlug: string) {
    const snap = await getDocs(
      query(
        collection(db, 'experiences'),
        where('condition_slug', '==', conditionSlug),
        where('treatment_slug', '==', treatmentSlug),
      ),
    )
    const rows = snap.docs.map((document) => document.data())
    const count = rows.length
    if (count === 0) return
    const effectivenessAvg = rows.reduce((total, row) => total + ((row.effectiveness as number) ?? 0), 0) / count
    const sideEffectsAvg = rows.reduce((total, row) => total + ((row.side_effects as number) ?? 0), 0) / count

    const aggregateId = `${conditionSlug}__${treatmentSlug}`
    await setDoc(doc(db, 'condition_treatments', aggregateId), {
      condition_slug: conditionSlug,
      treatment_slug: treatmentSlug,
      effectiveness_avg: Number(effectivenessAvg.toFixed(2)),
      effectiveness_count: count,
      side_effects_avg: Number(sideEffectsAvg.toFixed(2)),
      last_updated: serverTimestamp(),
    }, { merge: true })
  }

  static async getExperiencesForCondition(
    conditionSlug: string,
    options?: { treatment_slug?: string; limit?: number },
  ) {
    const snap = await getDocs(
      query(collection(db, 'experiences'), where('condition_slug', '==', conditionSlug)),
    )
    const rows: Array<FirestoreRecord & { id: string; profile: FirestoreRecord | null }> = await Promise.all(
      snap.docs
        .map((document) => ({ doc: document, data: document.data() }))
        .filter((entry) => !options?.treatment_slug || entry.data.treatment_slug === options.treatment_slug)
        .map(async (entry) => {
          const profile = entry.data.is_anonymous
            ? null
            : await getProfileSummary(entry.data.user_id as string | undefined)
          return { ...withId(entry.doc.id, entry.data), profile }
        }),
    )
    return rows.sort(sortByNewest).slice(0, options?.limit ?? 20)
  }

  static async voteOnExperience(userId: string, experienceId: string, kind: 'helpful' | 'not_helpful') {
    const voteId = `${experienceId}_${userId}`
    const voteRef = doc(db, 'experience_votes', voteId)
    const existing = await getDoc(voteRef)
    const increments = kind === 'helpful' ? 1 : -1
    if (existing.exists() && existing.data().kind === kind) {
      // Already voted same way — remove
      await deleteDoc(voteRef)
      await updateDoc(doc(db, 'experiences', experienceId), {
        helpful_count: increment(-increments),
      }).catch(() => undefined)
      return { vote: null }
    }
    await setDoc(voteRef, {
      experience_id: experienceId,
      user_id: userId,
      kind,
      created_at: serverTimestamp(),
    })
    await updateDoc(doc(db, 'experiences', experienceId), {
      helpful_count: increment(increments),
    }).catch(() => undefined)
    return { vote: kind }
  }

  static async getFeaturedInsights(limitCount = 6) {
    const conditions = await DatabaseService.getConditions()
    const featured = conditions.slice(0, limitCount)
    return Promise.all(
      featured.map(async (condition) => ({
        condition,
        topTreatments: await DatabaseService.getTopTreatments(condition.id as string, 3),
      })),
    )
  }
}
