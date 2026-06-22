// AI-assisted "Ask" feature: user describes a symptom or question,
// we search Reddit + the wider web via DuckDuckGo, pair that with any
// previously-asked KinSpace questions, and feed the whole context into
// gpt-5.4-mini for a warm, grounded, NEVER-DIAGNOSING answer.
//
// Cost shape per ask: 1 plan-free LLM call, ~4-6 page fetches, no sync.

import OpenAI from 'openai'
import { fetchPage, searchWeb, type WebPage } from './web-research'
import { searchLiterature } from './literature'

type PromptSource = { title: string; domain: string; url: string; excerpt: string; kind: string }

export type RedditHit = {
  title: string
  url: string
  subreddit: string
  snippet: string
}

export type AskAnswer = {
  answer_markdown: string
  plain_language_summary: string
  red_flags: string[]
  self_care_suggestions: string[]
  when_to_see_a_professional: string[]
  tags: string[]
  sources: Array<{ index: number; title: string; url: string; domain: string; kind?: string }>
  reddit_threads: RedditHit[]
}

export type AskContext = {
  /** The user's self-reported profile, if they are signed in. May be empty. */
  /** Past questions on KinSpace that look similar — used for "others asked" UI. */
  relatedQuestions: Array<{ id: string; question: string; created_at?: unknown }>
  structuredSources?: Array<{ label: string; source: string; summary: string; confidence?: string }>
}

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (client) return client
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
  client = new OpenAI({ apiKey })
  return client
}

