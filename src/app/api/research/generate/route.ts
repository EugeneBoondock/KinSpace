import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { runDeepResearch, discoverBreakthroughTopics } from '@/lib/ai/deep-research'
import { fetchFreshItems } from '@/lib/ai/feeds'
import { generateArticle } from '@/lib/ai/openai'
import { getDb } from '@/server/db/client'
import { resources, researchRequests } from '@/server/db/schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Db = ReturnType<typeof getDb>

const EVERGREEN_TOPICS = [
  'new evidence for treating treatment-resistant depression',
  'recent research on long COVID and post-exertional malaise',
  'latest on chronic pain management without opioids',
  'advances in understanding fibromyalgia',
  'new findings on ADHD in adults',
  'recent PTSD treatment breakthroughs',
  'autoimmune flare triggers and lifestyle research',
  'sleep and chronic illness recent studies',
  'gut-brain axis and mental health',
  'endometriosis pain research updates',
  'low-dose naltrexone for chronic illness recent trials',
  'vagus nerve stimulation and mood disorders',
]

function authorized(request: NextRequest): boolean {
  const secret = process.env.RESEARCH_CRON_SECRET
  if (!secret) return false // require the cron secret in all environments
  const header = request.headers.get('authorization') ?? ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  return bearer === secret
}

function pickTopic(): string {
  return EVERGREEN_TOPICS[Math.floor(Math.random() * EVERGREEN_TOPICS.length)]
}

async function uniqueSlug(db: Db, base: string): Promise<string> {
  let slug = base || `article-${Date.now()}`
  let counter = 2
  while (await db.query.resources.findFirst({ where: eq(resources.slug, slug) })) {
    slug = `${base}-${counter}`
    counter += 1
  }
  return slug
}

type PendingTopic = { topic: string; requestId?: string; userId?: string }

async function collectPendingTopics(db: Db, max: number): Promise<PendingTopic[]> {
  const pending = await db.query.researchRequests.findMany({
    where: eq(researchRequests.status, 'pending'),
    limit: max,
  })
  const topics: PendingTopic[] = pending.map((r) => ({
    topic: String(r.request ?? '').trim(),
    requestId: r.id,
    userId: r.userId,
  }))

  // Fill remaining slots with self-discovered breakthroughs first, then fall
  // back to evergreen topics if discovery turns up nothing.
  const need = max - topics.length
  if (need > 0) {
    const discovered = await discoverBreakthroughTopics(need).catch(() => [] as string[])
    for (const topic of discovered) {
      if (topics.length >= max) break
      topics.push({ topic })
    }
  }
  while (topics.length < max) topics.push({ topic: pickTopic() })
  return topics
}

async function runDeepPipeline(db: Db, max: number) {
  if (!process.env.OPENAI_API_KEY) return { ok: false, error: 'OPENAI_API_KEY is not set.' }
  const topics = await collectPendingTopics(db, max)
  const generated: unknown[] = []
  const skipped: unknown[] = []
  for (const entry of topics.slice(0, max)) {
    if (!entry.topic) continue
    const result = await runDeepResearch(entry.topic)
    if (!result.article) {
      skipped.push({ topic: entry.topic, reason: result.pages.length === 0 ? 'no-sources' : 'synthesis-failed' })
      continue
    }
    const slug = await uniqueSlug(db, `ai-${result.article.slug}`)
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
      submittedBy: 'system',
      requestedBy: entry.userId ?? null,
      publishedAt: new Date(),
    })
    if (entry.requestId) {
      await db
        .update(researchRequests)
        .set({ status: 'fulfilled', articleSlug: slug, fulfilledAt: new Date(), updatedAt: new Date() })
        .where(eq(researchRequests.id, entry.requestId))
        .catch(() => undefined)
    }
    generated.push({ slug, title: result.article.title })
  }
  return { ok: true, mode: 'deep-research', generated, skipped }
}

async function runRssPipeline(db: Db, max: number) {
  if (!process.env.OPENAI_API_KEY) return { ok: false, error: 'OPENAI_API_KEY is not set.' }
  const items = await fetchFreshItems(72)
  const deduped: typeof items = []
  for (const item of items) {
    if (deduped.length >= max * 2) break
    const exists = await db.query.resources.findFirst({ where: eq(resources.url, item.url) })
    if (!exists) deduped.push(item)
  }
  const generated: unknown[] = []
  const skipped: unknown[] = []
  for (const source of deduped.slice(0, max)) {
    const article = await generateArticle(source)
    if (!article) {
      skipped.push({ title: source.title, reason: 'generation-failed' })
      continue
    }
    const slug = await uniqueSlug(db, `rss-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
    await db.insert(resources).values({
      slug,
      title: article.title,
      excerpt: article.excerpt,
      bodyMarkdown: article.body_markdown,
      keyFindings: article.key_findings,
      tags: article.tags,
      topic: source.topicHint ?? article.topic,
      source: source.sourceName,
      url: source.url,
      category: 'research',
      type: 'article',
      aiGenerated: true,
      researchMode: 'rss',
      model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
      plainLanguageSummary: article.plain_language_summary,
      caveats: article.caveats,
      status: 'published',
      submittedBy: 'system',
      pubDate: source.pubDate ?? null,
      publishedAt: new Date(),
    })
    generated.push({ slug, title: article.title })
  }
  return { ok: true, mode: 'rss', fetched: items.length, generated, skipped }
}

async function run(request: NextRequest, maxCap: number) {
  const url = new URL(request.url)
  const mode = (url.searchParams.get('mode') || 'deep').toLowerCase()
  const max = Math.min(maxCap, Math.max(1, Number(url.searchParams.get('max') || '2')))
  const db = getDb()
  return mode === 'rss' ? runRssPipeline(db, max) : runDeepPipeline(db, max)
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const result = await run(request, 10)
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const result = await run(request, 4)
  return NextResponse.json(result)
}
