import { eq, and, desc, sql } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor, normalizeKeywords, getProfileSummaries } from './_shared'
import { groups, groupMembers, profiles } from '@/server/db/schema'
import { createNotification } from '@/server/notify'
import { requireFeatureAccess } from '@/server/billing/access'

/** True if the user is an admin (or the creator) of the group. */
async function isGroupAdmin(ctx: Ctx, groupId: string, userId: string): Promise<boolean> {
  const group = await ctx.db.query.groups.findFirst({ where: eq(groups.id, groupId) })
  if (!group) return false
  if (group.createdBy === userId) return true
  const membership = await ctx.db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
  })
  return membership?.role === 'admin'
}

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

type GroupRow = typeof groups.$inferSelect

/**
 * Public read. Optionally filter by category, sorted by membersCount desc to
 * mirror the original Firestore in-memory sort.
 */
export async function getGroups(ctx: Ctx, category?: string): Promise<GroupRow[]> {
  return ctx.db.query.groups.findMany({
    where: category ? eq(groups.category, category) : undefined,
    orderBy: [desc(groups.membersCount)],
    limit: 200,
  })
}

/**
 * Read about a user's group memberships. Hydrates each membership with its
 * `group`. Keeps memberships even if the group read fails (best-effort); only
 * drops orphaned memberships that have no groupId at all.
 */
export async function getUserGroupMemberships(ctx: Ctx, _userId?: string) {
  // Group membership is sensitive, always scope to the authenticated user.
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.groupMembers.findMany({
    where: eq(groupMembers.userId, userId),
  })

  const memberships = await Promise.all(
    rows.map(async (row) => {
      let group: GroupRow | null = null
      if (row.groupId) {
        try {
          group = (await ctx.db.query.groups.findFirst({ where: eq(groups.id, row.groupId) })) ?? null
        } catch (error) {
          console.warn(`Could not read group ${row.groupId}:`, error)
        }
      }
      return { ...row, group }
    }))

  return memberships.filter((membership) => Boolean(membership.groupId))
}

/**
 * Read about a user, keyword-matches the user's profile against groups they
 * haven't joined and scores them. Returns the top `limitCount` recommendations.
 */
export async function getRecommendedGroups(ctx: Ctx, _userId: string, limitCount = 6) {
  const userId = requireActor(ctx)
  const [profile, allGroups, memberships] = await Promise.all([
    ctx.db.query.profiles.findFirst({ where: eq(profiles.userId, userId) }),
    getGroups(ctx),
    getUserGroupMemberships(ctx, userId),
  ])

  const joinedGroupIds = new Set(memberships.map((membership) => membership.group?.id as string))
  const keywords = normalizeKeywords(
    profile?.bio as string | undefined,
    profile?.location as string | undefined,
    profile?.interests as string[] | undefined)

  return allGroups
    .filter((group) => !joinedGroupIds.has(group.id))
    .map((group) => {
      const haystack = normalizeKeywords(
        group.name as string | undefined,
        group.description as string | undefined,
        group.category as string | undefined,
        group.tags as string[] | undefined,
        group.location as string | undefined)

      const sharedKeywords = keywords.filter((keyword) => haystack.includes(keyword)).length
      const sizeBoost = Math.min(20, (group.membersCount ?? 0) / 10)
      const score = sharedKeywords * 12 + sizeBoost

      return {
        ...group,
        recommendation_score: score,
      }
    })
    .sort(
      (first, second) =>
        ((second.recommendation_score as number | undefined) ?? 0) - ((first.recommendation_score as number | undefined) ?? 0))
    .slice(0, limitCount)
}

/**
 * Create a group and add the actor as its admin member. The actor comes from
 * ctx.userId, the `userId` arg is ignored for authorization.
 */
