import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { runDeepResearch } from '@/lib/ai/deep-research'
import { getDb } from '@/server/db/client'
import { researchRequests, resources } from '@/server/db/schema'
import { getSessionUserId } from '@/server/http/auth'
import { rateLimit } from '@/server/http/rate-limit'
import { checkAndConsume } from '@/server/billing/repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RequestBody = { topic?: string; dryRun?: boolean }

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: 'AI is not configured.' }, { status: 500 })
  }

  const userId = await getSessionUserId(request)
  if (!userId) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 })

  const limited = await rateLimit(`research:${userId}`, 5, 300)
  if (!limited.allowed) return NextResponse.json({ ok: false, error: 'Please wait a few minutes.' }, { status: 429 })

  const quota = await checkAndConsume(userId, 'ai_research')
  if (!quota.allowed) {
    return NextResponse.json(
      { ok: false, error: 'You’ve reached your monthly research limit. Upgrade for more.', upgrade: true },
      { status: 402 },
    )
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 })
  }

  const topic = (body.topic ?? '').trim()
  if (!topic || topic.length < 5) {
    return NextResponse.json({ ok: false, error: 'Please give us at least a short sentence.' }, { status: 400 })
  }
  if (topic.length > 600) return NextResponse.json({ ok: false, error: 'Topic too long.' }, { status: 400 })

  const db = getDb()
  let requestId: string | null = null
  if (!body.dryRun) {
    requestId = crypto.randomUUID()
    await db
      .insert(researchRequests)
      .values({ id: requestId, userId, request: topic, status: 'in-progress' })
      .catch(() => {
        requestId = null
      })
  }

  const result = await runDeepResearch(topic)
  if (!result.article) {
    if (requestId) {
      await db.update(researchRequests).set({ status: 'failed', updatedAt: new Date() }).where(eq(researchRequests.id, requestId)).catch(() => undefined)
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

  if (body.dryRun) return NextResponse.json({ ok: true, article: result.article, dryRun: true })

  let slug = `ai-${result.article.slug || 'article'}`
  let counter = 2
  while (await db.query.resources.findFirst({ where: eq(resources.slug, slug) })) {
    slug = `ai-${result.article.slug}-${counter}`
    counter += 1
  }

  await db.insert(resources).values({
    slug,
    title: result.article.title,
    excerpt: result.article.excerpt,
    bodyMarkdown: result.article.body_markdown,
    keyFindings: result.article.key_findings,
    tags: result.article.tags,
    topic: result.article.topic,
    plainLanguageSummary: result.article.plain_language_summary,
    caveats: result.article.caveats,
    sources: result.article.sources,
    url: result.article.sources[0]?.url ?? null,
    source: result.article.sources[0]?.domain ?? 'KinSpace research',
    category: 'research',
    type: 'article',
    aiGenerated: true,
    researchMode: 'deep',
    model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
    status: 'published',
    featured: false,
    submittedBy: 'system',
    requestedBy: userId,
    publishedAt: new Date(),
  })

  if (requestId) {
    await db
      .update(researchRequests)
      .set({ status: 'fulfilled', articleSlug: slug, fulfilledAt: new Date(), updatedAt: new Date() })
      .where(eq(researchRequests.id, requestId))
      .catch(() => undefined)
  }

  return NextResponse.json({ ok: true, articleId: slug, title: result.article.title })
}
