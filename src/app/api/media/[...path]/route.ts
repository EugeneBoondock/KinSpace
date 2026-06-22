import { NextRequest, NextResponse } from 'next/server'
import { getEnv } from '@/server/env'
import { getSessionUserId } from '@/server/http/auth'

export const runtime = 'nodejs'

const SAFE_KEY = /^[a-zA-Z0-9/_.\-]+$/

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const key = (path ?? []).join('/')
  if (!key || key.includes('..') || !SAFE_KEY.test(key)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  // Avatars and cover images are public; post media requires a signed-in user.
  const isPublicKind = key.startsWith('avatars/') || key.startsWith('covers/')
  if (!isPublicKind) {
    const userId = await getSessionUserId(request)
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const object = await getEnv().MEDIA.get(key)
  if (!object) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return new Response(object.body as unknown as ReadableStream, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': isPublicKind ? 'public, max-age=31536000, immutable' : 'private, max-age=3600',
      ETag: object.httpEtag,
    },
  })
}