export async function createGroup(ctx: Ctx, _userId: string, data: GroupInput) {
  const actor = requireActor(ctx)
  await requireFeatureAccess(ctx, 'support_circles')
  const groupId = crypto.randomUUID()

  await ctx.db.insert(groups).values({
    id: groupId,
    name: data.name,
    description: data.description,
    category: data.category,
    type: data.type || 'virtual',
    location: data.location ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    tags: data.tags || [],
    isPrivate: data.isPrivate || false,
    createdBy: actor,
    membersCount: 1,
  })

  await ctx.db.insert(groupMembers).values({
    id: crypto.randomUUID(),
    groupId,
    userId: actor,
    role: 'admin',
  })

  return { id: groupId }
}

/** Notify a group's creator + all admins (except the trigger user). Best-effort. */
async function notifyGroupAdmins(
  ctx: Ctx,
  group: GroupRow,
  exceptUserId: string,
  payload: { type: string; title: string; body?: string },
): Promise<void> {
  const adminRows = await ctx.db.query.groupMembers.findMany({
    where: and(eq(groupMembers.groupId, group.id), eq(groupMembers.role, 'admin')),
  })
  const recipientIds = new Set<string>([group.createdBy, ...adminRows.map((row) => row.userId)])
  recipientIds.delete(exceptUserId)
  for (const recipientId of recipientIds) {
    try {
      await createNotification(ctx.db, recipientId, {
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: { group_id: group.id, requester_id: exceptUserId },
      })
    } catch {
      // best-effort: never block the request flow on a notification failure
    }
  }
}

/**
 * Join a group. PUBLIC groups join immediately. PRIVATE groups can't be entered
 * freely: the actor is recorded as a 'pending' request (which does NOT count
 * toward membersCount) and the group's admins are notified to approve it.
 * Idempotent: re-joining returns the current state. The actor comes from
 * ctx.userId. Returns { status: 'joined' | 'pending' }.
 */
export async function joinGroup(
  ctx: Ctx,
  groupId: string,
  _userId: string,
): Promise<{ status: 'joined' | 'pending'; id: string }> {
  const actor = requireActor(ctx)

  const group = await ctx.db.query.groups.findFirst({ where: eq(groups.id, groupId) })
  if (!group) throw new Error('Group not found')

  const existing = await ctx.db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.userId, actor), eq(groupMembers.groupId, groupId)),
  })
  if (existing) {
    if (existing.status === 'banned') throw new Error('You do not have access to this group')
    if (existing.status === 'pending') return { status: 'pending', id: existing.id }
    return { status: 'joined', id: existing.id }
  }

  if (group.isPrivate) {
    const requestId = crypto.randomUUID()
    await ctx.db.insert(groupMembers).values({
      id: requestId,
      groupId,
      userId: actor,
      role: 'member',
      status: 'pending',
    })
    await notifyGroupAdmins(ctx, group, actor, {
      type: 'group_join_request',
      title: `Someone asked to join ${group.name}`,
      body: 'Tap to review the request.',
    })
    return { status: 'pending', id: requestId }
  }

  const memberId = crypto.randomUUID()
  await ctx.db.insert(groupMembers).values({
    id: memberId,
    groupId,
    userId: actor,
    role: 'member',
    status: 'active',
  })

  await ctx.db
    .update(groups)
    .set({ membersCount: sql`${groups.membersCount} + 1`, updatedAt: new Date() })
    .where(eq(groups.id, groupId))

  return { status: 'joined', id: memberId }
}

/**
 * Update a group. Only the group creator may edit it, ownership is checked
 * against ctx.userId, not the passed-in arg.
 */
