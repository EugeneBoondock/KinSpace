import { NextResponse } from 'next/server'
import { getVapidPublicKey } from '@/server/push/send'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const publicKey = getVapidPublicKey()
  if (!publicKey) {
    return NextResponse.json(
      { ok: false, error: 'Background reminders are not configured.' },
      { status: 503 },
    )
  }

  return NextResponse.json({ ok: true, publicKey })
}
