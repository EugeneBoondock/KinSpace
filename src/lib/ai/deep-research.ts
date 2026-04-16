// Cheap deep-research pipeline modeled after MessageCFO's but trimmed to 2 LLM
// calls per article (plan + synthesize) with no iterative refinement loop.
//
//   1. Plan — one GPT call → array of 2 focused web queries
//   2. Search — DuckDuckGo, top 3 urls per query
//   3. Scrape — markdown.new (fallback to raw HTML) per url, dedup, max 5 total
//   4. Synthesize — one GPT call → structured health article with citations
//
// Total LLM: 2 calls, budget ~3k tokens total. Keeps cost roughly 3-4x cheaper
// than the MessageCFO equivalent which runs 5+ calls per article.

import OpenAI from 'openai'
import { fetchPage, searchWeb, type WebPage } from './web-research'

export type ResearchPlan = {
  queries: string[]
  angle: string
}

export type ResearchArticle = {
  title: string
  slug: string
  excerpt: string
  topic: string
  body_markdown: string
  key_findings: string[]
  plain_language_summary: string
  caveats: string[]
  tags: string[]
  sources: Array<{
    index: number
    title: string
    url: string
    domain: string
  }>
}

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (client) return client
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
  client = new OpenAI({ apiKey })
  return client
}

function modelFor(mode: 'mini' | 'full'): string {
  if (mode === 'full') return process.env.OPENAI_MODEL_FULL || 'gpt-5.4'
  return process.env.OPENAI_MODEL || 'gpt-5.4-mini'
}

const PLAN_SYSTEM = `You are a research planner for KinSpace, a chronic-illness and mental-health community platform.

Given a health research topic, return 2 focused web search queries (no more) that will surface the most informative recent sources. Prefer queries that pull primary research, guidelines from NIH/WHO/CDC, or clinical reviews.

Respond with strict JSON in this shape:
{
  "angle": "one short sentence describing the angle of the piece",
  "queries": ["query 1", "query 2"]
}`

const SYNTHESIZE_SYSTEM = `You are a health journalist writing for the KinSpace community — people living with chronic conditions, mental-health challenges, and trauma recovery.

Your job: turn web research into a warm, plain-language KinSpace article.

Rules:
1. Never give medical advice. Present findings, do not prescribe.
2. Use 6th-grade reading level for the plain_language_summary. The body can be 8th–10th grade.
3. Always flag uncertainty: sample sizes, study type, preliminary vs replicated.
4. Respectful of the lived experience of the condition.
5. Every claim that comes from a source must include a citation marker like [1], [2].
6. Body must include markdown sections: "## Summary", "## What the research shows", "## What this might mean for you", "## Caveats".
7. Never invent facts that are not in the provided sources. If sources are weak, say so.
8. Tags: 3–6 lowercase short phrases for search (e.g. "depression", "sleep", "vagus-nerve", "rct").
9. topic: one short label like "Depression Research" or "Long COVID".
10. Return STRICT JSON only — no prose outside JSON.`

export async function planResearch(topic: string): Promise<ResearchPlan | null> {
  const openai = getClient()
  try {
    const completion = await openai.chat.completions.create({
      model: modelFor('mini'),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PLAN_SYSTEM },
        { role: 'user', content: `Topic: ${topic}\n\nReturn JSON per the schema.` },
      ],
      temperature: 0.3,
      max_completion_tokens: 500,
    })
    const text = completion.choices[0]?.message?.content?.trim()
    if (!text) return null
    const parsed = JSON.parse(text) as Partial<ResearchPlan>
    if (!Array.isArray(parsed.queries) || parsed.queries.length === 0) return null
    return {
      angle: parsed.angle?.trim() || topic,
      queries: parsed.queries.slice(0, 2).map((query) => String(query).trim()).filter(Boolean),
    }
  } catch (error) {
    console.error('Research plan failed:', error)
    return null
  }
}

export async function gatherSources(plan: ResearchPlan): Promise<WebPage[]> {
  const urlsSeen = new Set<string>()
  const pages: WebPage[] = []

  for (const query of plan.queries) {
    const results = await searchWeb(query, 3)
    for (const result of results) {
      if (urlsSeen.has(result.url)) continue
      urlsSeen.add(result.url)
      const page = await fetchPage(result.url)
      if (page) {
        pages.push(page)
        if (pages.length >= 5) return pages // hard cap to keep token usage small
      }
    }
  }
  return pages
}

function formatSourcesForPrompt(pages: WebPage[]): string {
  return pages
    .map((page, index) => {
      const body = page.excerpt.slice(0, 2500)
      return `[${index + 1}] ${page.title} — ${page.domain}\nURL: ${page.url}\n---\n${body}\n`
    })
    .join('\n\n')
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export async function synthesizeArticle(
  topic: string,
  plan: ResearchPlan,
  pages: WebPage[],
): Promise<ResearchArticle | null> {
  if (pages.length === 0) return null
  const openai = getClient()

  const userPrompt = `Research topic: ${topic}
Angle: ${plan.angle}

Sources:
${formatSourcesForPrompt(pages)}

Respond with STRICT JSON only, matching:
{
  "title": string,
  "excerpt": string,                 // one sentence, <= 180 chars
  "body_markdown": string,            // 450-650 words, with [1]/[2] citations
  "key_findings": string[],           // 3-5 bullets
  "plain_language_summary": string,   // 2-3 sentences, 6th-grade
  "caveats": string[],                // 1-3 items
  "tags": string[],                   // 3-6 short tags
  "topic": string                     // short topic label
}`

  try {
    const completion = await openai.chat.completions.create({
      model: modelFor('mini'),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYNTHESIZE_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.35,
      max_completion_tokens: 2200,
    })

    const text = completion.choices[0]?.message?.content?.trim()
    if (!text) return null
    const parsed = JSON.parse(text) as Partial<ResearchArticle>
    if (!parsed.title || !parsed.body_markdown) return null

    const sources = pages.map((page, index) => ({
      index: index + 1,
      title: page.title,
      url: page.url,
      domain: page.domain,
    }))

    return {
      title: parsed.title.trim(),
      slug: slugify(parsed.title),
      excerpt: (parsed.excerpt ?? '').trim().slice(0, 200),
      topic: (parsed.topic ?? topic).trim(),
      body_markdown: parsed.body_markdown.trim(),
      key_findings: Array.isArray(parsed.key_findings) ? parsed.key_findings.slice(0, 5) : [],
      plain_language_summary: (parsed.plain_language_summary ?? '').trim(),
      caveats: Array.isArray(parsed.caveats) ? parsed.caveats.slice(0, 3) : [],
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.map((tag) => String(tag).toLowerCase().trim()).slice(0, 6)
        : [],
      sources,
    }
  } catch (error) {
    console.error('Research synthesis failed:', error)
    return null
  }
}

export type DeepResearchRun = {
  topic: string
  plan: ResearchPlan | null
  pages: WebPage[]
  article: ResearchArticle | null
}

export async function runDeepResearch(topic: string): Promise<DeepResearchRun> {
  const plan = await planResearch(topic)
  if (!plan) return { topic, plan: null, pages: [], article: null }

  const pages = await gatherSources(plan)
  if (pages.length === 0) return { topic, plan, pages, article: null }

  const article = await synthesizeArticle(topic, plan, pages)
  return { topic, plan, pages, article }
}