export async function updateGroup(
  ctx: Ctx,
  groupId: string,
  _userId: string,
  updates: {
    name?: string
    description?: string
    category?: string
    type?: 'virtual' | 'in-person' | 'hybrid'
    location?: string | null
    tags?: string[]
    isPrivate?: boolean
    coverUrl?: string | null
    iconUrl?: string | null
  }) {
  const actor = requireActor(ctx)
  await requireFeatureAccess(ctx, 'support_circles')

  const group = await ctx.db.query.groups.findFirst({ where: eq(groups.id, groupId) })
  if (!group) throw new Error('Group not found')
  if (!(await isGroupAdmin(ctx, groupId, actor))) {
    throw new Error('Only group admins can edit it')
  }

  const payload: Record<string, unknown> = { updatedAt: new Date() }
  if (updates.name !== undefined) payload.name = updates.name
  if (updates.description !== undefined) payload.description = updates.description
  if (updates.category !== undefined) payload.category = updates.category
  if (updates.type !== undefined) payload.type = updates.type
  if (updates.location !== undefined) payload.location = updates.location
  if (updates.tags !== undefined) payload.tags = updates.tags
  if (updates.isPrivate !== undefined) payload.isPrivate = updates.isPrivate
  if (updates.coverUrl !== undefined) payload.coverUrl = updates.coverUrl
  if (updates.iconUrl !== undefined) payload.iconUrl = updates.iconUrl

  await ctx.db.update(groups).set(payload).where(eq(groups.id, groupId))
}

/**
 * Leave a group. Removes the actor's membership rows and decrements the group's
 * members count by the number removed. Returns false when not a member.
 */
export async function leaveGroup(ctx: Ctx, groupId: string, _userId: string): Promise<boolean> {
  const actor = requireActor(ctx)

  const rows = await ctx.db.query.groupMembers.findMany({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, actor)),
  })
  if (rows.length === 0) return false

  // Pending requests and banned rows never contributed to membersCount, so only
  // decrement for rows that were actually counted. This also lets a member cancel
  // a pending request (leave) without skewing the tally.
  const countedRemoved = rows.filter((row) => row.status !== 'banned' && row.status !== 'pending').length

  await Promise.all(
    rows.map((row) => ctx.db.delete(groupMembers).where(eq(groupMembers.id, row.id))))

  if (countedRemoved > 0) {
    try {
      await ctx.db
        .update(groups)
        .set({ membersCount: sql`max(0, ${groups.membersCount} - ${countedRemoved})`, updatedAt: new Date() })
        .where(eq(groups.id, groupId))
    } catch {
      // best-effort counter update
    }
  }

  return true
}

// ── Group detail + member management ────────────────────────────────────────

/**
 * Full detail for a group page: the group, the actor's own membership (role +
 * status), and the member roster hydrated with public profiles. Returns null if
 * the group doesn't exist.
 */
export async function getGroupDetail(ctx: Ctx, groupId: string) {
  const actor = ctx.userId ?? null
  const group = await ctx.db.query.groups.findFirst({ where: eq(groups.id, groupId) })
  if (!group) return null

  const memberRows = await ctx.db.query.groupMembers.findMany({ where: eq(groupMembers.groupId, groupId) })
  const mine = actor ? memberRows.find((row) => row.userId === actor) ?? null : null
  const isAdmin = actor ? await isGroupAdmin(ctx, groupId, actor) : false
  const isActiveMember = Boolean(mine && mine.status !== 'banned' && mine.status !== 'pending')

  const base = {
    id: group.id,
    name: group.name,
    description: group.description,
    category: group.category,
    type: group.type,
    location: group.location,
    tags: group.tags ?? [],
    is_private: group.isPrivate,
    cover_url: group.coverUrl,
    icon_url: group.iconUrl,
    created_by: group.createdBy,
    members_count: group.membersCount,
    // A pending request is not yet a role — surface it via my_status only so the
    // UI can show "Requested" instead of a member view.
    my_role: mine && mine.status !== 'pending' && mine.status !== 'banned' ? mine.role : null,
    my_status: mine?.status ?? null,
    is_admin: isAdmin,
  }

  // Private groups are locked to outsiders: show cover, logo, name and counts so
  // they can decide to request, but never the roster, the request queue, or feed.
  if (group.isPrivate && !isActiveMember && !isAdmin) {
    return { ...base, locked: true, members: [], pending_requests: [], pending_count: 0 }
  }

  const activeRows = memberRows.filter((row) => row.status !== 'banned' && row.status !== 'pending')
  const profileMap = await getProfileSummaries(ctx.db, activeRows.map((row) => row.userId))

  // Order: admins first, then by join time.
  const members = activeRows
    .map((row) => ({
      user_id: row.userId,
      role: row.role,
      status: row.status,
      profile: profileMap.get(row.userId) ?? null,
    }))
    .sort((a, b) => (a.role === 'admin' && b.role !== 'admin' ? -1 : b.role === 'admin' && a.role !== 'admin' ? 1 : 0))

  // Only admins see the pending join-request queue.
  const pendingRows = isAdmin ? memberRows.filter((row) => row.status === 'pending') : []
  const pendingProfiles = pendingRows.length
    ? await getProfileSummaries(ctx.db, pendingRows.map((row) => row.userId))
    : new Map()
  const pendingRequests = pendingRows
    .sort((a, b) => (a.joinedAt?.getTime() ?? 0) - (b.joinedAt?.getTime() ?? 0))
    .map((row) => ({
      user_id: row.userId,
      requested_at: row.joinedAt?.toISOString() ?? null,
      profile: pendingProfiles.get(row.userId) ?? null,
    }))

  return {
    ...base,
    locked: false,
    members,
    pending_requests: pendingRequests,
    pending_count: pendingRequests.length,
  }
}

