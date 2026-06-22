import { eq, and, desc, sql } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor, normalizeKeywords, getProfileSummaries } from './_shared'
import { groups, groupMembers, profiles } from '@/server/db/schema'
import { createNotification } from '@/server/notify'

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

/**
 * Join a group as a member. Idempotent: returns the existing membership id if
 * the actor is already a member. The actor comes from ctx.userId.
 */
export async function joinGroup(ctx: Ctx, groupId: string, _userId: string) {
  const actor = requireActor(ctx)

  const existing = await ctx.db.query.groupMembers.findFirst({
    where: and(eq(groupMembers.userId, actor), eq(groupMembers.groupId, groupId)),
  })
  if (existing) return existing.id

  const memberId = crypto.randomUUID()
  await ctx.db.insert(groupMembers).values({
    id: memberId,
    groupId,
    userId: actor,
    role: 'member',
  })

  await ctx.db
    .update(groups)
    .set({ membersCount: sql`${groups.membersCount} + 1`, updatedAt: new Date() })
    .where(eq(groups.id, groupId))

  return memberId
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

  await Promise.all(
    rows.map((row) => ctx.db.delete(groupMembers).where(eq(groupMembers.id, row.id))))

  try {
    await ctx.db
      .update(groups)
      .set({ membersCount: sql`${groups.membersCount} - ${rows.length}`, updatedAt: new Date() })
      .where(eq(groups.id, groupId))
  } catch {
    // Mirror the original `.catch(() => undefined)`, best-effort counter update.
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
  const profileMap = await getProfileSummaries(ctx.db, memberRows.map((row) => row.userId))
  const mine = actor ? memberRows.find((row) => row.userId === actor) ?? null : null

  // Order: admins first, then by join time.
  const members = memberRows
    .filter((row) => row.status !== 'banned')
    .map((row) => ({
      user_id: row.userId,
      role: row.role,
      status: row.status,
      profile: profileMap.get(row.userId) ?? null,
    }))
    .sort((a, b) => (a.role === 'admin' && b.role !== 'admin' ? -1 : b.role === 'admin' && a.role !== 'admin' ? 1 : 0))

  return {
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
    my_role: mine?.role ?? null,
    my_status: mine?.status ?? null,
    is_admin: actor ? await isGroupAdmin(ctx, groupId, actor) : false,
    members,
  }
}

/** Promote/demote a member ('admin' | 'member'). Admin-only; can't demote the creator. */
export async function setMemberRole(ctx: Ctx, groupId: string, targetUserId: string, role: 'admin' | 'member') {
  const actor = requireActor(ctx)
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

/** Invite someone by username, sends them a notification linking to the group. */
export async function inviteToGroup(ctx: Ctx, groupId: string, username: string) {
  const actor = requireActor(ctx)
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
