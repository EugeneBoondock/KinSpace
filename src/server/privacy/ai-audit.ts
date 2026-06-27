import type { Database } from '@/server/db/client'
import { auditLogs } from '@/server/db/schema'

export type AiAuditAction =
  | 'ai.guide.context_read'
  | 'ai.guide.memory_exported'
  | 'ai.guide.memory_reset'
  | 'ai.guide.public_comment_posted'

export type AiAuditMeta = Record<string, string | number | boolean | null>

const SAFE_META_KEYS = new Set([
  'personaId',
  'personaName',
  'healthShared',
  'conditionCount',
  'medicationCount',
  'accessNeedCount',
  'priorSessionCount',
  'hasGuideMemory',
  'format',
  'sessionId',
  'surface',
  'postScope',
  'postId',
  'commentId',
])

export type AiPrivacyAuditInsert = {
  actorId: string
  action: AiAuditAction
  targetType: 'guide'
  targetId: string | null
  meta: AiAuditMeta
}

export type AiPrivacyAuditRow = {
  id: string
  action: string
  targetType: string | null
  targetId: string | null
  meta: Record<string, unknown> | null
  createdAt: Date | string | null
}

export type AiPrivacyAuditItem = {
  id: string
  title: string
  body: string
  icon: string
  action: AiAuditAction
  createdAt: string | null
  meta: AiAuditMeta
}

function isAiAuditAction(action: string): action is AiAuditAction {
  return (
    action === 'ai.guide.context_read' ||
    action === 'ai.guide.memory_exported' ||
    action === 'ai.guide.memory_reset' ||
    action === 'ai.guide.public_comment_posted'
  )
}

function cleanScalar(value: unknown): string | number | boolean | null | undefined {
  if (value == null) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string') return value.trim().slice(0, 80)
  return undefined
}

export function sanitiseAiAuditMeta(input: Record<string, unknown> | null | undefined): AiAuditMeta {
  const output: AiAuditMeta = {}
  for (const [key, value] of Object.entries(input ?? {})) {
    if (!SAFE_META_KEYS.has(key)) continue
    const clean = cleanScalar(value)
    if (clean !== undefined) output[key] = clean
  }
  return output
}

export function buildAiPrivacyAuditEvent(input: {
  actorId: string
  action: AiAuditAction
  targetId?: string | null
  meta?: Record<string, unknown> | null
}): AiPrivacyAuditInsert {
  return {
    actorId: input.actorId,
    action: input.action,
    targetType: 'guide',
    targetId: input.targetId ?? null,
    meta: sanitiseAiAuditMeta(input.meta),
  }
}

function isoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function guideName(meta: AiAuditMeta, fallback: string | null | undefined): string {
  const name = typeof meta.personaName === 'string' && meta.personaName ? meta.personaName : fallback
  return name || 'Your Guide'
}

export function formatAiPrivacyAuditEvent(row: AiPrivacyAuditRow): AiPrivacyAuditItem | null {
  if (!isAiAuditAction(row.action)) return null
  const meta = sanitiseAiAuditMeta(row.meta ?? {})
  const persona = guideName(meta, row.targetId)

  if (row.action === 'ai.guide.context_read') {
    const memory = meta.hasGuideMemory ? 'saved memory' : 'no saved memory'
    const health = meta.healthShared ? 'health profile shared' : 'health profile hidden'
    return {
      id: row.id,
      action: row.action,
      title: 'Guide context used',
      body: `${persona} read private Guide context for a reply. ${health}, ${memory}.`,
      icon: 'ri-brain-line',
      createdAt: isoOrNull(row.createdAt),
      meta,
    }
  }

  if (row.action === 'ai.guide.memory_exported') {
    const format = String(meta.format ?? 'file').toUpperCase()
    return {
      id: row.id,
      action: row.action,
      title: 'Guide memory downloaded',
      body: `${persona} memory was downloaded as ${format}.`,
      icon: 'ri-download-2-line',
      createdAt: isoOrNull(row.createdAt),
      meta,
    }
  }

  if (row.action === 'ai.guide.public_comment_posted') {
    const surface = typeof meta.surface === 'string' && meta.surface ? meta.surface : 'community'
    const scope = typeof meta.postScope === 'string' && meta.postScope ? meta.postScope : 'public'
    return {
      id: row.id,
      action: row.action,
      title: 'Public Guide reply posted',
      body: `${persona} posted a Guide reply in ${surface}. Scope: ${scope}.`,
      icon: 'ri-chat-smile-2-line',
      createdAt: isoOrNull(row.createdAt),
      meta,
    }
  }

  return {
    id: row.id,
    action: row.action,
    title: 'Guide memory reset',
    body: `${persona} memory was reset. Past session history was kept.`,
    icon: 'ri-refresh-line',
    createdAt: isoOrNull(row.createdAt),
    meta,
  }
}

export async function recordAiPrivacyAuditEvent(
  db: Database,
  input: {
    actorId: string
    action: AiAuditAction
    targetId?: string | null
    meta?: Record<string, unknown> | null
  },
) {
  const event = buildAiPrivacyAuditEvent(input)
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorId: event.actorId,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    meta: event.meta,
  })
}