/** Promote/demote a member ('admin' | 'member'). Admin-only; can't demote the creator. */
export async function setMemberRole(ctx: Ctx, groupId: string, targetUserId: string, role: 'admin' | 'member') {
  const actor = requireActor(ctx)
  await requireFeatureAccess(ctx, 'support_circles')
  if (!(await isGroupAdmin(ctx, groupId, actor))) throw new Error('Only admins can change roles')
  const group = await ctx.db.query.groups.findFirst({ where: eq(groups.id, groupId) })
  if (!group) throw new Error('Group not found')
  if (targetUserId === group.createdBy) throw new Error("The creator's role can't be changed")
  const nextRole = role === 'admin' ? 'admin' : 'member'
  await ctx.db
    .update(groupMembers)
    .set({ role: nextRole })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)))
  if (nextRole === 'admin') {
    await createNotification(ctx.db, targetUserId, {
      type: 'group_role',
      title: `You're now an admin of ${group.name}`,
      data: { group_id: groupId },
    })
  }
  return { ok: true }
}

/** Set a member's status: 'active' | 'muted' | 'banned'. Admin-only; never the creator. */
export async function setMemberStatus(
  ctx: Ctx,
  groupId: string,
  targetUserId: string,
  status: 'active' | 'muted' | 'banned') {
  const actor = requireActor(ctx)
  await requireFeatureAccess(ctx, 'support_circles')
  if (!(await isGroupAdmin(ctx, groupId, actor))) throw new Error('Only admins can moderate members')
  const group = await ctx.db.query.groups.findFirst({ where: eq(groups.id, groupId) })
  if (!group) throw new Error('Group not found')
  if (targetUserId === group.createdBy) throw new Error("The creator can't be moderated")
  if (targetUserId === actor) throw new Error("You can't moderate yourself")

  const existing = await ctx.db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)),
  })
  if (!existing) throw new Error('Not a member')
  const wasCounted = existing.status !== 'banned'
  const nextStatus = status === 'muted' ? 'muted' : status === 'banned' ? 'banned' : 'active'

  await ctx.db
    .update(groupMembers)
    .set({ status: nextStatus })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)))

  // Banning takes a head off the count; un-banning puts it back.
  const nowCounted = nextStatus !== 'banned'
  if (wasCounted && !nowCounted) {
    await ctx.db.update(groups).set({ membersCount: sql`max(0, ${groups.membersCount} - 1)` }).where(eq(groups.id, groupId))
  } else if (!wasCounted && nowCounted) {
    await ctx.db.update(groups).set({ membersCount: sql`${groups.membersCount} + 1` }).where(eq(groups.id, groupId))
  }
  return { ok: true }
}

