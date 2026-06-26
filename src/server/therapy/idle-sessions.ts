import { and, eq, gt, isNull, lt } from 'drizzle-orm'
import { summariseSession } from '@/lib/ai/therapy-summary'
import { getDb } from '@/server/db/client'
import { chatMessages, pushSubscriptions, therapySessions } from '@/server/db/schema'
import { encryptField } from '@/server/crypto/field-encryption'
import { createNotification } from '@/server/notify'
import { isPushConfigured, sendWebPushToAll } from '@/server/push/send'

const DEFAULT_IDLE_MS = 30 * 60 * 1000

function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

export async function closeIdleGuideSessions(
  now = new Date(),
  options: { userId?: string; notify?: boolean; idleMs?: number; limit?: number } = {},
) {
  const db = getDb()
  const cutoff = new Date(now.getTime() - (options.idleMs ?? DEFAULT_IDLE_MS))
  const sessions = await db.query.therapySessions.findMany({
    where: and(
      isNull(therapySessions.endedAt),
      gt(therapySessions.messageCount, 0),
      lt(therapySessions.updatedAt, cutoff),
      options.userId ? eq(therapySessions.userId, options.userId) : undefined,
    ),
    limit: options.limit ?? 25,
  })

  let ended = 0
  let notified = 0
  let pushed = 0

  for (const session of sessions) {
    const rows = await db.query.chatMessages.findMany({ where: eq(chatMessages.sessionId, session.id) })
    const sorted = rows.sort(
      (a, b) =>
        (toDate(a.createdAt as never) ?? new Date(0)).getTime() -
        (toDate(b.createdAt as never) ?? new Date(0)).getTime(),
    )
    const summaryMessages = sorted.map((row) => ({
      role: row.isAi ? 'assistant' as const : 'user' as const,
      content: String(row.message ?? '').slice(0, 4000),
    }))
    const userMessageCount = summaryMessages.filter((message) => message.role === 'user').length

    let patch: Partial<typeof therapySessions.$inferInsert> = {
      endedAt: now,
      updatedAt: now,
    }

    if (!session.summary && process.env.OPENAI_API_KEY && userMessageCount >= 2) {
      const summary = await summariseSession({
        messages: summaryMessages.slice(-100),
        personaName: session.persona ?? null,
        moodAtStart: session.moodAtStart ?? null,
      }).catch(() => null)

      if (summary) {
        patch = {
          ...patch,
          summary: await encryptField(summary.summary),
          moodAtEnd: summary.mood_at_end,
          keyThemes: summary.key_themes,
        }
      }
    }

    await db.update(therapySessions).set(patch).where(eq(therapySessions.id, session.id))
    ended += 1

    if (options.notify === false) continue

    await createNotification(db, session.userId, {
      type: 'guide_session_saved',
      title: 'Guide session saved',
      body: 'It ended after 30 minutes away. You can reopen it from Guide history.',
      data: { kind: 'guide-session-ended', session_id: session.id, url: '/therapy?history=1' },
    })
    notified += 1

    if (isPushConfigured()) {
      const subs = await db.query.pushSubscriptions.findMany({ where: eq(pushSubscriptions.userId, session.userId) })
      const results = await sendWebPushToAll(
        subs.map((sub) => ({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth })),
        {
          title: 'Guide session saved',
          body: 'It ended after 30 minutes away. Tap to see your history.',
          url: '/therapy?history=1',
          tag: `guide-session-${session.id}`,
          urgency: 'normal',
          ttl: 60 * 60,
          requireInteraction: false,
          renotify: false,
          data: { kind: 'guide-session-ended', sessionId: session.id },
        },
      )
      if (results.some((result) => result.ok)) pushed += 1
      for (const endpoint of results.filter((result) => result.gone).map((result) => result.endpoint)) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
      }
    }
  }

  return { ok: true, scanned: sessions.length, ended, notified, pushed }
}
