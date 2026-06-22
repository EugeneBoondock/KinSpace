import { and, asc, desc, eq, gt, inArray } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor, getProfileSummaries, type PublicProfile } from './_shared'
import {
  groupSessions,
  sessionParticipants,
  sessionMessages,
  groupMembers,
} from '@/server/db/schema'

/** How long the talking stick stays with one holder before the floor reopens. */
const FLOOR_HOLD_MS = 120 * 1000

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Post a system message into a session (e.g. "X joined."). */
async function postSystemMessage(ctx: Ctx, sessionId: string, actorId: string, content: string): Promise<void> {
  await ctx.db.insert(sessionMessages).values({
    id: crypto.randomUUID(),
    sessionId,
    userId: actorId,
    kind: 'system',
    content,
  })
}

/** Display name for a profile, honouring anonymity. Used inside system messages. */
function displayName(profile: PublicProfile | null | undefined): string {
  if (!profile || profile.isAnonymous) return 'Someone'
  return profile.fullName || profile.pseudonym || profile.username || 'A member'
}

/** Resolve a single actor's display name for system messages. */
async function actorName(ctx: Ctx, userId: string): Promise<string> {
  const map = await getProfileSummaries(ctx.db, [userId])
  return displayName(map.get(userId))
}

/**
 * Assert the actor is an active (non-banned) member of the group, returning the
 * actor id. Throws when the actor is not a member or has been banned.
 */
async function requireActiveGroupMember(ctx: Ctx, groupId: string): Promise<string> {
  const actor = requireActor(ctx)
  const membership = await ctx.db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, actor)),
  })
  if (!membership) throw new Error('Join the group to take part in a session')
  if (membership.status === 'banned') throw new Error('You no longer have access to this group')
  return actor
}

// ── Types (snake_case shapes returned to the client) ─────────────────────────

type SessionParticipantDto = {
  user_id: string
  role: string
  hand_raised: boolean
  status: string
  profile: PublicProfile | null
}

type SessionMessageDto = {
  id: string
  user_id: string
  kind: string
  content: string
  created_at: Date
  profile: PublicProfile | null
}

// ── Reads ────────────────────────────────────────────────────────────────────

/**
 * Sessions for a group: live ones first, then recent ended ones. Each row is
 * hydrated with the host's public profile and a participant count.
 */
export async function getGroupSessions(ctx: Ctx, groupId: string) {
  const rows = await ctx.db.query.groupSessions.findMany({
    where: eq(groupSessions.groupId, groupId),
    orderBy: [desc(groupSessions.startedAt)],
    limit: 50,
  })
  if (rows.length === 0) return []

  const hostMap = await getProfileSummaries(ctx.db, rows.map((row) => row.hostId))
  const participantRows = await ctx.db.query.sessionParticipants.findMany({
    where: and(
      inArray(sessionParticipants.sessionId, rows.map((row) => row.id)),
      eq(sessionParticipants.status, 'active')),
  })
  const countBySession = new Map<string, number>()
  for (const participant of participantRows) {
    countBySession.set(participant.sessionId, (countBySession.get(participant.sessionId) ?? 0) + 1)
  }

  const live = rows.filter((row) => row.status === 'live')
  const ended = rows.filter((row) => row.status !== 'live')

  return [...live, ...ended].map((row) => ({
    id: row.id,
    group_id: row.groupId,
    host_id: row.hostId,
    title: row.title,
    template: row.template,
    topic: row.topic,
    status: row.status,
    phase: row.phase,
    started_at: row.startedAt,
    ended_at: row.endedAt,
    host: hostMap.get(row.hostId) ?? null,
    participant_count: countBySession.get(row.id) ?? 0,
  }))
}

/**
 * Full detail for the live room: the session, whether the actor is the host,
 * their participant role, and the active participant roster (host first), each
 * hydrated with a public profile. Returns null if the session does not exist.
 */
export async function getSessionDetail(ctx: Ctx, sessionId: string) {
  const actor = ctx.userId ?? null
  const session = await ctx.db.query.groupSessions.findFirst({ where: eq(groupSessions.id, sessionId) })
  if (!session) return null

  const participantRows = await ctx.db.query.sessionParticipants.findMany({
    where: and(eq(sessionParticipants.sessionId, sessionId), eq(sessionParticipants.status, 'active')),
  })
  const profileMap = await getProfileSummaries(ctx.db, participantRows.map((row) => row.userId))
  const mine = actor ? participantRows.find((row) => row.userId === actor) ?? null : null

  const participants: SessionParticipantDto[] = participantRows
    .map((row) => ({
      user_id: row.userId,
      role: row.role,
      hand_raised: row.handRaised,
      status: row.status,
      profile: profileMap.get(row.userId) ?? null,
    }))
    .sort((a, b) => (a.role === 'host' && b.role !== 'host' ? -1 : b.role === 'host' && a.role !== 'host' ? 1 : 0))

  return {
    id: session.id,
    group_id: session.groupId,
    host_id: session.hostId,
    title: session.title,
    template: session.template,
    topic: session.topic,
    status: session.status,
    phase: session.phase,
    floor_holder_id: session.floorHolderId,
    floor_expires_at: session.floorExpiresAt,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    is_host: actor === session.hostId,
    my_role: mine?.role ?? null,
    participants,
  }
}

