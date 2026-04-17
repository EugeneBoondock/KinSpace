import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { runDeepResearch } from '@/lib/ai/deep-research'
import { fetchFreshItems } from '@/lib/ai/feeds'
import { generateArticle } from '@/lib/ai/openai'
import { getAdminDb, isAdminConfigured } from '@/lib/server/firebase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Default evergreen topics — used when no `research_requests` are pending
// and no explicit topics are passed. Mix of chronic, mental-health, pain,
// autoimmune. Each cron run will pick ONE and do deep research on it.
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

function authorized(request: NextRequest) {
  const secret = process.env.RESEARCH_CRON_SECRET
  if (!secret) return true // allow local dev if unset
  const header = request.headers.get('authorization') ?? ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  return bearer === secret
}

async function slugExists(db: FirebaseFirestore.Firestore, slug: string): Promise<boolean> {
  const snap = await db.collection('resources').doc(slug).get()
  return snap.exists
}

async function ensureUniqueSlug(
  db: FirebaseFirestore.Firestore,
  baseSlug: string,
): Promise<string> {
  let slug = baseSlug || `article-${Date.now()}`
  let counter = 2
  while (await slugExists(db, slug)) {
    slug = `${baseSlug}-${counter}`
    counter += 1
  }
  return slug
}

function pickTopicFromList(): string {
  return EVERGREEN_TOPICS[Math.floor(Math.random() * EVERGREEN_TOPICS.length)]
}

type PendingTopic = {
  topic: string
  requestId?: string
  userId?: string
}

async function collectPendingTopics(
  db: FirebaseFirestore.Firestore,
  max: number,
): Promise<PendingTopic[]> {
  // Pull outstanding user-submitted research_requests first.
  const pendingSnap = await db
    .collection('research_requests')
    .where('status', '==', 'pending')
    .limit(max)
    .get()

  const topics: PendingTopic[] = pendingSnap.docs.map((doc) => {
    const data = doc.data()
    return {
      topic: String(data.request ?? '').trim(),
      requestId: doc.id,
      userId: data.user_id as string | undefined,
    }
  })

  // Pad with evergreens so the library always grows.
  while (topics.length < max) {
    topics.push({ topic: pickTopicFromList() })
  }
  return topics
}

async function runTopic(
  db: FirebaseFirestore.Firestore | null,
  entry: PendingTopic,
  dryRun: boolean,
) {
  const result = await runDeepResearch(entry.topic)
  if (!result.article) {
    return {
      topic: entry.topic,
      ok: false,
      reason: result.pages.length === 0 ? 'no-sources' : 'synthesis-failed',
    }
  }

  if (dryRun || !db) {
    return {
      topic: entry.topic,
      ok: true,
      title: result.article.title,
      sourceCount: result.article.sources.length,
    }
  }

  const slug = await ensureUniqueSlug(db, `ai-${result.article.slug}`)
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
      requested_by: entry.userId ?? null,
      created_at: FieldValue.serverTimestamp(),
      published_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    })

  if (entry.requestId) {
    await db
      .collection('research_requests')
      .doc(entry.requestId)
      .update({
        status: 'fulfilled',
        article_slug: slug,
        fulfilled_at: FieldValue.serverTimestamp(),
      })
      .catch(() => undefined)
  }

  return {
    topic: entry.topic,
    ok: true,
    slug,
    title: result.article.title,
    sourceCount: result.article.sources.length,
  }
}

async function runDeepPipeline(dryRun: boolean, max: number) {
  if (!isAdminConfigured() && !dryRun) {
    return {
      ok: false,
      error:
        'Firebase Admin credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.',
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: 'OPENAI_API_KEY is not set.' }
  }

  const db = !dryRun ? getAdminDb() : null
  const topics = db
    ? await collectPendingTopics(db, max)
    : Array.from({ length: max }, () => ({ topic: pickTopicFromList() }))

  const results = []
  for (const entry of topics.slice(0, max)) {
    if (!entry.topic) continue
    // Deep research is token-expensive — run sequentially.
    const result = await runTopic(db, entry, dryRun)
    results.push(result)
  }

  return {
    ok: true,
    mode: 'deep-research',
    dryRun,
    generated: results.filter((result) => result.ok),
    skipped: results.filter((result) => !result.ok),
  }
}

// ── RSS pipeline (kept as a lightweight fallback: 1 LLM call per item) ─

async function runRssPipeline(dryRun: boolean, max: number) {
  if (!isAdminConfigured() && !dryRun) {
    return { ok: false, error: 'Firebase Admin credentials not configured.' }
  }
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: 'OPENAI_API_KEY is not set.' }
  }

  const items = await fetchFreshItems(72)
  const db = !dryRun ? getAdminDb() : null
  const deduped: typeof items = []
  for (const item of items) {
    if (deduped.length >= max * 2) break
    if (!db) {
      deduped.push(item)
      continue
    }
    const exists = await db.collection('resources').where('url', '==', item.url).limit(1).get()
    if (exists.empty) deduped.push(item)
  }

  const generated: Array<{ title: string; url: string; id?: string }> = []
  const skipped: Array<{ title: string; reason: string }> = []

  for (const source of deduped.slice(0, max)) {
    const article = await generateArticle(source)
    if (!article) {
      skipped.push({ title: source.title, reason: 'generation-failed' })
      continue
    }
    if (dryRun || !db) {
      generated.push({ title: article.title, url: source.url })
      continue
    }
    const slug = `rss-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    await db.collection('resources').doc(slug).set({
      title: article.title,
      slug,
      excerpt: article.excerpt,
      body_markdown: article.body_markdown,
      key_findings: article.key_findings,
      tags: article.tags,
      topic: source.topicHint ?? article.topic,
      source: source.sourceName,
      url: source.url,
      category: 'research',
      type: 'article',
      ai_generated: true,
      research_mode: 'rss',
      model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
      plain_language_summary: article.plain_language_summary,
      caveats: article.caveats,
      status: 'published',
      featured: false,
      submitted_by: 'system',
      pub_date: source.pubDate ?? null,
      created_at: FieldValue.serverTimestamp(),
      published_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    })
    generated.push({ title: article.title, url: source.url, id: slug })
  }

  return { ok: true, mode: 'rss', dryRun, fetched: items.length, generated, skipped }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const url = new URL(request.url)
  const mode = (url.searchParams.get('mode') || 'deep').toLowerCase()
  const max = Math.min(10, Math.max(1, Number(url.searchParams.get('max') || '2')))

  const result = mode === 'rss' ? await runRssPipeline(false, max) : await runDeepPipeline(false, max)
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const url = new URL(request.url)
  const mode = (url.searchParams.get('mode') || 'deep').toLowerCase()
  const max = Math.min(3, Math.max(1, Number(url.searchParams.get('max') || '1')))
  const result = mode === 'rss' ? await runRssPipeline(true, max) : await runDeepPipeline(true, max)
  return NextResponse.json(result)
}
