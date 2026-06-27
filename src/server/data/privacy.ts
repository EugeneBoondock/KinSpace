import { eq } from 'drizzle-orm'
import type { Ctx } from './_shared'
import { requireActor, sortByNewest } from './_shared'
import { auditLogs } from '@/server/db/schema'
import { formatAiPrivacyAuditEvent } from '@/server/privacy/ai-audit'

export async function getAiPrivacyEvents(ctx: Ctx, _userId?: string, limitCount = 12) {
  const userId = requireActor(ctx)
  const rows = await ctx.db.query.auditLogs.findMany({ where: eq(auditLogs.actorId, userId) })
  return sortByNewest([...rows])
    .map(formatAiPrivacyAuditEvent)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, Math.max(1, Math.min(limitCount, 50)))
}
