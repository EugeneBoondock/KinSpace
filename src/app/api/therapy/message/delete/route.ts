import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { summariseSession } from '@/lib/ai/therapy-summary'
import { getDb } from '@/server/db/client'
import { chatMessages, therapySessions } from '@/server/db/schema'
import { getSessionUserId } from '@/server/http/auth'
import { encryptField } from '@/server/crypto/field-encryption'
import { rebuildGuideMemory } from '@/server/therapy/guide-memory'
import { canDeleteGuideRoomMessage } from '@/server/therapy/message-delete'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RequestBody = { messageId?: string }

/**
 * Delete a single private Guide-room message, then rebuild the affected
 * session memory from what remains so the deleted content is also gone
 * from Guide memory.
 */
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId(request)
  if (!userId) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 })

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 })
  }

  const messageId = body.messageId
  if (!messageId) {
    return NextResponse.json({ ok: false, error: 'messageId required.' }, { status: 400 })
  }

  const db = getDb()
  const row = await db.query.chatMessages.findFirst({ where: eq(chatMessages.id, messageId) })
  if (!row) return NextResponse.json({ ok: false, error: 'Message not found.' }, { status: 404 })

  const sessionId = row.sessionId
  const session = sessionId
    ? await db.query.therapySessions.findFirst({ where: eq(therapySessions.id, sessionId) })
    : null

  if (!canDeleteGuideRoomMessage(userId, row, session ?? null)) {
    return NextResponse.json(
      { ok: false, error: 'You can only delete messages in your own Guide room.' },
      { status: 403 },
    )
  }

  await db.delete(chatMessages).where(eq(chatMessages.id, messageId))

  // Rebuild session memory from the messages that remain.
  if (sessionId && session && session.userId === userId) {
    const remaining = await db.query.chatMessages.findMany({ where: eq(chatMessages.sessionId, sessionId) })
    const ordered = remaining
      .map((m) => ({
        when: m.createdAt ? new Date(m.createdAt as unknown as string).getTime() : 0,
        role: (m.isAi ? 'assistant' : 'user') as 'user' | 'assistant',
        content: String(m.message ?? ''),
      }))
      .sort((a, b) => a.when - b.when)

    const userTurns = ordered.filter((m) => m.role === 'user').length
    let regenerated: Awaited<ReturnType<typeof summariseSession>> | null = null
    if (process.env.OPENAI_API_KEY && userTurns >= 2) {
      regenerated = await summariseSession({
        messages: ordered.slice(0, 100).map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
        personaName: session.persona ?? null,
        moodAtStart: session.moodAtStart ?? null,
      }).catch(() => null)
    }

    if (regenerated) {
      await db
        .update(therapySessions)
        .set({
          summary: await encryptField(regenerated.summary),
          moodAtEnd: regenerated.mood_at_end,
          keyThemes: regenerated.key_themes,
          updatedAt: new Date(),
        })
        .where(eq(therapySessions.id, sessionId))
      await rebuildGuideMemory(db, userId, session.persona).catch(() => undefined)
    } else {
      // When too little remains to summarize, clear this session memory.
      await db
        .update(therapySessions)
        .set({ summary: null, keyThemes: [], updatedAt: new Date() })
        .where(eq(therapySessions.id, sessionId))
      await rebuildGuideMemory(db, userId, session.persona).catch(() => undefined)
    }
  }

  return NextResponse.json({ ok: true })
}
