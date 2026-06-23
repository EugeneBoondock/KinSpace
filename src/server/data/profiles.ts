import { eq, and, or, sql } from 'drizzle-orm'
import type { Ctx } from './_shared'
import {
  requireActor,
  getProfileSummary,
  toPublicProfile,
  sortByNewest,
} from './_shared'
import { profiles, connectionRequests, follows } from '@/server/db/schema'
import { encryptField, decryptField } from '@/server/crypto/field-encryption'
import { createNotification } from '@/server/notify'
import { blockedRelatedIds } from '@/server/social/blocks'
import type { Database } from '@/server/db/client'
import { normalizeMoodCheckin } from '@/lib/moods'

/** True when two users have an accepted connection (in either direction). */
async function areConnected(db: Database, a: string, b: string): Promise<boolean> {
  const rows = await db.query.connectionRequests.findMany({
    where: or(
      and(eq(connectionRequests.requesterId, a), eq(connectionRequests.targetUserId, b)),
      and(eq(connectionRequests.requesterId, b), eq(connectionRequests.targetUserId, a))),
  })
  return rows.some((row) => row.status === 'accepted')
}

/** Own profile with sensitive fields decrypted for the owner. */
async function ownProfile(row: typeof profiles.$inferSelect) {
  return {
    id: row.userId, ...row,
    emergencyContact: await decryptField(row.emergencyContact),
    emergencyPhone: await decryptField(row.emergencyPhone),
  }
}

// ── Profiles ────────────────────────────────────────────────────────────────

/**
 * Read a profile by id. The OWNER receives the full row; everyone else receives
 * only the public projection (no health/PHI, emergency contacts, mood, etc.).
 */
export async function getProfile(ctx: Ctx, userIdOrUsername: string) {
  let row = (await ctx.db.query.profiles.findFirst({ where: eq(profiles.userId, userIdOrUsername) })) ?? null
  if (!row) {
    // Fall back to a username lookup so @mention links (via /u/{username}) resolve.
    const handle = String(userIdOrUsername ?? '').trim().replace(/^@/, '').toLowerCase()
    if (handle) {
      row = (await ctx.db.query.profiles.findFirst({ where: sql`lower(${profiles.username}) = ${handle}` })) ?? null
    }
  }
  if (!row) return null
  const userId = row.userId
  if (ctx.userId === userId) return ownProfile(row) // own profile → full (decrypted)

  // Visibility gate. A non-anonymous profile is viewable across the community.
  // An anonymous profile is viewable only per the owner's choice: their accepted
  // connections, or nobody. Posts and comments are fetched separately and stay
  // visible regardless, only the profile view itself is gated here.
  if (row.isAnonymous) {
    const visibility = row.anonymousProfileVisibility ?? 'connections'
    const allowed =
      visibility === 'connections' && ctx.userId ? await areConnected(ctx.db, ctx.userId, userId) : false
    if (!allowed) {
      return {
        id: row.userId,
        userId: row.userId,
        username: row.pseudonym || 'Anonymous',
        pseudonym: row.pseudonym,
        isAnonymous: true,
        avatarUrl: null,
        restricted: true,
      }
    }
  }
  return toPublicProfile(row)
}

/** List profiles (PUBLIC projection only). Bounded, never dump the whole table. */
export async function listProfiles(ctx: Ctx, limit = 200) {
  const rows = await ctx.db.query.profiles.findMany({ limit })
  return rows.map(toPublicProfile)
}

// Fields a user may set on their own profile. Anything else (followers,
// postsCount, userId, role, timestamps) is rejected to prevent mass-assignment.
const ALLOWED_PROFILE_FIELDS = new Set([
  'username', 'fullName', 'pseudonym', 'isAnonymous', 'avatarUrl', 'coverImageUrl',
  'bio', 'pronouns', 'age', 'location', 'timezone', 'conditions', 'comorbidities',
  'medications', 'status', 'interests', 'mentalHealthGoals', 'preferredCommunication',
  'emergencyContact', 'emergencyPhone', 'dailyMood', 'moodUpdatedAt', 'therapistPersona',
  'onboardingComplete', 'onboardingStatus', 'visibility', 'shareHealthWithGuide',
  'anonymousProfileVisibility', 'notifyMatches', 'notifyMessages', 'notifyGroups',
  'hideConditionsOnHome', 'hideConditionsOnProfile',
  'spaceTheme', 'spaceAccent', 'spaceFont', 'spaceMotto', 'spaceVibe', 'spacePinnedNote',
])

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

