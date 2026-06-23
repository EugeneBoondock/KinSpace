import { and, eq, gte, desc, sql, inArray, type SQL } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { Ctx } from './_shared'
import { requireActor } from './_shared'
import { users, profiles } from '../db/schema/identity'
import {
  communityPosts,
  postComments,
  chatMessages,
  groups,
  connectionRequests,
} from '../db/schema/community'
import { conditions } from '../db/schema/health'
import { therapySessions } from '../db/schema/wellness'
import { reports } from '../db/schema'
import { sendEmail } from '../email'

const DAY_MS = 86_400_000

async function getRole(ctx: Ctx, userId: string): Promise<string> {
  const row = await ctx.db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { role: true },
  })
  return row?.role ?? 'user'
}

/** Throws 'Not authorized' (→ 403 at the RPC layer) unless the actor is an admin. */
async function requireAdmin(ctx: Ctx): Promise<string> {
  const uid = requireActor(ctx)
  if ((await getRole(ctx, uid)) !== 'admin') throw new Error('Not authorized')
  return uid
}

/** Cheap boolean so the client can decide whether to show the Admin nav link. */
export async function isAdmin(ctx: Ctx): Promise<boolean> {
  if (!ctx.userId) return false
  return (await getRole(ctx, ctx.userId)) === 'admin'
}

async function countRows(ctx: Ctx, table: SQLiteTable, where?: SQL): Promise<number> {
  const base = ctx.db.select({ c: sql<number>`count(*)` }).from(table)
  const rows = where ? await base.where(where) : await base
  return Number(rows[0]?.c ?? 0)
}

/**
 * Platform metrics for the owner dashboard: how many members, how fast it's
 * growing, and how much has been created. Admin-only. No PHI is returned;
 * recent-signup rows are username + join date only.
 */
