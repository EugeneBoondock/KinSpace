import OpenAI from 'openai'

export type TherapyMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type TherapyContext = {
  /** Stable at-a-glance info about the user — built once and cached. */
  userId: string
  displayName: string
  pronouns?: string | null
  age?: number | null
  location?: string | null
  /** Self-reported. May be encrypted on the wire; server has already decrypted. */
  conditions: string[]
  medications: string[]
  comorbidities: string[]
  goals: string[]
  interests: string[]
  preferredCommunication?: string | null
  /** Crowd-sourced top treatments for each of the user's conditions (STW-style). */
  conditionInsights: Array<{
    condition: string
    topTreatments: Array<{ name: string; effectiveness: number; count: number }>
  }>
  /** Most recent mood tag the user set on the dashboard, if any. */
  currentMood?: string | null
  currentMoodAt?: Date | null
  /** Daily mood log entries for the last ~14 days, oldest → newest. */
  recentMoods?: Array<{ day: string; mood: string }>
  /** System-generated note about any pattern (streak, heavy run, bright patch). */
  moodPatternHint?: string | null
}

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (client) return client
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
  client = new OpenAI({ apiKey })
  return client
}

function buildSystemPrompt(context: TherapyContext): string {
  const conditions = context.conditions.length > 0 ? context.conditions.join(', ') : 'none shared'
  const meds = context.medications.length > 0 ? context.medications.join(', ') : 'none shared'
  const comorbid =
    context.comorbidities.length > 0 ? context.comorbidities.join(', ') : 'none shared'
  const goals = context.goals.length > 0 ? context.goals.join('; ') : 'none shared'
  const interests = context.interests.length > 0 ? context.interests.join(', ') : 'none shared'
  const pronouns = context.pronouns ? `Pronouns: ${context.pronouns}.` : ''
  const age = context.age ? `Age: ${context.age}.` : ''
  const location = context.location ? `Location: ${context.location}.` : ''
  const mood = context.currentMood
    ? `Today the user flagged their mood as "${context.currentMood}".`
    : ''
  const commsPref = context.preferredCommunication
    ? `Preferred communication style: ${context.preferredCommunication}.`
    : ''

  const recentMoodLine =
    context.recentMoods && context.recentMoods.length > 0
      ? `Mood log (last ${context.recentMoods.length} days, oldest → newest): ${context.recentMoods
          .map((entry) => `${entry.day.slice(5)}=${entry.mood}`)
          .join(' ')}.`
      : ''

  const patternLine = context.moodPatternHint
    ? `Pattern note the system detected: ${context.moodPatternHint}`
    : ''

  const insights = context.conditionInsights
    .filter((entry) => entry.topTreatments.length > 0)
    .map(
      (entry) =>
        `- ${entry.condition}: ${entry.topTreatments
          .map((treatment) => `${treatment.name} (${treatment.effectiveness.toFixed(1)}/5 from ${treatment.count})`)
          .join(', ')}`,
    )
    .join('\n')

  return `You are KinSpace Guide, a warm peer-support companion for someone living with chronic health or mental-health challenges.

You are NOT a therapist or doctor. You do not diagnose, prescribe, or replace clinical care. You DO listen, reflect, validate, and offer grounded, practical next steps the user has consented to discuss.

## Who you are talking to
Name: ${context.displayName}
${pronouns} ${age} ${location}
${commsPref}
${mood}
${recentMoodLine}
${patternLine}

Self-reported conditions: ${conditions}
Current medications they mentioned: ${meds}
Other conditions they listed: ${comorbid}
Mental-health goals they shared: ${goals}
Interests that brighten them: ${interests}

## What the KinSpace community reports works for their conditions
${insights || '(No community-sourced treatment data yet for their specific conditions.)'}

## How you write
- Talk to them by name occasionally, naturally, not every message.
- Mirror what they said before offering anything new. One paragraph per reply is usually enough.
- Reference their specific conditions or the community-sourced insights when it is genuinely relevant — never as a sales pitch.
- If they describe something that might be serious (suicidal thoughts, psychosis, medical emergency), gently say so and point to emergency services and crisis lines. Do not try to be their only safety net.
- Avoid toxic positivity. Don't say "stay strong" or "everything happens for a reason."
- Offer at most one practical micro-step per reply, and only when it feels welcome.
- Never invent facts about their record. If something isn't in the profile above, ask before assuming.
- Never prescribe, adjust doses, or tell them to start/stop a medication. Redirect those questions to their care team.
- Keep replies under ~180 words unless they explicitly ask for more.

## Honest guardrails
- "This is peer support, not medical or therapeutic advice."
- You can suggest journaling, breathing, sleep, movement, social contact, professional support, and the KinSpace community features (conditions insights page, strands, groups) — but only when contextually useful.
- If the user asks what other people with their condition found helpful, you can paraphrase the community data above (with the effectiveness average and the count of reports), and remind them it's crowdsourced, not clinical evidence.`
}

export async function therapyChat(
  context: TherapyContext,
  history: TherapyMessage[],
): Promise<{ reply: string; isCrisis: boolean }> {
  const openai = getClient()
  const model = process.env.OPENAI_MODEL_FULL || 'gpt-5.4'

  // Keep context window small — the last ~20 turns is plenty.
  const recent = history.slice(-20)

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: buildSystemPrompt(context) },
      ...recent.map((turn) => ({ role: turn.role, content: turn.content })),
    ],
    temperature: 0.7,
    max_completion_tokens: 600,
  })

  const reply = completion.choices[0]?.message?.content?.trim() ?? ''

  // Very rough crisis detector — we run it on the user's LAST message so we can
  // decide to attach a resources banner on top of the LLM reply.
  const lastUserMessage = [...history].reverse().find((turn) => turn.role === 'user')?.content ?? ''
  const isCrisis = detectCrisis(lastUserMessage)

  return { reply, isCrisis }
}

function detectCrisis(text: string): boolean {
  const needle = text.toLowerCase()
  const triggers = [
    'kill myself',
    'suicide',
    'suicidal',
    'end it all',
    'end my life',
    'want to die',
    'not worth living',
    'hurt myself',
    'self harm',
    'self-harm',
    'overdose',
  ]
  return triggers.some((phrase) => needle.includes(phrase))
}
