import { NextRequest, NextResponse } from 'next/server'
import { closeIdleGuideSessions } from '@/server/therapy/idle-sessions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  const got = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!expected || got !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const result = await closeIdleGuideSessions(new Date())
  return NextResponse.json(result)
}