export async function getAdminStats(ctx: Ctx) {
  await requireAdmin(ctx)

  const now = Date.now()
  const since1d = new Date(now - DAY_MS)
  const since7d = new Date(now - 7 * DAY_MS)
  const since30d = new Date(now - 30 * DAY_MS)
  const since14d = new Date(now - 14 * DAY_MS)

  const [total, verified, new24h, new7d, new30d, active7d, admins, suspended, onboarded] = await Promise.all([
    countRows(ctx, users),
    countRows(ctx, users, eq(users.emailVerified, true)),
    countRows(ctx, users, gte(users.createdAt, since1d)),
    countRows(ctx, users, gte(users.createdAt, since7d)),
    countRows(ctx, users, gte(users.createdAt, since30d)),
    countRows(ctx, users, gte(users.lastLoginAt, since7d)),
    countRows(ctx, users, eq(users.role, 'admin')),
    countRows(ctx, users, eq(users.status, 'suspended')),
    countRows(ctx, profiles, eq(profiles.onboardingComplete, true)),
  ])

  const [posts, comments, messages, groupCount, connections, conditionCount, therapyCount] = await Promise.all([
    countRows(ctx, communityPosts),
    countRows(ctx, postComments),
    countRows(ctx, chatMessages),
    countRows(ctx, groups),
    countRows(ctx, connectionRequests, eq(connectionRequests.status, 'accepted')),
    countRows(ctx, conditions),
    countRows(ctx, therapySessions),
  ])

  // Recent signups, username + join date only (deliberately no email/PHI).
  const recentRows = await ctx.db
    .select({ username: profiles.username, createdAt: users.createdAt, verified: users.emailVerified })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .orderBy(desc(users.createdAt))
    .limit(12)

  // 14-day signup sparkline, bucketed in JS (avoids SQLite date-fn portability).
  const recentCreated = await ctx.db
    .select({ createdAt: users.createdAt })
    .from(users)
    .where(gte(users.createdAt, since14d))
  const buckets = new Map<string, number>()
  for (let i = 13; i >= 0; i--) {
    const key = new Date(now - i * DAY_MS).toISOString().slice(0, 10)
    buckets.set(key, 0)
  }
  for (const r of recentCreated) {
    const d = r.createdAt instanceof Date ? r.createdAt : new Date(Number(r.createdAt))
    const key = d.toISOString().slice(0, 10)
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }

  return {
    users: {
      total,
      verified,
      new_24h: new24h,
      new_7d: new7d,
      new_30d: new30d,
      active_7d: active7d,
      admins,
      suspended,
      onboarded,
    },
    content: {
      posts,
      comments,
      messages,
      groups: groupCount,
      connections,
      conditions: conditionCount,
      therapy_sessions: therapyCount,
    },
    signups_daily: Array.from(buckets.entries()).map(([date, count]) => ({ date, count })),
    recent_signups: recentRows.map((r) => ({
      username: r.username,
      joined: r.createdAt instanceof Date ? r.createdAt.toISOString() : new Date(Number(r.createdAt)).toISOString(),
      verified: Boolean(r.verified),
    })),
    generated_at: new Date(now).toISOString(),
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendAdminMassEmail(
  ctx: Ctx,
  input: { subject?: string; body?: string; verifiedOnly?: boolean } = {},
) {
  await requireAdmin(ctx)

  const subject = String(input.subject ?? '').trim().slice(0, 140)
  const body = String(input.body ?? '').trim().slice(0, 8000)
  const verifiedOnly = Boolean(input.verifiedOnly)
  if (subject.length < 3) throw new Error('Subject is too short')
  if (body.length < 10) throw new Error('Message is too short')

  const recipientRows = await ctx.db
    .select({ email: users.email })
    .from(users)
    .where(verifiedOnly ? and(eq(users.status, 'active'), eq(users.emailVerified, true)) : eq(users.status, 'active'))
    .limit(1000)

  const htmlBody = escapeHtml(body)
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="line-height:1.6;margin:0 0 14px">${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('')
  const html = `
<div style="font-family:ui-sans-serif,system-ui,sans-serif;background:#f7f1e6;color:#1f352f;padding:28px;border-radius:18px;max-width:560px;margin:0 auto">
  <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(subject)}</h1>
  ${htmlBody}
  <p style="color:rgba(31,53,47,0.58);font-size:12px;margin-top:26px">Sent by KinSpace.</p>
</div>`

  let sent = 0
  let failed = 0
  for (const row of recipientRows) {
    const result = await sendEmail({ to: row.email, subject, text: body, html })
    if (result.ok) sent += 1
    else failed += 1
  }

  return {
    attempted: recipientRows.length,
    sent,
    failed,
    verified_only: verifiedOnly,
    recipient_limit_reached: recipientRows.length === 1000,
  }
}

/**
 * Open moderation reports for the admin queue (admin-only). Hydrates the
 * reporter + content-owner usernames and a short content preview so the queue
 * is actionable without extra round-trips. No PHI is returned.
 */
export async function getModerationReports(ctx: Ctx, status = 'open') {
  await requireAdmin(ctx)

  const rows = await ctx.db.query.reports.findMany({
    where: eq(reports.status, status),
    orderBy: [desc(reports.createdAt)],
    limit: 100,
  })
  if (rows.length === 0) return []

  const userIds = new Set<string>()
  const postIds: string[] = []
  const commentIds: string[] = []
  for (const row of rows) {
    if (row.reporterId) userIds.add(row.reporterId)
    if (row.targetOwnerId) userIds.add(row.targetOwnerId)
    if (row.targetType === 'user') userIds.add(row.targetId)
    else if (row.targetType === 'post') postIds.push(row.targetId)
    else if (row.targetType === 'comment') commentIds.push(row.targetId)
  }

  const [profileRows, postRows, commentRows] = await Promise.all([
    userIds.size
      ? ctx.db.select({ userId: profiles.userId, username: profiles.username }).from(profiles).where(inArray(profiles.userId, Array.from(userIds)))
      : Promise.resolve([] as Array<{ userId: string; username: string | null }>),
    postIds.length
      ? ctx.db.select({ id: communityPosts.id, content: communityPosts.content }).from(communityPosts).where(inArray(communityPosts.id, postIds))
      : Promise.resolve([] as Array<{ id: string; content: string | null }>),
    commentIds.length
      ? ctx.db.select({ id: postComments.id, content: postComments.content }).from(postComments).where(inArray(postComments.id, commentIds))
      : Promise.resolve([] as Array<{ id: string; content: string | null }>),
  ])

  const nameByUser = new Map(profileRows.map((p) => [p.userId, p.username ?? 'member']))
  const postById = new Map(postRows.map((p) => [p.id, p.content ?? '']))
  const commentById = new Map(commentRows.map((c) => [c.id, c.content ?? '']))

  const previewFor = (row: (typeof rows)[number]): string => {
    if (row.targetType === 'post') return (postById.get(row.targetId) ?? '').slice(0, 240)
    if (row.targetType === 'comment') return (commentById.get(row.targetId) ?? '').slice(0, 240)
    if (row.targetType === 'user') return `@${nameByUser.get(row.targetId) ?? 'member'}`
    return ''
  }

  return rows.map((row) => ({
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    targetOwnerId: row.targetOwnerId,
    reason: row.reason,
    detail: row.detail,
    status: row.status,
    createdAt: row.createdAt,
    reporterName: row.reporterId ? (nameByUser.get(row.reporterId) ?? 'member') : 'someone',
    ownerName: row.targetOwnerId ? (nameByUser.get(row.targetOwnerId) ?? 'member') : null,
    preview: previewFor(row),
  }))
}

type TrafficDay = { date: string; pageviews: number; requests: number; uniques: number }

/**
 * Site traffic from Cloudflare's own zone analytics (the GraphQL Analytics API).
 * Requires CLOUDFLARE_API_TOKEN (Analytics:Read) + CLOUDFLARE_ZONE_TAG as
 * secrets. Returns { configured: false } with setup hints when they're absent,
 * so the page degrades gracefully instead of erroring.
 */
export async function getAdminTraffic(ctx: Ctx) {
  await requireAdmin(ctx)

  const token = process.env.CLOUDFLARE_API_TOKEN
  const zoneTag = process.env.CLOUDFLARE_ZONE_TAG || process.env.CLOUDFLARE_ZONE_ID
  if (!token || !zoneTag) {
    return { configured: false as const }
  }

  const now = Date.now()
  const end = new Date(now).toISOString().slice(0, 10)
  const start = new Date(now - 6 * DAY_MS).toISOString().slice(0, 10)
  const query = `query Traffic($zone: String!, $start: String!, $end: String!) {
    viewer { zones(filter: { zoneTag: $zone }) {
      httpRequests1dGroups(limit: 7, filter: { date_geq: $start, date_leq: $end }, orderBy: [date_ASC]) {
        dimensions { date }
        sum { pageViews requests }
        uniq { uniques }
      }
    } }
  }`

  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { zone: zoneTag, start, end } }),
    })
    const json = (await res.json()) as {
      errors?: { message: string }[]
      data?: { viewer?: { zones?: Array<{ httpRequests1dGroups?: Array<{ dimensions: { date: string }; sum: { pageViews: number; requests: number }; uniq: { uniques: number } }> }> } }
    }
    if (json.errors?.length) {
      return { configured: true as const, error: 'Cloudflare API rejected the request. Check the token scope (Analytics:Read) and zone tag.' }
    }
    const rows = json.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? []
    const days: TrafficDay[] = rows.map((r) => ({
      date: r.dimensions.date,
      pageviews: r.sum.pageViews ?? 0,
      requests: r.sum.requests ?? 0,
      uniques: r.uniq.uniques ?? 0,
    }))
    const totals = days.reduce(
      (acc, d) => ({ pageviews: acc.pageviews + d.pageviews, requests: acc.requests + d.requests, uniques: acc.uniques + d.uniques }),
      { pageviews: 0, requests: 0, uniques: 0 })
    return { configured: true as const, days, totals }
  } catch {
    return { configured: true as const, error: 'Could not reach the Cloudflare analytics API.' }
  }
}
