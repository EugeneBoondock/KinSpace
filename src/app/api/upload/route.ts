import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserId } from '@/server/http/auth'
import { getEnv } from '@/server/env'
import { rateLimit } from '@/server/http/rate-limit'
import { randomToken } from '@/server/auth/crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KINDS = new Set(['avatars', 'covers', 'posts', 'groups', 'guide'])
const IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MEDIA = [...IMAGE, 'video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/wav']
const GUIDE_FILES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const MAX_BYTES = 25 * 1024 * 1024

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId(request)
  if (!userId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const limit = await rateLimit(`upload:${userId}`, 30, 60)
  if (!limit.allowed) return NextResponse.json({ ok: false, error: 'Too many uploads, slow down.' }, { status: 429 })

  const form = await request.formData()
  const file = form.get('file')
  const kind = String(form.get('kind') ?? 'posts')
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'No file' }, { status: 400 })
  if (!KINDS.has(kind)) return NextResponse.json({ ok: false, error: 'Invalid kind' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: 'File too large' }, { status: 400 })

  const allowed = kind === 'posts' ? MEDIA : kind === 'guide' ? [...MEDIA, ...GUIDE_FILES] : IMAGE
  if (!allowed.includes(file.type)) return NextResponse.json({ ok: false, error: 'Unsupported type' }, { status: 400 })

  const ext = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').slice(0, 8) ?? 'bin'
  const key = `${kind}/${userId}/${Date.now()}-${randomToken(6)}.${ext}`
  await getEnv().MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  })

  return NextResponse.json({ ok: true, url: `/api/media/${key}` })
}

export async function DELETE(request: NextRequest) {
  const userId = await getSessionUserId(request)
  if (!userId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { url?: string } | null
  const url = body?.url ?? ''
  const prefix = '/api/media/'
  if (!url.startsWith(prefix)) return NextResponse.json({ ok: true })
  const key = url.slice(prefix.length)
  // Only allow deleting one's own uploads.
  if (!key.includes(`/${userId}/`)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  await getEnv().MEDIA.delete(key).catch(() => undefined)
  return NextResponse.json({ ok: true })
}
