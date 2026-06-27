import { NextRequest, NextResponse } from 'next/server'
import {
  buildGuideMemoryDocx,
  buildGuideMemoryPdf,
  formatGuideMemoryMarkdown,
  getOrBuildGuideMemory,
} from '@/server/therapy/guide-memory'
import { getDb } from '@/server/db/client'
import { getSessionUserId } from '@/server/http/auth'
import { recordAiPrivacyAuditEvent } from '@/server/privacy/ai-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ExportFormat = 'md' | 'pdf' | 'docx'

function parseFormat(value: string | null): ExportFormat {
  if (value === 'pdf' || value === 'docx') return value
  return 'md'
}

function safeFilePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'guide'
}

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId(request)
  if (!userId) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 })

  const format = parseFormat(request.nextUrl.searchParams.get('format'))
  const personaId = request.nextUrl.searchParams.get('persona')
  const db = getDb()
  const memory = await getOrBuildGuideMemory(db, userId, personaId)
  const markdown = formatGuideMemoryMarkdown(memory)
  const baseName = `kinspace-${safeFilePart(memory.personaName)}-guide-memory`

  void recordAiPrivacyAuditEvent(db, {
    actorId: userId,
    action: 'ai.guide.memory_exported',
    targetId: memory.personaId,
    meta: { personaId: memory.personaId, personaName: memory.personaName, format },
  }).catch(() => undefined)

  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'Content-Disposition': `attachment; filename="${baseName}.${format}"`,
  })

  if (format === 'pdf') {
    headers.set('Content-Type', 'application/pdf')
    return new Response(buildGuideMemoryPdf(markdown), { headers })
  }

  if (format === 'docx') {
    headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    return new Response(buildGuideMemoryDocx(markdown), { headers })
  }

  headers.set('Content-Type', 'text/markdown; charset=utf-8')
  return new Response(markdown, { headers })
}