function subredditFromUrl(url: string): string {
  const match = url.match(/reddit\.com\/r\/([^/?#]+)/i)
  return match ? match[1] : 'reddit'
}

export async function searchReddit(question: string, max = 4): Promise<RedditHit[]> {
  const query = `${question} site:reddit.com`
  const results = await searchWeb(query, max + 4)
  return results
    .filter((result) => result.url.includes('reddit.com'))
    .slice(0, max)
    .map((result) => ({
      title: result.title,
      url: result.url,
      subreddit: subredditFromUrl(result.url),
      snippet: result.snippet,
    }))
}

export function isUsableAskSource(page: Pick<WebPage, 'title' | 'snippet' | 'excerpt'>): boolean {
  const text = `${page.title} ${page.snippet} ${page.excerpt}`.toLowerCase()
  const blockedPatterns = [
    /sorry,?\s+you have been blocked/,
    /access denied/,
    /request blocked/,
    /verify (that )?you are human/,
    /checking if the site connection is secure/,
    /captcha/,
    /enable javascript/,
    /bot detection/,
    /\bforbidden\b/,
  ]
  return !blockedPatterns.some((pattern) => pattern.test(text))
}

async function gatherWebSources(question: string, max = 4): Promise<WebPage[]> {
  const results = await searchWeb(question, max + 4)
  const pages: WebPage[] = []
  const seen = new Set<string>()
  for (const result of results) {
    if (result.url.includes('reddit.com')) continue // reddit handled separately
    if (seen.has(result.url)) continue
    seen.add(result.url)
    const page = await fetchPage(result.url)
    if (page && isUsableAskSource(page)) {
      pages.push(page)
      if (pages.length >= max) break
    }
  }
  return pages
}

const SYSTEM_PROMPT = `You are KinSpace Ask — a warm, careful health companion that helps people make sense of symptoms and health questions WITHOUT replacing a clinician.

Your job: take the member's question, the details they typed, public KinSpace questions that look similar, labeled KinSpace structured data we pass in, and the web sources we collected, then respond with a steady, plain-language answer.

Absolute rules:
- Never diagnose. Never prescribe.
- Always name uncertainty. Real symptoms have many possible causes.
- Always include red-flag warnings that mean "seek urgent care".
- Treat every source as provisional. Each source is tagged PEER-REVIEWED, PREPRINT, CLINICAL TRIAL, or WEB. Weight PEER-REVIEWED and CLINICAL TRIAL sources highest; prefer clinical sites (Mayo Clinic, NHS, NIH, CDC, Cleveland Clinic, WHO) over random blogs; and NEVER present a PREPRINT as established fact (note it is not yet peer-reviewed).
- Use only the question text, details the member typed, public related questions, labeled KinSpace structured data listed in this request, and numbered sources. Never use, infer, or reveal data that is not listed.
- Treat KinSpace structured data as self-reported member data, not clinical proof.
- If this looks like a medical emergency (chest pain + breathlessness, suicidal ideation, severe bleeding, stroke signs, anaphylaxis, etc.), say so first — "This sounds like something to get checked right now" — and give the best next step.
- Cite sources with [1], [2] etc. matching the numbered sources we pass you.
- Tone: warmth without cheerfulness. Honest. Brief.

Return STRICT JSON matching:
{
  "answer_markdown": string,               // 300-500 words, markdown, with [1][2] citations
  "plain_language_summary": string,         // 1-3 sentences, 6th-grade reading level
  "red_flags": string[],                    // 1-4 warning signs that mean "seek urgent care"
  "self_care_suggestions": string[],         // 0-4 reasonable at-home steps
  "when_to_see_a_professional": string[],    // 1-3 scenarios
  "tags": string[]                          // 3-6 short lowercase tags for search (e.g. "swollen-elbow", "joint-pain")
}`

function sourceLabel(kind: string): string {
  if (kind === 'journal') return 'PEER-REVIEWED'
  if (kind === 'preprint') return 'PREPRINT (not yet peer-reviewed)'
  if (kind === 'trial') return 'CLINICAL TRIAL'
  return 'WEB'
}

function formatSourcesForPrompt(sources: PromptSource[]): string {
  return sources
    .map((source, index) => {
      const body = source.excerpt.slice(0, 2000)
      return `[${index + 1}] (${sourceLabel(source.kind)}) ${source.title} — ${source.domain}\nURL: ${source.url}\n---\n${body}\n`
    })
    .join('\n\n')
}

function formatRedditForPrompt(hits: RedditHit[]): string {
  if (hits.length === 0) return '(no Reddit discussion found)'
  return hits
    .map((hit, index) => `[r${index + 1}] r/${hit.subreddit} — ${hit.title}\n${hit.snippet}`)
    .join('\n\n')
}

export function formatAskContextForPrompt(context: AskContext): string {
  const parts: string[] = []
  if (context.structuredSources && context.structuredSources.length > 0) {
    const structured = context.structuredSources
      .slice(0, 8)
      .map((source) => {
        const confidence = source.confidence ? ` Confidence: ${source.confidence}.` : ''
        return `- ${source.label} (${source.source}): ${source.summary}${confidence}`
      })
      .join('\n')
    parts.push(`KinSpace structured data for this signed-in member:\n${structured}`)
  }
  if (context.relatedQuestions.length > 0) {
    const preview = context.relatedQuestions
      .slice(0, 4)
      .map((item) => `- "${item.question}"`)
      .join('\n')
    parts.push(`KinSpace members previously asked:\n${preview}`)
  }
  return parts.length > 0 ? parts.join('\n') : '(no related KinSpace questions found)'
}

export async function answerAsk(
  question: string,
  context: AskContext,
): Promise<AskAnswer | null> {
  const [redditHits, webPages, literature] = await Promise.all([
    searchReddit(question, 4),
    gatherWebSources(question, 4),
    searchLiterature(question, { journals: 3, trials: 2 }),
  ])

  // Authoritative literature first, then general web — numbered together so the
  // model cites [1]..[n] across all of them, weighting peer-reviewed highest.
  const unifiedSources: PromptSource[] = [
    ...literature.map((item) => ({
      title: item.title,
      domain: item.domain,
      url: item.url,
      excerpt: item.snippet,
      kind: item.kind,
    })),
    ...webPages.map((page) => ({
      title: page.title,
      domain: page.domain,
      url: page.url,
      excerpt: page.excerpt,
      kind: 'web',
    })),
  ]

  const model = process.env.OPENAI_MODEL || 'gpt-5.4-mini'
  const openai = getClient()

  const userPrompt = `User's question: ${question}

Context about the user:
${formatAskContextForPrompt(context)}

Clinical / web sources we retrieved:
${formatSourcesForPrompt(unifiedSources)}

Reddit discussions we found:
${formatRedditForPrompt(redditHits)}

Respond with strict JSON only.`

  try {
    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.35,
      max_completion_tokens: 1600,
    })

    const text = completion.choices[0]?.message?.content?.trim()
    if (!text) return null
    const parsed = JSON.parse(text) as Partial<AskAnswer>
    if (!parsed.answer_markdown) return null

    return {
      answer_markdown: parsed.answer_markdown.trim(),
      plain_language_summary: (parsed.plain_language_summary ?? '').trim(),
      red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags.slice(0, 4) : [],
      self_care_suggestions: Array.isArray(parsed.self_care_suggestions)
        ? parsed.self_care_suggestions.slice(0, 4)
        : [],
      when_to_see_a_professional: Array.isArray(parsed.when_to_see_a_professional)
        ? parsed.when_to_see_a_professional.slice(0, 3)
        : [],
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.map((tag) => String(tag).toLowerCase().trim()).slice(0, 6)
        : [],
      sources: unifiedSources.map((source, index) => ({
        index: index + 1,
        title: source.title,
        url: source.url,
        domain: source.domain,
        kind: source.kind,
      })),
      reddit_threads: redditHits,
    }
  } catch (error) {
    console.error('Ask answer failed:', error)
    return null
  }
}
