import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { summariseSession } from '@/lib/ai/therapy-summary'
import { getAdminDb, isAdminConfigured } from '@/lib/server/firebase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RequestBody = {
  sessionId?: string
  userId?: string
  personaName?: string | null
  moodAtStart?: string | null
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY is not set' }, { status: 500 })
  }
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Firebase Admin not configured' },
      { status: 500 },
    )
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.sessionId || !body.userId || !Array.isArray(body.messages)) {
    return NextResponse.json(
      { ok: false, error: 'sessionId, userId, messages required' },
      { status: 400 },
    )
  }

  const db = getAdminDb()
  const ref = db.collection('therapy_sessions').doc(body.sessionId)
  const snap = await ref.get()
  if (!snap.exists) {
    return NextResponse.json({ ok: false, error: 'session not found' }, { status: 404 })
  }
  const existing = snap.data()
  if (existing?.user_id !== body.userId) {
    return NextResponse.json({ ok: false, error: 'not your session' }, { status: 403 })
  }
  if (existing?.summary) {
    return NextResponse.json({ ok: true, skipped: 'already-summarised' })
  }

  const summary = await summariseSession({
    messages: body.messages.map((message) => ({
      role: message.role,
      content: String(message.content ?? '').slice(0, 4000),
    })),
    personaName: body.personaName ?? null,
    moodAtStart: body.moodAtStart ?? (existing.mood_at_start as string | null) ?? null,
  })

  if (!summary) {
    // Not enough to summarise — just mark ended.
    await ref.update({ ended_at: FieldValue.serverTimestamp() }).catch(() => undefined)
    return NextResponse.json({ ok: true, skipped: 'too-short' })
  }

  await ref.update({
    summary: summary.summary,
    mood_at_end: summary.mood_at_end,
    key_themes: summary.key_themes,
    ended_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  })

  return NextResponse.json({ ok: true, summary })
}
