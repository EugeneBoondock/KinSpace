import { and, eq, gt, isNull, lt } from 'drizzle-orm'
import { summariseSession } from '@/lib/ai/therapy-summary'
import { getDb } from '@/server/db/client'
import { chatMessages, notifications, profiles, pushSubscriptions, therapySessions, users } from '@/server/db/schema'
import { encryptField } from '@/server/crypto/field-encryption'
import { sendEmail } from '@/server/email'
import { createNotification } from '@/server/notify'
import { isPushConfigured, sendWebPushToAll } from '@/server/push/send'
import { buildGuideFollowUpMessage } from './follow-up'
import { ensureGuidePersonaUser } from './guide-persona-user'
import { updateGuideMemoryFromSession } from './guide-memory'

const DEFAULT_IDLE_MS = 30 * 60 * 1000
const QUIET_FOLLOW_UP_MS = 3 * 24 * 60 * 60 * 1000
const QUIET_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

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
  let emailed = 0

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
    let savedSummary: Awaited<ReturnType<typeof summariseSession>> | null = null

    if (!session.summary && process.env.OPENAI_API_KEY && userMessageCount >= 2) {
      const summary = await summariseSession({
        messages: summaryMessages.slice(-100),
        personaName: session.persona ?? null,
        moodAtStart: session.moodAtStart ?? null,
      }).catch(() => null)

      if (summary) {
        savedSummary = summary
        patch = {
          ...patch,
          summary: await encryptField(summary.summary),
          moodAtEnd: summary.mood_at_end,
          keyThemes: summary.key_themes,
        }
      }
    }

    await db.update(therapySessions).set(patch).where(eq(therapySessions.id, session.id))
    if (savedSummary) {
      await updateGuideMemoryFromSession(db, {
        userId: session.userId,
        personaId: session.persona,
        sessionId: session.id,
        sessionSummary: savedSummary.summary,
        keyThemes: savedSummary.key_themes,
        endedAt: now,
      }).catch(() => undefined)
    }
    ended += 1

    if (userMessageCount === 0) continue
    if (options.notify === false) continue

    const followUp = buildGuideFollowUpMessage({
      personaId: session.persona,
      sessionId: session.id,
      reason: 'idle',
    })
    const guide = await ensureGuidePersonaUser(db, session.persona)
    await db.insert(chatMessages).values({
      id: crypto.randomUUID(),
      senderId: guide.userId,
      receiverId: session.userId,
      roomId: `guided-support-${session.userId}`,
      sessionId: session.id,
      message: followUp.sessionMemory,
      messageType: 'text',
      isAi: true,
      readAt: null,
    }).catch(() => undefined)

    await createNotification(db, session.userId, {
      type: 'guide_session_saved',
      title: followUp.title,
      body: followUp.body,
      data: { kind: 'guide-session-ended', session_id: session.id, url: followUp.url, persona: guide.persona.id },
    })
    notified += 1

    if (isPushConfigured()) {
      const subs = await db.query.pushSubscriptions.findMany({ where: eq(pushSubscriptions.userId, session.userId) })
      const results = await sendWebPushToAll(
        subs.map((sub) => ({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth })),
        {
          title: followUp.title,
          body: followUp.body,
          url: followUp.url,
          tag: `guide-session-${session.id}`,
          urgency: 'normal',
          ttl: 60 * 60,
          requireInteraction: false,
          renotify: false,
          data: { kind: 'guide-session-ended', sessionId: session.id, persona: guide.persona.id },
        },
      )
      if (results.some((result) => result.ok)) pushed += 1
      for (const endpoint of results.filter((result) => result.gone).map((result) => result.endpoint)) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
      }
    }

    const [recipient, recipientProfile] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, session.userId) }),
      db.query.profiles.findFirst({ where: eq(profiles.userId, session.userId) }),
    ])
    if (recipient?.email && recipient.emailVerified && recipientProfile?.notifyMessages !== false) {
      const sent = await sendEmail({
        to: recipient.email,
        subject: followUp.emailSubject,
        html: followUp.emailHtml,
        text: followUp.emailText,
      })
      if (sent.ok) emailed += 1
    }
  }

  return { ok: true, scanned: sessions.length, ended, notified, pushed, emailed }
}

