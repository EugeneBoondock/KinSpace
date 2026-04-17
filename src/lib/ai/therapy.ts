import OpenAI from 'openai'
import { getPersona } from '../therapy-config'

export type TherapyMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type PriorSessionSummary = {
  summary: string
  key_themes: string[]
  mood_at_start?: string | null
  mood_at_end?: string | null
  started_at?: string | null // ISO date for the model's sense of time
}

export type TherapyContext = {
  /** Stable at-a-glance info about the user — built once and cached. */
  userId: string
  displayName: string
  pronouns?: string | null
  age?: number | null
  location?: string | null
  conditions: string[]
  medications: string[]
  comorbidities: string[]
  goals: string[]
  interests: string[]
  preferredCommunication?: string | null
  conditionInsights: Array<{
    condition: string
    topTreatments: Array<{ name: string; effectiveness: number; count: number }>
  }>
  currentMood?: string | null
  currentMoodAt?: Date | null
  recentMoods?: Array<{ day: string; mood: string }>
  moodPatternHint?: string | null
  /** Summaries from the last few sessions so the Guide remembers. */
  priorSessions?: PriorSessionSummary[]
  /** Selected therapist persona id. */
  personaId?: string | null
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
  const persona = getPersona(context.personaId ?? null)
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

  const priorSessions =
    context.priorSessions && context.priorSessions.length > 0
      ? context.priorSessions
          .map((session, index) => {
            const when = session.started_at ? ` (${session.started_at.slice(0, 10)})` : ''
            const themes = session.key_themes.length > 0 ? ` — themes: ${session.key_themes.join(', ')}` : ''
            const moodLine = session.mood_at_start
              ? ` — arrived "${session.mood_at_start}"${session.mood_at_end ? `, left "${session.mood_at_end}"` : ''}`
              : ''
            return `${index + 1}.${when}${themes}${moodLine}\n   ${session.summary}`
          })
          .join('\n\n')
      : '(no prior sessions yet — this is our first real conversation)'

  return `You are KinSpace Guide — a warm peer-support companion for someone living with chronic health or mental-health challenges.

## Your voice
${persona.voicePrompt}

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

## What you remember from prior sessions
${priorSessions}

Use these prior notes naturally — reference them only when relevant ("last time you mentioned sleep was hard — how's that going?"). Never dump them at the user. If a theme has kept coming up across sessions, it's fair to gently name it.

## How you write
- Talk to them by name occasionally, naturally, not every message.
- Mirror what they said before offering anything new. One paragraph per reply is usually enough.
- Reference their specific conditions or community insights only when genuinely relevant.
- If they describe something that might be serious (suicidal thoughts, psychosis, medical emergency), gently say so and point to emergency services and crisis lines. Do not try to be their only safety net.
- Avoid toxic positivity. Don't say "stay strong" or "everything happens for a reason."
- Offer at most one practical micro-step per reply, and only when it feels welcome.
- Never invent facts about their record. If something isn't in the profile above, ask before assuming.
- Never prescribe, adjust doses, or tell them to start/stop a medication. Redirect those questions to their care team.
- Keep replies under ~180 words unless they explicitly ask for more.

## Honest guardrails
- "This is peer support, not medical or therapeutic advice."
- You can suggest journaling, breathing, sleep, movement, social contact, professional support, and KinSpace features (conditions insights, strands, groups) — but only when contextually useful.`
}

export async function therapyChat(
  context: TherapyContext,
  history: TherapyMessage[],
): Promise<{ reply: string; isCrisis: boolean }> {
  const openai = getClient()
  const model = process.env.OPENAI_MODEL_FULL || 'gpt-5.4'

  const recent = history.slice(-20)

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: buildSystemPrompt(context) },
      ...recent.map((turn) => ({ role: turn.role, content: turn.content })),
    ],
    temperature: 0.75,
    max_completion_tokens: 600,
  })

  const reply = completion.choices[0]?.message?.content?.trim() ?? ''

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
