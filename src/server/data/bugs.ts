import { eq } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor, getProfileSummaries, sortByNewest } from './_shared'
import { bugReports } from '@/server/db/schema'
import { isAdmin } from './admin'

const STATUS_ORDER: Record<string, number> = { open: 0, investigating: 1, resolved: 2, closed: 3 }
const VALID_STATUS = new Set(['open', 'investigating', 'resolved', 'closed'])
const VALID_SEVERITY = new Set(['low', 'normal', 'high'])

async function requireAdmin(ctx: Ctx): Promise<void> {
  if (!(await isAdmin(ctx))) throw new Error('Not authorized')
}

function serialize(row: typeof bugReports.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    page_url: row.pageUrl,
    severity: row.severity,
    status: row.status,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

/** File a bug report. Any signed-in member can do this. */
export async function reportBug(
  ctx: Ctx,
  data: { title: string; description?: string; pageUrl?: string; severity?: string },
) {
  const userId = requireActor(ctx)
  const title = String(data.title || '').trim()
  if (!title) throw new Error('Please describe the bug in a sentence.')
  const severity = VALID_SEVERITY.has(String(data.severity)) ? String(data.severity) : 'normal'

  const id = crypto.randomUUID()
  await ctx.db.insert(bugReports).values({
    id,
    userId,
    title: title.slice(0, 160),
    description: String(data.description ?? '').trim().slice(0, 4000),
    pageUrl: String(data.pageUrl ?? '').trim().slice(0, 300) || null,
    severity,
    status: 'open',
  })
  return { id }
}

/** The actor's own bug reports, newest first (so they can see what they filed). */
export async function getMyBugReports(ctx: Ctx) {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.bugReports.findMany({ where: eq(bugReports.userId, userId) })
  return sortByNewest([...rows]).map(serialize)
}

/** All bug reports with reporter info, admin-only. Open first, then newest. */
export async function getBugReports(ctx: Ctx, limitCount = 200) {
  await requireAdmin(ctx)
  const rows = await ctx.db.query.bugReports.findMany({ limit: limitCount })
  const reporters = await getProfileSummaries(ctx.db, rows.map((row) => row.userId))
  const ordered = sortByNewest([...rows]).sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9),
  )
  return ordered.map((row) => ({
    ...serialize(row),
    reporter: reporters.get(row.userId) ?? null,
  }))
}

/** Move a bug through its lifecycle, admin-only. */
export async function updateBugReportStatus(ctx: Ctx, id: string, status: string) {
  await requireAdmin(ctx)
  if (!id) throw new Error('id required')
  if (!VALID_STATUS.has(status)) throw new Error('Invalid status')
  await ctx.db.update(bugReports).set({ status, updatedAt: new Date() }).where(eq(bugReports.id, id))
  return { ok: true }
}