/**
 * Update the authenticated user's own profile. Target is always ctx.userId
 * (never a passed arg). Input keys are normalised snake_case→camelCase and
 * filtered through an allowlist (fixes both silent no-op writes and mass-assignment).
 */
export async function updateProfile(ctx: Ctx, _userId: string, updates: Record<string, unknown>) {
  const actorId = requireActor(ctx)

  const safe: Record<string, unknown> = {}
  for (const [rawKey, value] of Object.entries(updates ?? {})) {
    const key = snakeToCamel(rawKey)
    if (!ALLOWED_PROFILE_FIELDS.has(key)) continue
    if (key === 'moodUpdatedAt' && (typeof value === 'string' || typeof value === 'number')) {
      safe[key] = new Date(value)
    } else if (key === 'dailyMood') {
      safe[key] = value == null || value === '' ? null : normalizeMoodCheckin(value)
    } else if (key === 'age' && typeof value === 'string') {
      const n = Number(value)
      safe[key] = Number.isFinite(n) ? n : null
    } else {
      safe[key] = value
    }
  }

  // Encrypt sensitive PII at rest before persisting.
  if (typeof safe.emergencyContact === 'string') safe.emergencyContact = await encryptField(safe.emergencyContact)
  if (typeof safe.emergencyPhone === 'string') safe.emergencyPhone = await encryptField(safe.emergencyPhone)

  await ctx.db
    .update(profiles)
    .set({ ...safe, updatedAt: new Date() })
    .where(eq(profiles.userId, actorId))

  const row = await ctx.db.query.profiles.findFirst({ where: eq(profiles.userId, actorId) })
  if (!row) return null
  return ownProfile(row)
}

/** Case-insensitive username availability check (DB-side), excluding one user. */
export async function isUsernameTaken(ctx: Ctx, username: string, excludeUserId?: string): Promise<boolean> {
  const normalized = username.trim().toLowerCase()
  if (!normalized) return false
  const rows = await ctx.db.query.profiles.findMany({
    where: sql`lower(${profiles.username}) = ${normalized}`,
    limit: 2,
  })
  return rows.some((row) => row.userId !== excludeUserId)
}

// ── One-way follow ("keep an eye on"), private, asymmetric, count-free ──────

export async function followUser(ctx: Ctx, followedId: string): Promise<{ following: boolean }> {
  const userId = requireActor(ctx)
  if (!followedId || followedId === userId) throw new Error('Invalid follow target')
  const existing = await ctx.db.query.follows.findFirst({
    where: and(eq(follows.followerId, userId), eq(follows.followedId, followedId)),
  })
  if (!existing) {
    await ctx.db.insert(follows).values({ id: crypto.randomUUID(), followerId: userId, followedId })
  }
  return { following: true }
}

export async function unfollowUser(ctx: Ctx, followedId: string): Promise<{ following: boolean }> {
  const userId = requireActor(ctx)
  await ctx.db
    .delete(follows)
    .where(and(eq(follows.followerId, userId), eq(follows.followedId, followedId)))
  return { following: false }
}

export async function isFollowing(ctx: Ctx, followedId: string): Promise<{ following: boolean }> {
  const userId = requireActor(ctx)
  const existing = await ctx.db.query.follows.findFirst({
    where: and(eq(follows.followerId, userId), eq(follows.followedId, followedId)),
  })
  return { following: Boolean(existing) }
}

/** User ids the actor follows, consumed by the warm feed (future). */
export async function listFollowing(ctx: Ctx): Promise<{ user_ids: string[] }> {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.follows.findMany({ where: eq(follows.followerId, userId) })
  return { user_ids: rows.map((row) => row.followedId) }
}

// ── Connection candidates (peer match scoring) ───────────────────────────────

const MIN_MATCH_SCORE = 42
const MAX_MATCH_SCORE = 96
const BASE_MATCH_SCORE = 40