export async function sendQuietGuideFollowUps(
  now = new Date(),
  options: { inactiveMs?: number; cooldownMs?: number; limit?: number } = {},
) {
  const db = getDb()
  const inactiveCutoff = new Date(now.getTime() - (options.inactiveMs ?? QUIET_FOLLOW_UP_MS))
  const cooldownCutoff = new Date(now.getTime() - (options.cooldownMs ?? QUIET_COOLDOWN_MS))
  const rows = await db.query.therapySessions.findMany()
  const latestByUser = new Map<string, typeof therapySessions.$inferSelect>()

  for (const session of rows) {
    if ((session.messageCount ?? 0) <= 0) continue
    const when = toDate(session.updatedAt as never) ?? toDate(session.startedAt as never)
    if (!when) continue
    const existing = latestByUser.get(session.userId)
    const existingWhen = existing
      ? toDate(existing.updatedAt as never) ?? toDate(existing.startedAt as never) ?? new Date(0)
      : new Date(0)
    if (when.getTime() > existingWhen.getTime()) latestByUser.set(session.userId, session)
  }

  const candidates = Array.from(latestByUser.values())
    .filter((session) => {
      const when = toDate(session.updatedAt as never) ?? toDate(session.startedAt as never)
      return Boolean(when && when < inactiveCutoff)
    })
    .sort(
      (first, second) =>
        (toDate(first.updatedAt as never) ?? toDate(first.startedAt as never) ?? new Date(0)).getTime() -
        (toDate(second.updatedAt as never) ?? toDate(second.startedAt as never) ?? new Date(0)).getTime(),
    )
    .slice(0, options.limit ?? 20)

  const scanned = candidates.length
  let created = 0
  let notified = 0
  let pushed = 0
  let emailed = 0

  for (const lastSession of candidates) {
    const [recent, profile, recipient] = await Promise.all([
      db.query.notifications.findMany({
        where: and(eq(notifications.userId, lastSession.userId), eq(notifications.type, 'guide_quiet_checkin')),
      }),
      db.query.profiles.findFirst({ where: eq(profiles.userId, lastSession.userId) }),
      db.query.users.findFirst({ where: eq(users.id, lastSession.userId) }),
    ])
    if (profile?.notifyMessages === false) continue
    const lastSent = recent
      .map((row) => toDate(row.createdAt as never))
      .filter((date): date is Date => Boolean(date))
      .sort((first, second) => second.getTime() - first.getTime())[0]
    if (lastSent && lastSent > cooldownCutoff) continue

    const sessionId = crypto.randomUUID()
    const followUp = buildGuideFollowUpMessage({
      personaId: lastSession.persona,
      sessionId,
      reason: 'quiet',
    })
    const guide = await ensureGuidePersonaUser(db, lastSession.persona)

    await db.insert(therapySessions).values({
      id: sessionId,
      userId: lastSession.userId,
      persona: lastSession.persona,
      theme: lastSession.theme,
      moodAtStart: null,
      messageCount: 1,
      summary: null,
      startedAt: now,
      updatedAt: now,
    })
    await db.insert(chatMessages).values({
      id: crypto.randomUUID(),
      senderId: guide.userId,
      receiverId: lastSession.userId,
      roomId: `guided-support-${lastSession.userId}`,
      sessionId,
      message: followUp.sessionMemory,
      messageType: 'text',
      isAi: true,
      readAt: null,
      createdAt: now,
    })
    created += 1

    await createNotification(db, lastSession.userId, {
      type: 'guide_quiet_checkin',
      title: followUp.title,
      body: followUp.body,
      data: { kind: 'guide-quiet-checkin', session_id: sessionId, url: followUp.url, persona: guide.persona.id },
    })
    notified += 1

    if (isPushConfigured()) {
      const subs = await db.query.pushSubscriptions.findMany({ where: eq(pushSubscriptions.userId, lastSession.userId) })
      const results = await sendWebPushToAll(
        subs.map((sub) => ({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth })),
        {
          title: followUp.title,
          body: followUp.body,
          url: followUp.url,
          tag: `guide-quiet-${lastSession.userId}`,
          urgency: 'normal',
          ttl: 24 * 60 * 60,
          requireInteraction: false,
          renotify: false,
          data: { kind: 'guide-quiet-checkin', sessionId, persona: guide.persona.id },
        },
      )
      if (results.some((result) => result.ok)) pushed += 1
      for (const endpoint of results.filter((result) => result.gone).map((result) => result.endpoint)) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
      }
    }

    if (recipient?.email && recipient.emailVerified) {
      const sent = await sendEmail({
        to: recipient.email,
        subject: followUp.emailSubject,
        html: followUp.emailHtml,
        text: followUp.emailText,
      })
      if (sent.ok) emailed += 1
    }
  }

  return { ok: true, scanned, created, notified, pushed, emailed }
}
