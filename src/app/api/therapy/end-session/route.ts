import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { summariseSession } from '@/lib/ai/therapy-summary'
import { getDb } from '@/server/db/client'
import { therapySessions } from '@/server/db/schema'
import { getSessionUserId } from '@/server/http/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RequestBody = {
  sessionId?: string
  personaName?: string | null
  moodAtStart?: string | null
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: 'AI is not configured.' }, { status: 500 })
  }

  const userId = await getSessionUserId(request)
  if (!userId) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 })

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 })
  }
  if (!body.sessionId || !Array.isArray(body.messages)) {
    return NextResponse.json({ ok: false, error: 'sessionId and messages required.' }, { status: 400 })
  }

  const db = getDb()
  const row = await db.query.therapySessions.findFirst({ where: eq(therapySessions.id, body.sessionId) })
  if (!row) return NextResponse.json({ ok: false, error: 'Session not found.' }, { status: 404 })
  if (row.userId !== userId) return NextResponse.json({ ok: false, error: 'Not your session.' }, { status: 403 })
  if (row.summary) return NextResponse.json({ ok: true, skipped: 'already-summarised' })

  const summary = await summariseSession({
    messages: body.messages.slice(0, 100).map((m) => ({ role: m.role, content: String(m.content ?? '').slice(0, 4000) })),
    personaName: body.personaName ?? null,
    moodAtStart: body.moodAtStart ?? row.moodAtStart ?? null,
  })

  if (!summary) {
    await db.update(therapySessions).set({ endedAt: new Date() }).where(eq(therapySessions.id, body.sessionId)).catch(() => undefined)
    return NextResponse.json({ ok: true, skipped: 'too-short' })
  }

  await db
    .update(therapySessions)
    .set({
      summary: summary.summary,
      moodAtEnd: summary.mood_at_end,
      keyThemes: summary.key_themes,
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(therapySessions.id, body.sessionId))

  return NextResponse.json({ ok: true, summary })
}
