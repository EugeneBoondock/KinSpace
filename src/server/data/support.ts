import { and, eq, desc } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor, toDate, getProfileSummary, getProfileSummaries } from './_shared'
import { supportPresence, supportRequests } from '@/server/db/schema'
import { createNotification } from '@/server/notify'
import { encryptField, decryptField } from '@/server/crypto/field-encryption'
import { detectCrisisSeverity } from '@/lib/crisis-detect'

/**
 * On-demand peer support - "Lanterns".
 *
 * A member signals they need someone right now (lights a lantern); members who
 * have made themselves available can answer. This is PEER support, NOT a crisis
 * line and NOT professional care - the UI deflects emergencies to /crisis. Once
 * answered, the two people talk in a normal DM room (so it also shows in
 * Messages). Notes are encrypted at rest; an anonymous request hides the
 * seeker's identity in the open-lantern list (the 1:1 chat is direct once
 * matched, which the UI states plainly).
 */

const REQUEST_TTL_MS = 30 * 60 * 1000
const MAX_OPENS_PER_HOUR = 6
const MAX_AVAILABLE_MINUTES = 240
const MIN_AVAILABLE_MINUTES = 5
const NOTIFY_CAP = 8
const clampInt = (value: unknown, lo: number, hi: number, fallback: number): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.max(lo, Math.min(hi, n))
}
const dmRoomId = (a: string, b: string): string => `dm:${[a, b].sort().join(':')}`
const future = (value: unknown): boolean => {
  const d = toDate(value as never)
  return !!d && d.getTime() > Date.now()
}
const cleanList = (value: unknown): string[] =>
  Array.isArray(value) ? Array.from(new Set(value.map((v) => String(v).trim()).filter(Boolean))).slice(0, 12) : []

// ── Availability (who can answer a lantern right now) ───────────────────────

export async function setSupportAvailability(
  ctx: Ctx,
  data: { minutes?: number; topics?: string[]; note?: string },
) {
  const userId = requireActor(ctx)
  const minutes = clampInt(data?.minutes, MIN_AVAILABLE_MINUTES, MAX_AVAILABLE_MINUTES, 60)
  const availableUntil = new Date(Date.now() + minutes * 60_000)
  const topics = cleanList(data?.topics)
  const note = data?.note ? String(data.note).trim().slice(0, 200) : null

  const existing = await ctx.db.query.supportPresence.findFirst({ where: eq(supportPresence.userId, userId) })
  if (existing) {
    await ctx.db
      .update(supportPresence)
      .set({ topics, note, availableUntil, updatedAt: new Date() })
      .where(eq(supportPresence.id, existing.id))
  } else {
    await ctx.db.insert(supportPresence).values({ id: crypto.randomUUID(), userId, topics, note, availableUntil })
  }
  return { available: true, available_until: availableUntil.toISOString(), topics }
}

export async function endSupportAvailability(ctx: Ctx) {
  const userId = requireActor(ctx)
  await ctx.db
    .update(supportPresence)
    .set({ availableUntil: new Date(Date.now() - 1000), updatedAt: new Date() })
    .where(eq(supportPresence.userId, userId))
  return { available: false }
}

export async function getMySupportAvailability(ctx: Ctx) {
  const userId = requireActor(ctx)
  const row = await ctx.db.query.supportPresence.findFirst({ where: eq(supportPresence.userId, userId) })
  if (!row || !future(row.availableUntil)) return { available: false, available_until: null, topics: [], note: null }
  return {
    available: true,
    available_until: (toDate(row.availableUntil as never) ?? new Date()).toISOString(),
    topics: Array.isArray(row.topics) ? row.topics : [],
    note: row.note ?? null,
  }
}

/** For the seeker: how many people are around to answer right now (+ a small sample). */
export async function getAvailableSupporters(ctx: Ctx) {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.supportPresence.findMany()
  const live = rows.filter((r) => r.userId !== userId && future(r.availableUntil))
  const sampleProfiles = await getProfileSummaries(ctx.db, live.slice(0, 5).map((r) => r.userId))
  const sample = live
    .slice(0, 5)
    .map((r) => sampleProfiles.get(r.userId))
    .filter(Boolean)
  return { count: live.length, sample }
}

// ── Requests ("lanterns") ────────────────────────────────────────────────────