/**
 * Suggest peers for the authenticated user. Scores against full candidate data
 * server-side, but RETURNS only the public projection + match metadata.
 */
export async function getConnectionCandidates(ctx: Ctx, _userId: string, limitCount = 12) {
  const actorId = requireActor(ctx)

  const [candidateRows, memberships, sentRequests, receivedRequests, currentRow] = await Promise.all([
    ctx.db.query.profiles.findMany({ limit: 500 }),
    ctx.db.query.groupMembers.findMany(),
    getSentConnectionRequests(ctx, actorId),
    getReceivedConnectionRequests(ctx, actorId),
    ctx.db.query.profiles.findFirst({ where: eq(profiles.userId, actorId) }),
  ])

  const membershipsByUser = new Map<string, Set<string>>()
  for (const member of memberships) {
    if (!member.userId || !member.groupId) continue
    const existing = membershipsByUser.get(member.userId) ?? new Set<string>()
    existing.add(member.groupId)
    membershipsByUser.set(member.userId, existing)
  }

  const excluded = new Set<string>([
    actorId, ...sentRequests.map((r) => r.targetUserId), ...receivedRequests.map((r) => r.requesterId),
  ])
  const currentUserGroups = membershipsByUser.get(actorId) ?? new Set<string>()

  return candidateRows
    .filter((row) => !excluded.has(row.userId))
    .filter((row) => row.onboardingComplete !== false)
    .map((row) => {
      const candidateGroups = membershipsByUser.get(row.userId) ?? new Set<string>()
      const sharedGroups = Array.from(candidateGroups).filter((g) => currentUserGroups.has(g)).length
      const ageGap = Math.abs((row.age ?? 0) - (currentRow?.age ?? 0))
      const locationMatch =
        typeof currentRow?.location === 'string' &&
        typeof row.location === 'string' &&
        currentRow.location.trim().length > 0 &&
        currentRow.location.trim().toLowerCase() === row.location.trim().toLowerCase()
      const communicationMatch =
        Boolean(currentRow?.preferredCommunication) &&
        currentRow?.preferredCommunication === row.preferredCommunication

      const score = Math.max(
        MIN_MATCH_SCORE,
        Math.min(
          MAX_MATCH_SCORE,
          BASE_MATCH_SCORE +
            sharedGroups * 18 +
            (locationMatch ? 12 : 0) +
            (communicationMatch ? 10 : 0) +
            (ageGap <= 5 ? 8 : ageGap <= 10 ? 4 : 0) +
            (typeof row.bio === 'string' && row.bio.trim() ? 6 : 0)))

      const highlights = [
        sharedGroups > 0 ? `${sharedGroups} shared group${sharedGroups === 1 ? '' : 's'}` : null,
        locationMatch ? 'same location' : null,
        typeof row.bio === 'string' && row.bio.trim() ? 'open profile' : null,
      ].filter(Boolean)

      // Public projection ONLY, never leak candidate age/location/health.
      return {
        ...toPublicProfile(row),
        match_score: score,
        shared_groups_count: sharedGroups,
        connection_highlights: highlights,
      }
    })
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, limitCount)
}

// ── People search (name / @username / location) ──────────────────────────────

/**
 * Free-text people search for the Strands "find people" surface. Matches on
 * full name, username, or city (case-insensitive). Authenticated-only. Returns
 * PUBLIC profiles plus the searcher's strand status with each person so the UI
 * can render the right action without an extra round-trip. `location` is
 * deliberately included here (city-level, user-entered) to power location
 * discovery; self, anonymous, un-onboarded, and blocked rows are excluded.
 */
