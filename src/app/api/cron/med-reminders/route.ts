import { NextRequest, NextResponse } from 'next/server'
import { runDueMedicationReminders } from '@/server/push/cron'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Medication-reminder tick. Designed to be called every ~5 minutes by a
 * scheduler (Cloudflare cron via the worker's scheduled() handler, or an
 * external uptime-cron pinger). Guarded by the CRON_SECRET bearer token.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization') || ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await runDueMedicationReminders(new Date())
    return NextResponse.json(result)
  } catch (error) {
    console.error('Medication reminder cron failed:', error)
    return NextResponse.json({ ok: false, error: 'cron_failed' }, { status: 500 })
  }
}