/** Hard-remove a member. Admin-only; never the creator. */
export async function removeMember(ctx: Ctx, groupId: string, targetUserId: string) {
  const actor = requireActor(ctx)
  await requireFeatureAccess(ctx, 'support_circles')
  if (!(await isGroupAdmin(ctx, groupId, actor))) throw new Error('Only admins can remove members')
  const group = await ctx.db.query.groups.findFirst({ where: eq(groups.id, groupId) })
  if (!group) throw new Error('Group not found')
  if (targetUserId === group.createdBy) throw new Error("The creator can't be removed")

  const existing = await ctx.db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)),
  })
  if (!existing) return { ok: true }
  await ctx.db.delete(groupMembers).where(eq(groupMembers.id, existing.id))
  if (existing.status !== 'banned') {
    await ctx.db.update(groups).set({ membersCount: sql`max(0, ${groups.membersCount} - 1)` }).where(eq(groups.id, groupId))
  }
  return { ok: true }
}

/**
 * Approve a pending join request: flips the requester's row from 'pending' to
 * 'active', bumps the member count, and notifies them. Admin-only.
 */
export async function approveJoinRequest(ctx: Ctx, groupId: string, targetUserId: string) {
  const actor = requireActor(ctx)
  await requireFeatureAccess(ctx, 'support_circles')
  if (!(await isGroupAdmin(ctx, groupId, actor))) throw new Error('Only admins can approve requests')
  const group = await ctx.db.query.groups.findFirst({ where: eq(groups.id, groupId) })
  if (!group) throw new Error('Group not found')

  const request = await ctx.db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)),
  })
  if (!request || request.status !== 'pending') throw new Error('No pending request from this person')

  await ctx.db.update(groupMembers).set({ status: 'active' }).where(eq(groupMembers.id, request.id))
  await ctx.db
    .update(groups)
    .set({ membersCount: sql`${groups.membersCount} + 1`, updatedAt: new Date() })
    .where(eq(groups.id, groupId))

  await createNotification(ctx.db, targetUserId, {
    type: 'group_request_approved',
    title: `You're in! ${group.name} approved your request`,
    body: 'Tap to jump into the group.',
    data: { group_id: groupId },
  })
  return { ok: true }
}

/**
 * Decline a pending join request: removes the pending row. Admin-only. No
 * notification is sent so a decline never feels pointed; the person can ask again.
 */
export async function rejectJoinRequest(ctx: Ctx, groupId: string, targetUserId: string) {
  const actor = requireActor(ctx)
  await requireFeatureAccess(ctx, 'support_circles')
  if (!(await isGroupAdmin(ctx, groupId, actor))) throw new Error('Only admins can manage requests')

  const request = await ctx.db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)),
  })
  if (!request || request.status !== 'pending') return { ok: true }
  await ctx.db.delete(groupMembers).where(eq(groupMembers.id, request.id))
  return { ok: true }
}

/** Invite someone by username, sends them a notification linking to the group. */
export async function inviteToGroup(ctx: Ctx, groupId: string, username: string) {
  const actor = requireActor(ctx)
  await requireFeatureAccess(ctx, 'support_circles')
  const membership = await ctx.db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, actor)),
  })
  if (!membership || membership.status === 'banned') throw new Error('Only members can invite')

  const handle = username.trim().replace(/^@/, '').toLowerCase()
  if (!handle) throw new Error('Enter a username to invite')
  const target = await ctx.db.query.profiles.findFirst({
    where: sql`lower(${profiles.username}) = ${handle}`,
  })
  if (!target) throw new Error('No member found with that username')
  if (target.userId === actor) throw new Error("You're already here")

  const already = await ctx.db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, target.userId)),
  })
  if (already && already.status !== 'banned') throw new Error('They are already a member')

  const group = await ctx.db.query.groups.findFirst({ where: eq(groups.id, groupId) })
  await createNotification(ctx.db, target.userId, {
    type: 'group_invite',
    title: `You've been invited to ${group?.name ?? 'a group'}`,
    body: 'Tap to take a look and join if it feels right.',
    data: { group_id: groupId },
  })
  return { ok: true }
}
