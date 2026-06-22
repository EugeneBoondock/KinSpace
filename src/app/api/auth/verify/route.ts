import { NextRequest, NextResponse } from 'next/server'
import { verifyEmail } from '@/server/auth/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function appOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token')
  if (!token) {
    return NextResponse.redirect(new URL('/verify-email?error=missing-token', appOrigin()))
  }
  const ok = await verifyEmail(token)
  return NextResponse.redirect(
    new URL(ok ? '/dashboard?verified=1' : '/verify-email?error=invalid', appOrigin()),
  )
}
