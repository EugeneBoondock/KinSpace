import OpenAI from 'openai'

export type SummaryInput = {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  personaName?: string | null
  moodAtStart?: string | null
}

export type SessionSummary = {
  summary: string
  mood_at_end: string | null
  key_themes: string[]
}

let client: OpenAI | null = null
function getClient(): OpenAI {
  if (client) return client
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
  client = new OpenAI({ apiKey })
  return client
}

const SYSTEM_PROMPT = `You are summarising a therapy-style peer-support session so that the next session's Guide can remember what matters, without re-traumatising the user by making them retell.

Write in the third person, about the user. Be factual and warm. 3-5 sentences max.

Return STRICT JSON matching:
{
  "summary": string,              // 3-5 sentences, third-person, no diagnosis
  "mood_at_end": string | null,   // one word if clear from the closing turns, else null
  "key_themes": string[]          // 2-5 short phrases (e.g. "sleep trouble", "conflict with partner", "grief anniversary")
}

Never speculate. Never include medical advice or diagnoses. Never name other people the user mentioned. If there was a crisis moment, note it only as "user expressed crisis signals" without detail.`

export async function summariseSession(input: SummaryInput): Promise<SessionSummary | null> {
  if (input.messages.length < 3) return null // not enough to summarise meaningfully
  const openai = getClient()
  const model = process.env.OPENAI_MODEL || 'gpt-5.4-mini'

  const transcript = input.messages
    .map((message) => `${message.role === 'user' ? 'User' : input.personaName ?? 'Guide'}: ${message.content}`)
    .join('\n')
    .slice(0, 8000) // keep the prompt bounded

  const context = [
    input.moodAtStart ? `Mood at start: ${input.moodAtStart}` : '',
    `Transcript (most recent session):`,
    transcript,
    `\nReturn STRICT JSON only.`,
  ]
    .filter(Boolean)
    .join('\n\n')

  try {
    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: context },
      ],
      temperature: 0.2,
      max_completion_tokens: 400,
    })

    const text = completion.choices[0]?.message?.content?.trim()
    if (!text) return null
    const parsed = JSON.parse(text) as Partial<SessionSummary>
    if (!parsed.summary) return null
    return {
      summary: parsed.summary.trim(),
      mood_at_end: (parsed.mood_at_end ?? null) as string | null,
      key_themes: Array.isArray(parsed.key_themes) ? parsed.key_themes.slice(0, 5) : [],
    }
  } catch (error) {
    console.error('Session summarisation failed:', error)
    return null
  }
}