function formatOwnRequest(
  row: typeof supportRequests.$inferSelect,
  note: string,
  matchedProfile: unknown,
) {
  return {
    id: row.id,
    status: row.status,
    note,
    // Flag so the seeker UI can surface crisis resources prominently - reuses the
    // platform's vetted detector; the lantern still proceeds, the help is additive.
    crisis: detectCrisisSeverity(note) !== 'none',
    condition_slug: row.conditionSlug,
    is_anonymous: row.isAnonymous,
    room_id: row.roomId,
    matched_user: matchedProfile ?? null,
    matched_at: row.matchedAt ? (toDate(row.matchedAt as never) ?? null)?.toISOString() ?? null : null,
    expires_at: (toDate(row.expiresAt as never) ?? new Date()).toISOString(),
    created_at: (toDate(row.createdAt as never) ?? new Date()).toISOString(),
  }
}

async function findActiveRequest(ctx: Ctx, seekerId: string) {
  const rows = await ctx.db.query.supportRequests.findMany({ where: eq(supportRequests.seekerId, seekerId) })
  return rows
    .filter((r) => (r.status === 'open' && future(r.expiresAt)) || r.status === 'matched')
    .sort((a, b) => (toDate(b.createdAt as never)?.getTime() ?? 0) - (toDate(a.createdAt as never)?.getTime() ?? 0))[0]
}

export async function openSupportRequest(
  ctx: Ctx,
  data: { note?: string; conditionSlug?: string; isAnonymous?: boolean },
) {
  const seekerId = requireActor(ctx)

  // One active lantern at a time - return the existing one rather than duplicate.
  const active = await findActiveRequest(ctx, seekerId)
  if (active) {
    const note = (await decryptField(active.note ?? '')) ?? ''
    const matchedId = active.matchedUserId
    const matched = matchedId ? await getProfileSummary(ctx.db, matchedId) : null
    return formatOwnRequest(active, note, matched)
  }

  // Hourly cap (prevents open/cancel notification spam at supporters).
  const recent = await ctx.db.query.supportRequests.findMany({ where: eq(supportRequests.seekerId, seekerId) })
  const lastHour = recent.filter((r) => (toDate(r.createdAt as never)?.getTime() ?? 0) > Date.now() - 3_600_000).length
  if (lastHour >= MAX_OPENS_PER_HOUR) {
    throw new Error('You’ve reached out several times recently. Please lean on the community or a crisis line if you need more support right now.')
  }

  const note = data?.note ? await encryptField(String(data.note).trim().slice(0, 500)) : null
  const conditionSlug = data?.conditionSlug ? String(data.conditionSlug).trim().slice(0, 80) : null
  const id = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + REQUEST_TTL_MS)
  await ctx.db.insert(supportRequests).values({
    id,
    seekerId,
    note,
    conditionSlug,
    isAnonymous: Boolean(data?.isAnonymous),
    status: 'open',
    expiresAt,
  })

  // Notify available supporters - prefer topic overlap, fall back to everyone available.
  const presenceRows = await ctx.db.query.supportPresence.findMany()
  const available = presenceRows.filter((r) => r.userId !== seekerId && future(r.availableUntil))
  const matchTopic = (r: (typeof available)[number]) =>
    conditionSlug && Array.isArray(r.topics) && r.topics.map((t) => String(t).toLowerCase()).includes(conditionSlug.toLowerCase())
  const overlapped = available.filter(matchTopic)
  const targets = (overlapped.length ? overlapped : available).slice(0, NOTIFY_CAP)
  await Promise.all(
    targets.map((r) =>
      createNotification(ctx.db, r.userId, {
        type: 'support_request',
        title: 'Someone could use a hand',
        body: 'A member just reached out for support. If you have space, you could be there for them.',
        data: { requestId: id },
      }),
    ),
  )

  const created = await ctx.db.query.supportRequests.findFirst({ where: eq(supportRequests.id, id) })
  const createdNote = (await decryptField(created?.note ?? '')) ?? ''
  return formatOwnRequest(created!, createdNote, null)
}

/** The seeker's current lantern (for polling the waiting state). */
export async function getMySupportRequest(ctx: Ctx) {
  const seekerId = requireActor(ctx)
  const active = await findActiveRequest(ctx, seekerId)
  if (!active) return null
  const note = (await decryptField(active.note ?? '')) ?? ''
  const matchedId = active.matchedUserId
  const matched = matchedId ? await getProfileSummary(ctx.db, matchedId) : null
  return formatOwnRequest(active, note, matched)
}