/**
 * Messages for a session, oldest → newest, hydrated with each author's public
 * profile. Pass `sinceIso` to fetch only messages newer than that timestamp
 * (used by the room's polling loop). Always returns a plain array.
 */
export async function getSessionMessages(
  ctx: Ctx,
  sessionId: string,
  sinceIso?: string | null): Promise<SessionMessageDto[]> {
  const since = sinceIso ? new Date(sinceIso) : null
  const sinceValid = since && !Number.isNaN(since.getTime()) ? since : null

  const rows = await ctx.db.query.sessionMessages.findMany({
    where: sinceValid
      ? and(eq(sessionMessages.sessionId, sessionId), gt(sessionMessages.createdAt, sinceValid))
      : eq(sessionMessages.sessionId, sessionId),
    orderBy: [asc(sessionMessages.createdAt)],
    limit: 300,
  })
  if (rows.length === 0) return []

  const profileMap = await getProfileSummaries(ctx.db, rows.map((row) => row.userId))
  return rows.map((row) => ({
    id: row.id,
    user_id: row.userId,
    kind: row.kind,
    content: row.content,
    created_at: row.createdAt,
    profile: row.kind === 'system' ? null : profileMap.get(row.userId) ?? null,
  }))
}

// ── Writes ─────────────────────────────────────────────────────────────────

/**
 * Start a new turn-based session inside a group. The actor must be an active
 * member; they become the host and the first participant, and open holding the
 * talking stick during check-in.
 */
export async function createGroupSession(
  ctx: Ctx,
  data: { groupId: string; title: string; template: string; topic?: string }): Promise<{ id: string }> {
  const groupId = String(data.groupId || '')
  const actor = await requireActiveGroupMember(ctx, groupId)

  const title = String(data.title || '').trim()
  if (!title) throw new Error('Give the session a title')
  const template = String(data.template || 'open').trim() || 'open'
  const topic = String(data.topic ?? '').trim()

  const sessionId = crypto.randomUUID()
  const now = new Date()
  await ctx.db.insert(groupSessions).values({
    id: sessionId,
    groupId,
    hostId: actor,
    title,
    template,
    topic,
    status: 'live',
    phase: 'checkin',
    floorHolderId: actor,
    floorExpiresAt: new Date(now.getTime() + FLOOR_HOLD_MS),
  })

  await ctx.db.insert(sessionParticipants).values({
    id: crypto.randomUUID(),
    sessionId,
    userId: actor,
    role: 'host',
    status: 'active',
  })

  await postSystemMessage(ctx, sessionId, actor, 'Session started.')
  return { id: sessionId }
}

/**
 * Join a live session as a member. The actor must be an active member of the
 * session's group. Idempotent: re-joining flips a prior 'left' row back to
 * 'active'. Posts a "<name> joined." system message.
 */
export async function joinSession(ctx: Ctx, sessionId: string): Promise<{ ok: true }> {
  const session = await ctx.db.query.groupSessions.findFirst({ where: eq(groupSessions.id, sessionId) })
  if (!session) throw new Error('Session not found')
  const actor = await requireActiveGroupMember(ctx, session.groupId)

  const existing = await ctx.db.query.sessionParticipants.findFirst({
    where: and(eq(sessionParticipants.sessionId, sessionId), eq(sessionParticipants.userId, actor)),
  })

  if (existing) {
    if (existing.status !== 'active') {
      await ctx.db
        .update(sessionParticipants)
        .set({ status: 'active' })
        .where(eq(sessionParticipants.id, existing.id))
      await postSystemMessage(ctx, sessionId, actor, `${await actorName(ctx, actor)} joined.`)
    }
    return { ok: true }
  }

  await ctx.db.insert(sessionParticipants).values({
    id: crypto.randomUUID(),
    sessionId,
    userId: actor,
    role: 'member',
    status: 'active',
  })
  await postSystemMessage(ctx, sessionId, actor, `${await actorName(ctx, actor)} joined.`)
  return { ok: true }
}

/** Leave a session, marks the actor's participant row as 'left'. */
export async function leaveSession(ctx: Ctx, sessionId: string): Promise<{ ok: true }> {
  const actor = requireActor(ctx)
  await ctx.db
    .update(sessionParticipants)
    .set({ status: 'left' })
    .where(and(eq(sessionParticipants.sessionId, sessionId), eq(sessionParticipants.userId, actor)))
  return { ok: true }
}

