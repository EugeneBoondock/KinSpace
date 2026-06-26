import OpenAI from 'openai'

export type ResearchSource = {
  title: string
  excerpt: string
  url: string
  pubDate?: string
  sourceName: string
  rawContent?: string
}

export type GeneratedArticle = {
  title: string
  excerpt: string
  body_markdown: string
  key_findings: string[]
  tags: string[]
  topic: string
  plain_language_summary: string
  caveats: string[]
}

const SYSTEM_PROMPT = `You are a health journalist writing for the KinSpace community: people living with chronic conditions, mental-health challenges, disability, and trauma recovery. Your job is to translate new health research into warm, plain-language articles.

Rules:
1. Disabled readers are a core audience. Treat disability, access, energy limits, pain, mobility, sensory load, and cognitive load as part of the main story when relevant.
2. Never give medical advice. Present findings, do not prescribe.
3. Aim for a 6th-grade reading level for the plain_language_summary. The body_markdown can be a bit more detailed, around 8th to 10th grade.
4. Always flag uncertainty: sample sizes, study type, preliminary vs replicated.
5. Never invent findings or statistics that are not in the source material. If the source is sparse, say so.
6. Use Markdown for body_markdown. Include sections named "## Summary", "## What the research shows", "## What this might mean for you", "## Access and daily life", and "## Caveats".
7. In "Access and daily life", cover energy limits, pain, mobility, sensory load, cognitive load, transport, cost, work, school, caregiving, and care access when source material supports it. If the source does not address those questions, say that gap plainly.
8. Tags should be lowercase single words or short phrases relevant to searching (e.g., "depression", "sleep", "chronic-pain", "rct", "mental-health").
9. topic should be one short phrase like "Depression Research" or "Long COVID".
10. key_findings are 2-5 bullet points, each a single sentence.
11. caveats should call out limits of the study, or remind readers to talk with their care team before changing care.
12. Do not use em dashes.
13. Return STRICT JSON matching the schema only. Do not include prose outside JSON.`

const USER_PROMPT_TEMPLATE = (source: ResearchSource) => `Source: ${source.sourceName}
Published: ${source.pubDate ?? 'Recently'}
URL: ${source.url}
Headline: ${source.title}
Summary / excerpt:
${source.excerpt}
${source.rawContent ? `\nFull content excerpt:\n${source.rawContent.slice(0, 4000)}` : ''}

Write a KinSpace article about this. Respond with JSON only, matching this TypeScript type:

{
  "title": string,
  "excerpt": string,              // one sentence, <= 180 chars
  "body_markdown": string,         // 400-650 words, required sections, warm, accessible
  "key_findings": string[],        // 2-5 bullets
  "tags": string[],                // 3-6 short tags
  "topic": string,                 // short topic label
  "plain_language_summary": string, // 2-3 sentences, 6th-grade reading level
  "caveats": string[]              // 1-3 items
}`

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (client) return client
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
  client = new OpenAI({ apiKey })
  return client
}

export async function generateArticle(source: ResearchSource): Promise<GeneratedArticle | null> {
  const model = process.env.OPENAI_MODEL || 'gpt-5.4-mini'
  const openai = getClient()

  try {
    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: USER_PROMPT_TEMPLATE(source) },
      ],
      temperature: 0.4,
      max_tokens: 1200,
    })

    const text = completion.choices[0]?.message?.content?.trim()
    if (!text) return null

    const parsed = JSON.parse(text) as GeneratedArticle
    return {
      title: parsed.title?.trim() || source.title,
      excerpt: parsed.excerpt?.trim() || source.excerpt.slice(0, 180),
      body_markdown: parsed.body_markdown?.trim() || source.excerpt,
      key_findings: Array.isArray(parsed.key_findings) ? parsed.key_findings.slice(0, 5) : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags.map((tag) => tag.toLowerCase()).slice(0, 6) : [],
      topic: parsed.topic?.trim() || 'Health research',
      plain_language_summary: parsed.plain_language_summary?.trim() || parsed.excerpt || '',
      caveats: Array.isArray(parsed.caveats) ? parsed.caveats.slice(0, 3) : [],
    }
  } catch (error) {
    console.error('OpenAI article generation failed:', error)
    return null
  }
}
