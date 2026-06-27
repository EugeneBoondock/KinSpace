import { NextRequest, NextResponse } from 'next/server'
import { formatGuideMemoryPreview, getOrBuildGuideMemory, resetGuideMemory } from '@/server/therapy/guide-memory'
import { getDb } from '@/server/db/client'
import { getSessionUserId } from '@/server/http/auth'
import { recordAiPrivacyAuditEvent } from '@/server/privacy/ai-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId(request)
  if (!userId) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 })

  const personaId = request.nextUrl.searchParams.get('persona')
  const memory = await getOrBuildGuideMemory(getDb(), userId, personaId)
  return NextResponse.json({ ok: true, memory: formatGuideMemoryPreview(memory) })
}

export async function DELETE(request: NextRequest) {
  const userId = await getSessionUserId(request)
  if (!userId) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 })

  const personaId = request.nextUrl.searchParams.get('persona')
  const db = getDb()
  const memory = await resetGuideMemory(db, userId, personaId)
  void recordAiPrivacyAuditEvent(db, {
    actorId: userId,
    action: 'ai.guide.memory_reset',
    targetId: memory.personaId,
    meta: { personaId: memory.personaId, personaName: memory.personaName },
  }).catch(() => undefined)
  return NextResponse.json({ ok: true, memory: formatGuideMemoryPreview(memory) })
}
