import { NextRequest, NextResponse } from 'next/server'
import { identifyMedication } from '@/lib/ai/meds'
import { getDrugFacts } from '@/lib/ai/drug-facts'
import { getSessionUserId } from '@/server/http/auth'
import { rateLimit } from '@/server/http/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RequestBody = { image?: unknown }

// ~6MB cap on the data URL string. Base64 inflates bytes ~33%, so this allows
// roughly a 4.5MB source image - plenty for a phone photo of a label.
const MAX_IMAGE_CHARS = 6 * 1024 * 1024
const DATA_URL_PREFIX = /^data:image\/(jpeg|jpg|png|webp|gif|heic|heif);base64,/i

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: 'AI is not configured.' }, { status: 500 })
  }

  const userId = await getSessionUserId(request)
  if (!userId) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 })

  const limited = await rateLimit(`meds-identify:${userId}`, 20, 60)
  if (!limited.allowed) return NextResponse.json({ ok: false, error: 'Slow down a moment.' }, { status: 429 })

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 })
  }

  const image = body.image
  if (typeof image !== 'string' || image.length === 0) {
    return NextResponse.json({ ok: false, error: 'An image is required.' }, { status: 400 })
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ ok: false, error: 'Image is too large. Please use one under 6MB.' }, { status: 400 })
  }
  if (!DATA_URL_PREFIX.test(image)) {
    return NextResponse.json({ ok: false, error: 'Please upload a valid image (JPEG, PNG, or WebP).' }, { status: 400 })
  }

  // Never log the image itself.
  const result = await identifyMedication(image)
  if (!result) {
    return NextResponse.json({ ok: false, error: 'Could not analyze this photo. Please try again.' }, { status: 500 })
  }

  // Ground the AI guess in authoritative, free sources (RxNorm + openFDA +
  // MedlinePlus). Best-effort: never fails the identification.
  let facts = null
  if (result.confidence !== 'low') {
    facts = await getDrugFacts(result.generic_name || result.name).catch(() => null)
  }

  return NextResponse.json({ ok: true, medication: result, facts })
}