/**
 * Send a message into the session. The actor must be an active participant. In a
 * turn-based phase (anything other than check-in), only the current floor holder
 * may speak while the floor is held and unexpired.
 */
export async function sendSessionMessage(ctx: Ctx, sessionId: string, content: string): Promise<{ id: string }> {
  const actor = requireActor(ctx)
  const body = String(content ?? '').trim()
  if (!body) throw new Error('Write a message first')

  const session = await ctx.db.query.groupSessions.findFirst({ where: eq(groupSessions.id, sessionId) })
  if (!session) throw new Error('Session not found')
  if (session.status !== 'live') throw new Error('This session has ended')

  const participant = await ctx.db.query.sessionParticipants.findFirst({
    where: and(eq(sessionParticipants.sessionId, sessionId), eq(sessionParticipants.userId, actor)),
  })
  if (!participant || participant.status !== 'active') throw new Error('Join the session to take part')

  const floorActive =
    Boolean(session.floorExpiresAt) && (session.floorExpiresAt as Date).getTime() > Date.now()
  if (
    session.phase !== 'checkin' &&
    session.floorHolderId &&
    session.floorHolderId !== actor &&
    floorActive
  ) {
    throw new Error('Wait for the talking stick')
  }

  const id = crypto.randomUUID()
  await ctx.db.insert(sessionMessages).values({
    id,
    sessionId,
    userId: actor,
    kind: 'message',
    content: body,
  })
  await ctx.db.update(groupSessions).set({ updatedAt: new Date() }).where(eq(groupSessions.id, sessionId))
  return { id }
}

/**
 * Pass the talking stick to another participant (or open the floor with no
 * target). Only the host or the current floor holder may pass. Resets the floor
 * hold window and posts a "<name> has the floor." system message.
 */
export async function passFloor(ctx: Ctx, sessionId: string, toUserId?: string | null): Promise<{ ok: true }> {
  const actor = requireActor(ctx)
  const session = await ctx.db.query.groupSessions.findFirst({ where: eq(groupSessions.id, sessionId) })
  if (!session) throw new Error('Session not found')
  if (session.status !== 'live') throw new Error('This session has ended')
  if (actor !== session.hostId && actor !== session.floorHolderId) {
    throw new Error('Only the host or the current speaker can pass the talking stick')
  }

  const nextHolder = toUserId ? String(toUserId) : null
  await ctx.db
    .update(groupSessions)
    .set({
      floorHolderId: nextHolder,
      floorExpiresAt: new Date(Date.now() + FLOOR_HOLD_MS),
      updatedAt: new Date(),
    })
    .where(eq(groupSessions.id, sessionId))

  if (nextHolder) {
    await postSystemMessage(ctx, sessionId, actor, `${await actorName(ctx, nextHolder)} has the floor.`)
  } else {
    await postSystemMessage(ctx, sessionId, actor, 'The floor is open.')
  }
  return { ok: true }
}

/** Raise or lower the actor's hand within a session. */
export async function raiseHand(ctx: Ctx, sessionId: string, raised: boolean): Promise<{ ok: true }> {
  const actor = requireActor(ctx)
  await ctx.db
    .update(sessionParticipants)
    .set({ handRaised: Boolean(raised) })
    .where(and(eq(sessionParticipants.sessionId, sessionId), eq(sessionParticipants.userId, actor)))
  return { ok: true }
}

/** Advance the session to a new phase. Host only. Posts a "Now: <phase>." note. */
export async function advancePhase(ctx: Ctx, sessionId: string, phase: string): Promise<{ ok: true }> {
  const actor = requireActor(ctx)
  const session = await ctx.db.query.groupSessions.findFirst({ where: eq(groupSessions.id, sessionId) })
  if (!session) throw new Error('Session not found')
  if (actor !== session.hostId) throw new Error('Only the host can move the session along')
  if (session.status !== 'live') throw new Error('This session has ended')

  const next = String(phase || '').trim()
  if (!next) throw new Error('Pick a phase')

  await ctx.db
    .update(groupSessions)
    .set({ phase: next, updatedAt: new Date() })
    .where(eq(groupSessions.id, sessionId))
  await postSystemMessage(ctx, sessionId, actor, `Now: ${next}.`)
  return { ok: true }
}

/** End the session. Host only, sets status/phase to ended and posts a note. */
export async function endSession(ctx: Ctx, sessionId: string): Promise<{ ok: true }> {
  const actor = requireActor(ctx)
  const session = await ctx.db.query.groupSessions.findFirst({ where: eq(groupSessions.id, sessionId) })
  if (!session) throw new Error('Session not found')
  if (actor !== session.hostId) throw new Error('Only the host can end the session')

  await ctx.db
    .update(groupSessions)
    .set({ status: 'ended', phase: 'ended', endedAt: new Date(), updatedAt: new Date() })
    .where(eq(groupSessions.id, sessionId))
  await postSystemMessage(ctx, sessionId, actor, 'Session ended.')
  return { ok: true }
}
