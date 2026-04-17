import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { runDeepResearch } from '@/lib/ai/deep-research'
import { getAdminDb, isAdminConfigured } from '@/lib/server/firebase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RequestBody = {
  userId?: string
  topic?: string
  /** When true, skips writing to Firestore and just returns the article — used for preview. */
  dryRun?: boolean
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

  const topic = (body.topic ?? '').trim()
  if (!topic || topic.length < 5) {
    return NextResponse.json(
      { ok: false, error: 'Please give us a bit more — at least a short sentence.' },
      { status: 400 },
    )
  }
  if (topic.length > 600) {
    return NextResponse.json({ ok: false, error: 'Topic too long' }, { status: 400 })
  }

  const db = getAdminDb()

  // Record the request immediately so other users can see it was asked, and so
  // if the synthesis step crashes it's still on record for the cron.
  let requestDocId: string | null = null
  if (body.userId && !body.dryRun) {
    try {
      const ref = await db.collection('research_requests').add({
        user_id: body.userId,
        request: topic,
        status: 'in-progress',
        created_at: FieldValue.serverTimestamp(),
      })
      requestDocId = ref.id
    } catch (error) {
      console.warn('Could not log research request:', error)
    }
  }

  const result = await runDeepResearch(topic)
  if (!result.article) {
    if (requestDocId) {
      await db
        .collection('research_requests')
        .doc(requestDocId)
        .update({
          status: 'failed',
          failure_reason: result.pages.length === 0 ? 'no-sources' : 'synthesis-failed',
          updated_at: FieldValue.serverTimestamp(),
        })
        .catch(() => undefined)
    }
    return NextResponse.json(
      {
        ok: false,
        error:
          result.pages.length === 0
            ? 'We could not pull public sources for that topic. Try rephrasing?'
            : 'We had trouble writing the article. Try again shortly.',
      },
      { status: 502 },
    )
  }

  if (body.dryRun) {
    return NextResponse.json({ ok: true, article: result.article, dryRun: true })
  }

  // Save article with unique slug
  let slug = `ai-${result.article.slug || 'article'}`
  let counter = 2
  while ((await db.collection('resources').doc(slug).get()).exists) {
    slug = `ai-${result.article.slug}-${counter}`
    counter += 1
  }

  await db
    .collection('resources')
    .doc(slug)
    .set({
      title: result.article.title,
      slug,
      excerpt: result.article.excerpt,
      body_markdown: result.article.body_markdown,
      key_findings: result.article.key_findings,
      tags: result.article.tags,
      topic: result.article.topic,
      plain_language_summary: result.article.plain_language_summary,
      caveats: result.article.caveats,
      sources: result.article.sources,
      url: result.article.sources[0]?.url ?? null,
      source: result.article.sources[0]?.domain ?? 'KinSpace research',
      category: 'research',
      type: 'article',
      ai_generated: true,
      research_mode: 'deep',
      model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
      status: 'published',
      featured: false,
      submitted_by: 'system',
      requested_by: body.userId ?? null,
      requested_at: FieldValue.serverTimestamp(),
      contributions_count: 0,
      created_at: FieldValue.serverTimestamp(),
      published_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    })

  if (requestDocId) {
    await db
      .collection('research_requests')
      .doc(requestDocId)
      .update({
        status: 'fulfilled',
        article_slug: slug,
        fulfilled_at: FieldValue.serverTimestamp(),
      })
      .catch(() => undefined)
  }

  return NextResponse.json({ ok: true, articleId: slug, title: result.article.title })
}