export async function cancelSupportRequest(ctx: Ctx) {
  const seekerId = requireActor(ctx)
  const active = await findActiveRequest(ctx, seekerId)
  if (active && active.status === 'open') {
    await ctx.db
      .update(supportRequests)
      .set({ status: 'closed', closedAt: new Date(), closedBy: seekerId, updatedAt: new Date() })
      .where(eq(supportRequests.id, active.id))
  }
  return { ok: true }
}

/** For available supporters: open lanterns to answer (not your own, not expired). */
export async function getOpenSupportRequests(ctx: Ctx, limitCount = 20) {
  const userId = requireActor(ctx)
  // Only members who have opted in as available can see open lanterns + their
  // notes. Gates the (decrypted) note list to active supporters, not anyone.
  const presence = await ctx.db.query.supportPresence.findFirst({ where: eq(supportPresence.userId, userId) })
  if (!presence || !future(presence.availableUntil)) return []
  const rows = await ctx.db.query.supportRequests.findMany({
    where: eq(supportRequests.status, 'open'),
    orderBy: [desc(supportRequests.createdAt)],
    limit: 100,
  })
  const live = rows.filter((r) => r.seekerId !== userId && future(r.expiresAt)).slice(0, Math.min(limitCount, 50))
  const namedIds = live.filter((r) => !r.isAnonymous).map((r) => r.seekerId)
  const profiles = await getProfileSummaries(ctx.db, namedIds)
  return Promise.all(
    live.map(async (r) => ({
      id: r.id,
      note: await decryptField(r.note ?? ''),
      // Redact the condition too for anonymous lanterns - condition + note can
      // re-identify someone in a small community.
      condition_slug: r.isAnonymous ? null : r.conditionSlug,
      is_anonymous: r.isAnonymous,
      seeker: r.isAnonymous ? null : profiles.get(r.seekerId) ?? null,
      created_at: (toDate(r.createdAt as never) ?? new Date()).toISOString(),
    })),
  )
}

export async function claimSupportRequest(ctx: Ctx, requestId: string) {
  const supporterId = requireActor(ctx)
  const req = await ctx.db.query.supportRequests.findFirst({ where: eq(supportRequests.id, requestId) })
  // Uniform "no longer available" wording so request ids can't be probed as an
  // existence oracle (only the self-claim case is distinct + harmless).
  if (req && req.seekerId === supporterId) throw new Error('You can’t answer your own lantern.')
  if (!req || req.status !== 'open' || !future(req.expiresAt)) {
    throw new Error('This lantern is no longer available.')
  }

  const roomId = dmRoomId(req.seekerId, supporterId)
  // Atomic claim: the WHERE includes status='open', and RETURNING tells us if we
  // actually won the row. An empty result = someone else claimed it first.
  const claimed = await ctx.db
    .update(supportRequests)
    .set({ status: 'matched', matchedUserId: supporterId, roomId, matchedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(supportRequests.id, requestId), eq(supportRequests.status, 'open')))
    .returning()
  if (claimed.length === 0) throw new Error('This lantern is no longer available.')

  await createNotification(ctx.db, req.seekerId, {
    type: 'support_matched',
    title: 'Someone answered your lantern',
    body: 'A member is here for you. Open the conversation when you’re ready.',
    data: { requestId, roomId },
  })

  const seeker = req.isAnonymous ? null : await getProfileSummary(ctx.db, req.seekerId)
  // partner_id lets the supporter open the 1:1 chat (/messages?to=). The chat is
  // inherently identified once connected - anonymity only hid the seeker in the list.
  return { ok: true, room_id: roomId, partner_id: req.seekerId, seeker, is_anonymous: req.isAnonymous }
}

/** Either party can gently end the support conversation. */
export async function closeSupportRequest(ctx: Ctx, requestId: string) {
  const userId = requireActor(ctx)
  const req = await ctx.db.query.supportRequests.findFirst({ where: eq(supportRequests.id, requestId) })
  if (!req) return { ok: true }
  if (req.seekerId !== userId && req.matchedUserId !== userId) throw new Error('Not authorized.')
  await ctx.db
    .update(supportRequests)
    .set({ status: 'closed', closedAt: new Date(), closedBy: userId, updatedAt: new Date() })
    // Only transition live states - never re-close (protects the closedBy audit value).
    .where(and(eq(supportRequests.id, requestId), eq(supportRequests.status, 'open')))
  await ctx.db
    .update(supportRequests)
    .set({ status: 'closed', closedAt: new Date(), closedBy: userId, updatedAt: new Date() })
    .where(and(eq(supportRequests.id, requestId), eq(supportRequests.status, 'matched')))
  return { ok: true }
}
