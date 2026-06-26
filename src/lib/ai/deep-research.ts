// Cheap deep-research pipeline modeled after MessageCFO's but trimmed to 2 LLM
// calls per article (plan + synthesize) with no iterative refinement loop.
//
//   1. Plan: one GPT call to an array of 2 focused web queries
//   2. Search: DuckDuckGo, top 3 urls per query
//   3. Scrape: markdown.new fallback to raw HTML per url, dedup, max 5 total
//   4. Synthesize: one GPT call to a structured health article with citations
//
// Total LLM: 2 calls, budget ~3k tokens total. Keeps cost roughly 3-4x cheaper
// than the MessageCFO equivalent which runs 5+ calls per article.

import OpenAI from 'openai'
import { fetchPage, searchWeb, type WebPage } from './web-research'
import { searchLiterature } from './literature'

type ResearchSource = { title: string; url: string; domain: string; excerpt: string; kind: string }

function sourceLabel(kind: string): string {
  if (kind === 'journal') return 'PEER-REVIEWED'
  if (kind === 'preprint') return 'PREPRINT (not yet peer-reviewed)'
  if (kind === 'trial') return 'CLINICAL TRIAL'
  return 'WEB'
}

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
    kind?: string
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

const SYNTHESIZE_SYSTEM = `You are a health journalist writing for the KinSpace community: people living with chronic conditions, mental-health challenges, disability, and trauma recovery.

Your job: turn web research into a warm, plain-language KinSpace article.

Rules:
1. Never give medical advice. Present findings, do not prescribe.
2. Disabled readers are a core audience. Treat disability, access, energy limits, pain, mobility, sensory load, and cognitive load as part of the main story when relevant.
3. Use 6th-grade reading level for the plain_language_summary. The body can be 8th to 10th grade.
4. Always flag uncertainty: sample sizes, study type, preliminary vs replicated.
5. Every claim that comes from a source must include a citation marker like [1], [2].
6. Body must include markdown sections: "## Summary", "## What the research shows", "## What this might mean for you", "## Access and daily life", "## Caveats".
7. In "Access and daily life", cover energy limits, pain, mobility, sensory load, cognitive load, transport, cost, work, school, caregiving, and care access when sources support it. If the sources do not address those questions, say that gap plainly.
8. Never invent facts that are not in the provided sources. If sources are weak, say so. Sources are tagged PEER-REVIEWED / PREPRINT / CLINICAL TRIAL / WEB. Weight peer-reviewed and clinical-trial sources highest, and explicitly note when something rests on a preprint, not yet peer-reviewed, or a single small study.
9. Tags: 3 to 6 lowercase short phrases for search, like "depression", "sleep", "vagus-nerve", and "rct".
10. topic: one short label like "Depression Research" or "Long COVID".
11. Do not use em dashes.
12. Return STRICT JSON only. Do not include prose outside JSON.`

/**
 * Self-directed topic discovery: searches the web for current notable health
 * breakthroughs / approvals / major trial results, then has the model curate the
 * most genuinely-significant, distinct ones worth a plain-language article. Each
 * returned topic is then run through the full deep-research pipeline (which cites
 * Europe PMC + clinical trials + web), so articles ship with real sources.
 */
export async function discoverBreakthroughTopics(count = 2): Promise<string[]> {
  try {
    const queries = [
      'major medical breakthrough new treatment recent',
      'new drug approval or prevention breakthrough health news',
    ]
    const results = (await Promise.all(queries.map((query) => searchWeb(query, 6)))).flat()
    if (results.length === 0) return []
    const context = results
      .slice(0, 16)
      .map((result, index) => `${index + 1}. ${result.title}: ${result.snippet}`)
      .join('\n')

    const openai = getClient()
    const completion = await openai.chat.completions.create({
      model: modelFor('mini'),
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You spot genuinely notable, recent health/medical breakthroughs worth a plain-language article for a chronic-illness and mental-health community. Avoid hype, ads, supplements, and listicles. Prefer concrete advances: new treatments, regulatory approvals, major trial results, prevention milestones.',
        },
        {
          role: 'user',
          content: `From these search results, pick the ${count} most notable, distinct, real breakthroughs. Return STRICT JSON {"topics": string[]} where each topic is a specific, searchable phrase (e.g. "twice-yearly lenacapavir injection for HIV prevention", "donanemab trial results for early Alzheimer's").\n\n${context}`,
        },
      ],
      temperature: 0.4,
      max_completion_tokens: 300,
    })
    const text = completion.choices[0]?.message?.content?.trim()
    if (!text) return []
    const parsed = JSON.parse(text) as { topics?: unknown }
    const topics = Array.isArray(parsed.topics) ? parsed.topics.map((t) => String(t).trim()).filter(Boolean) : []
    return topics.slice(0, count)
  } catch {
    return []
  }
}

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

function formatSourcesForPrompt(sources: ResearchSource[]): string {
  return sources
    .map((source, index) => {
      const body = source.excerpt.slice(0, 2500)
      return `[${index + 1}] (${sourceLabel(source.kind)}) ${source.title}: ${source.domain}\nURL: ${source.url}\n---\n${body}\n`
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
  sources: ResearchSource[],
): Promise<ResearchArticle | null> {
  if (sources.length === 0) return null
  const openai = getClient()

  const userPrompt = `Research topic: ${topic}
Angle: ${plan.angle}

Sources:
${formatSourcesForPrompt(sources)}

Respond with STRICT JSON only, matching:
{
  "title": string,
  "excerpt": string,                 // one sentence, <= 180 chars
  "body_markdown": string,            // 500-750 words, required sections, with [1]/[2] citations
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

    const citedSources = sources.map((source, index) => ({
      index: index + 1,
      title: source.title,
      url: source.url,
      domain: source.domain,
      kind: source.kind,
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
      sources: citedSources,
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

  // Authoritative literature (Europe PMC + ClinicalTrials.gov) + general web,
  // gathered in parallel. Literature is listed first so it is cited first.
  const [pages, literature] = await Promise.all([
    gatherSources(plan),
    searchLiterature(topic, { journals: 4, trials: 2 }),
  ])

  const sources: ResearchSource[] = [
    ...literature.map((item) => ({
      title: item.title,
      url: item.url,
      domain: item.domain,
      excerpt: item.snippet,
      kind: item.kind,
    })),
    ...pages.map((page) => ({
      title: page.title,
      url: page.url,
      domain: page.domain,
      excerpt: page.excerpt,
      kind: 'web',
    })),
  ]
  if (sources.length === 0) return { topic, plan, pages, article: null }

  const article = await synthesizeArticle(topic, plan, sources)
  return { topic, plan, pages, article }
}