export async function searchPeople(ctx: Ctx, query: string, limitCount = 24) {
  const actorId = requireActor(ctx)
  const q = (query ?? '').trim().toLowerCase()
  if (q.length < 2) return []
  // Escape LIKE wildcards in user input so a stray % / _ can't widen the match.
  const pattern = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`

  const [rows, blocked, sent, received] = await Promise.all([
    ctx.db.query.profiles.findMany({
      where: or(
        sql`lower(${profiles.fullName}) like ${pattern} escape '\\'`,
        sql`lower(${profiles.username}) like ${pattern} escape '\\'`,
        sql`lower(${profiles.location}) like ${pattern} escape '\\'`),
      limit: 120,
    }),
    blockedRelatedIds(ctx.db, actorId),
    getSentConnectionRequests(ctx, actorId),
    getReceivedConnectionRequests(ctx, actorId),
  ])

  const sentByTarget = new Map(sent.map((r) => [r.targetUserId, r]))
  const receivedByRequester = new Map(received.map((r) => [r.requesterId, r]))

  return rows
    .filter((row) => row.userId !== actorId)
    .filter((row) => !row.isAnonymous)
    .filter((row) => row.onboardingComplete !== false)
    .filter((row) => !blocked.has(row.userId))
    .slice(0, limitCount)
    .map((row) => {
      const s = sentByTarget.get(row.userId)
      const r = receivedByRequester.get(row.userId)
      let strandStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' = 'none'
      let requestId: string | null = null
      if (s?.status === 'accepted' || r?.status === 'accepted') {
        strandStatus = 'accepted'
      } else if (s?.status === 'pending') {
        strandStatus = 'pending_sent'
        requestId = s.id
      } else if (r?.status === 'pending') {
        strandStatus = 'pending_received'
        requestId = r.id
      }
      return {
        ...toPublicProfile(row),
        location: row.location ?? null,
        strandStatus,
        requestId,
      }
    })
}

// ── Connection requests ──────────────────────────────────────────────────────

export async function sendConnectionRequest(ctx: Ctx, _requesterId: string, targetUserId: string) {
  const requesterId = requireActor(ctx)
  if (targetUserId === requesterId) throw new Error('Cannot connect with yourself')

  // Idempotent in BOTH directions, don't create a duplicate if a request already exists either way.
  const existing = await ctx.db.query.connectionRequests.findFirst({
    where: or(
      and(eq(connectionRequests.requesterId, requesterId), eq(connectionRequests.targetUserId, targetUserId)),
      and(eq(connectionRequests.requesterId, targetUserId), eq(connectionRequests.targetUserId, requesterId))),
  })
  if (existing) return existing.id

  const id = crypto.randomUUID()
  await ctx.db.insert(connectionRequests).values({ id, requesterId, targetUserId, status: 'pending' })

  const me = await getProfileSummary(ctx.db, requesterId)
  await createNotification(ctx.db, targetUserId, {
    type: 'connection_request',
    title: `${me?.isAnonymous ? me?.pseudonym || 'Someone' : me?.fullName || me?.username || 'Someone'} wants to connect`,
    data: { fromUserId: requesterId, requestId: id },
  })
  return id
}

/** Connection requests sent by the authenticated user (scoped to ctx.userId). */
export async function getSentConnectionRequests(ctx: Ctx, _userId?: string) {
  const userId = requireActor(ctx)
  return ctx.db.query.connectionRequests.findMany({ where: eq(connectionRequests.requesterId, userId) })
}

/** Connection requests received by the authenticated user (scoped to ctx.userId). */
export async function getReceivedConnectionRequests(ctx: Ctx, _userId?: string) {
  const userId = requireActor(ctx)
  return ctx.db.query.connectionRequests.findMany({ where: eq(connectionRequests.targetUserId, userId) })
}

/** Accept or decline a connection request, only the recipient may. */
export async function updateConnectionRequest(ctx: Ctx, requestId: string, status: 'accepted' | 'declined') {
  const userId = requireActor(ctx)
  const row = await ctx.db.query.connectionRequests.findFirst({ where: eq(connectionRequests.id, requestId) })
  if (!row) throw new Error('Request not found')
  if (row.targetUserId !== userId) throw new Error('Not authorized')
  await ctx.db.update(connectionRequests).set({ status, updatedAt: new Date() }).where(eq(connectionRequests.id, requestId))

  if (status === 'accepted') {
    const me = await getProfileSummary(ctx.db, userId)
    await createNotification(ctx.db, row.requesterId, {
      type: 'connection_accepted',
      title: `${me?.isAnonymous ? me?.pseudonym || 'Someone' : me?.fullName || me?.username || 'Someone'} accepted your connection`,
      data: { fromUserId: userId },
    })
  }
}

/** Delete a connection request, only a participant (requester or target) may. */
export async function cancelConnectionRequest(ctx: Ctx, requestId: string) {
  const userId = requireActor(ctx)
  const row = await ctx.db.query.connectionRequests.findFirst({ where: eq(connectionRequests.id, requestId) })
  if (!row) return
  if (row.requesterId !== userId && row.targetUserId !== userId) throw new Error('Not authorized')
  await ctx.db.delete(connectionRequests).where(eq(connectionRequests.id, requestId))
}

// ── Connect Strands (hydrated connection requests) ───────────────────────────

export async function getStrandWithUser(ctx: Ctx, _currentUserId: string, otherUserId: string) {
  const currentUserId = requireActor(ctx)
  const rows = await ctx.db.query.connectionRequests.findMany({
    where: or(
      and(eq(connectionRequests.requesterId, currentUserId), eq(connectionRequests.targetUserId, otherUserId)),
      and(eq(connectionRequests.requesterId, otherUserId), eq(connectionRequests.targetUserId, currentUserId))),
  })
  if (rows.length === 0) return null
  const top = sortByNewest([...rows])[0]
  return { ...top, direction: top.requesterId === currentUserId ? ('sent' as const) : ('received' as const) }
}

type StrandRequest = Awaited<ReturnType<typeof getSentConnectionRequests>>[number]
type HydratedStrand = StrandRequest & {
  direction: 'sent' | 'received'
  profile: Awaited<ReturnType<typeof getProfileSummary>>
}

export async function getStrandSummary(ctx: Ctx, _userId?: string) {
  const userId = requireActor(ctx)
  const [sent, received] = await Promise.all([
    getSentConnectionRequests(ctx, userId),
    getReceivedConnectionRequests(ctx, userId),
  ])

  const hydrate = async (requests: StrandRequest[], direction: 'sent' | 'received'): Promise<HydratedStrand[]> =>
    Promise.all(
      requests.map(async (request): Promise<HydratedStrand> => {
        const otherId = direction === 'sent' ? request.targetUserId : request.requesterId
        const profile = await getProfileSummary(ctx.db, otherId ?? null)
        return { ...request, direction, profile }
      }))

  const [sentHydrated, receivedHydrated] = await Promise.all([hydrate(sent, 'sent'), hydrate(received, 'received')])

  // Dedup accepted by counterpart so a mutual pair never shows twice.
  const acceptedAll = sortByNewest(
    [...sentHydrated, ...receivedHydrated].filter((r) => r.status === 'accepted'))
  const seen = new Set<string>()
  const accepted = acceptedAll.filter((r) => {
    const other = r.direction === 'sent' ? r.targetUserId : r.requesterId
    if (seen.has(other)) return false
    seen.add(other)
    return true
  })

  return {
    pendingReceived: sortByNewest(receivedHydrated.filter((r) => r.status === 'pending')),
    pendingSent: sortByNewest(sentHydrated.filter((r) => r.status === 'pending')),
    accepted,
    declined: sortByNewest([...sentHydrated, ...receivedHydrated].filter((r) => r.status === 'declined')),
  }
}

export async function getStrandCounts(ctx: Ctx, _userId?: string) {
  const summary = await getStrandSummary(ctx)
  return {
    pendingReceived: summary.pendingReceived.length,
    pendingSent: summary.pendingSent.length,
    accepted: summary.accepted.length,
  }
}

/**
 * Count of accepted strands (mutual connections) for ANY user. A public-safe
 * aggregate (a connection count, not a vanity feed metric), shown on profiles.
 */
export async function getStrandCountForUser(ctx: Ctx, userId: string): Promise<number> {
  if (!userId) return 0
  const rows = await ctx.db.query.connectionRequests.findMany({
    where: and(
      eq(connectionRequests.status, 'accepted'),
      or(eq(connectionRequests.requesterId, userId), eq(connectionRequests.targetUserId, userId))),
  })
  // Dedupe by the counterpart so a mutual pair is never counted twice.
  const partners = new Set<string>()
  for (const row of rows) {
    partners.add(row.requesterId === userId ? row.targetUserId : row.requesterId)
  }
  return partners.size
}
