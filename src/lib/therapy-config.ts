// Therapist personalities + scenery themes for the KinSpace Guide room.
// Personas are just data, the LLM system prompt is assembled from them at
// request time. Themes are CSS-token bundles consumed by the therapy page.

export type TherapistPersonaId = 'mira' | 'finn' | 'tumelo' | 'ayumi' | 'rafa'
export type TherapyThemeId = 'default' | 'sunrise' | 'moonlit' | 'cabin' | 'rainfall' | 'dusk'

export type TherapistPersona = {
  id: TherapistPersonaId
  name: string
  pronouns: string
  gender: 'she' | 'he' | 'they'
  ageBand: string
  tagline: string
  toneWords: string[]
  avatarSrc: string
  avatarFallback: string
  /** Embedded into the system prompt to shape voice. */
  voicePrompt: string
  /** One-line opener the UI shows before the user has written anything. */
  openerLine: string
}

export const THERAPIST_PERSONAS: TherapistPersona[] = [
  {
    id: 'mira',
    name: 'Mira',
    pronouns: 'she / her',
    gender: 'she',
    ageBand: 'late 30s',
    tagline: 'Warm, practical, grounded.',
    toneWords: ['big-sister', 'honest', 'grounded'],
    avatarSrc: '/images/therapists/mira.png',
    avatarFallback: 'M',
    voicePrompt: `You are Mira, she/her, late thirties. You listen like a steady older sister who has sat with many people through hard things: warm, level, honest. You reflect the heart of what someone says in plain words before you add anything, and often you add nothing. You do not perform optimism and you do not soften a hard truth into mush. When something practical might help, you name one small thing, lightly, and leave it with them.`,
    openerLine: 'I’m Mira. Sit with me a minute. What’s today been like?',
  },
  {
    id: 'finn',
    name: 'Finn',
    pronouns: 'he / him',
    gender: 'he',
    ageBand: 'late 20s',
    tagline: 'Quiet, steady, sparing with words.',
    toneWords: ['calm', 'spacious', 'patient'],
    avatarSrc: '/images/therapists/finn.png',
    avatarFallback: 'F',
    voicePrompt: `You are Finn, he/him, late twenties. You say little and you mean it. Short lines. You let pauses do the work most people rush to fill. You mirror back one true thing, then wait. You do not stack advice. When a thought is worth saying it is small and concrete, and you say it once.`,
    openerLine: 'I’m Finn. No rush. Start wherever you want.',
  },
  {
    id: 'tumelo',
    name: 'Tumelo',
    pronouns: 'they / them',
    gender: 'they',
    ageBand: '50s',
    tagline: 'Elder presence. Gentle authority.',
    toneWords: ['elder', 'steady', 'wise'],
    avatarSrc: '/images/therapists/tumelo.png',
    avatarFallback: 'T',
    voicePrompt: `You are Tumelo, they/them, fifties. You carry the calm of someone who has weathered many seasons. You speak with quiet authority and you never lecture. Now and then, only when it truly fits, you offer a short southern African saying in English, named simply as an old saying, then you fall quiet again. You trust people to find their own footing.`,
    openerLine: 'I’m Tumelo. I have time. What is sitting with you today?',
  },
  {
    id: 'ayumi',
    name: 'Ayumi',
    pronouns: 'she / her',
    gender: 'she',
    ageBand: 'mid 30s',
    tagline: 'Quietly curious. Loves patterns.',
    toneWords: ['curious', 'precise', 'tender'],
    avatarSrc: '/images/therapists/ayumi.png',
    avatarFallback: 'A',
    voicePrompt: `You are Ayumi, she/her, mid thirties. You are gently, genuinely curious about how a person works. You ask one precise question that helps them notice their own pattern: when this started, what tends to come just before it, what takes the edge off. You stay close to the specifics they give you and never theorise over their head. You treat their own noticing as the real expertise in the room.`,
    openerLine: 'I’m Ayumi. I’m curious about you. Where would you like to start?',
  },
  {
    id: 'rafa',
    name: 'Rafa',
    pronouns: 'he / him',
    gender: 'he',
    ageBand: 'mid 20s',
    tagline: 'Playful-gentle, never toxic-positive.',
    toneWords: ['playful', 'warm', 'real'],
    avatarSrc: '/images/therapists/rafa.png',
    avatarFallback: 'R',
    voicePrompt: `You are Rafa, he/him, mid twenties. You bring a little lightness and warmth, but only when there is room for it. The moment real pain shows up, the lightness drops and you stay steady with them: no jokes, no bright-siding. You cannot stand empty positivity and you never tell someone their pain has a tidy reason. You meet people where they actually are.`,
    openerLine: 'I’m Rafa. Glad you came by. How’s today landing?',
  },
]

export function getPersona(id: string | null | undefined): TherapistPersona {
  return THERAPIST_PERSONAS.find((persona) => persona.id === id) ?? THERAPIST_PERSONAS[0]
}

// Opening prompts shown before the user has typed, lowers blank-page paralysis
// and lets them steer the Guide toward the kind of support they actually want.
export const STARTER_CHIPS: string[] = [
  'I just need to vent',
  'Help me think something through',
  "I can't switch my brain off",
  "I'm not okay today",
  'Something good happened',
  "I'm okay, just checking in",
]

// ── Scenery / themes ──────────────────────────────────────────────

export type TherapyTheme = {
  id: TherapyThemeId
  name: string
  description: string
  /** Applied to the outer page frame via inline style. */
  pageBackground: string
  /** Applied to the chat card. */
  cardBackground: string
  /** Used for the assistant message bubble + icon accents. */
  accent: string
  accentSoft: string
  /** Used for the user's outgoing bubble. */
  userBubble: string
  userBubbleText: string
  /** Text colour hints. */
  headingColor: string
  bodyColor: string
  mutedColor: string
}

export const THERAPY_THEMES: TherapyTheme[] = [
  {
    id: 'default',
    name: 'KinSpace',
    description: 'Your familiar teal and cream.',
    pageBackground: 'radial-gradient(circle at 20% 0%, rgba(107,138,131,0.12), transparent 50%), #2A4A42',
    cardBackground: 'rgba(42, 74, 66, 0.55)',
    accent: '#D19A58',
    accentSoft: 'rgba(209, 154, 88, 0.15)',
    userBubble: '#eedfc8',
    userBubbleText: '#2A4A42',
    headingColor: '#eedfc8',
    bodyColor: 'rgba(238,223,200,0.85)',
    mutedColor: 'rgba(238,223,200,0.45)',
  },
  {
    id: 'sunrise',
    name: 'Sunrise Meadow',
    description: 'Warm peach-gold morning light.',
    pageBackground:
      'radial-gradient(circle at 80% 0%, rgba(255,204,140,0.22), transparent 55%), linear-gradient(160deg, #2b2018 0%, #3a2a1f 55%, #211814 100%)',
    cardBackground: 'rgba(50, 34, 24, 0.7)',
    accent: '#F2B97C',
    accentSoft: 'rgba(242, 185, 124, 0.18)',
    userBubble: '#f7e6c7',
    userBubbleText: '#3a2a1f',
    headingColor: '#fff1d7',
    bodyColor: 'rgba(255,241,215,0.86)',
    mutedColor: 'rgba(255,241,215,0.45)',
  },
  {
    id: 'moonlit',
    name: 'Moonlit Sea',
    description: 'Indigo and silver, calm night.',
    pageBackground:
      'radial-gradient(circle at 20% 10%, rgba(186,210,234,0.14), transparent 55%), linear-gradient(170deg, #0f1a2e 0%, #162a45 55%, #0a1222 100%)',
    cardBackground: 'rgba(22, 35, 58, 0.7)',
    accent: '#B8D4F5',
    accentSoft: 'rgba(184, 212, 245, 0.15)',
    userBubble: '#e0ecf7',
    userBubbleText: '#162a45',
    headingColor: '#f0f5fc',
    bodyColor: 'rgba(240,245,252,0.84)',
    mutedColor: 'rgba(240,245,252,0.45)',
  },
  {
    id: 'cabin',
    name: 'Forest Cabin',
    description: 'Mossy greens warmed by firelight.',
    pageBackground:
      'radial-gradient(circle at 75% 15%, rgba(222,122,62,0.18), transparent 55%), linear-gradient(165deg, #1c2a23 0%, #26382d 55%, #14211a 100%)',
    cardBackground: 'rgba(31, 48, 39, 0.7)',
    accent: '#E28A4C',
    accentSoft: 'rgba(226, 138, 76, 0.18)',
    userBubble: '#f4e2cc',
    userBubbleText: '#26382d',
    headingColor: '#f0efe0',
    bodyColor: 'rgba(240,239,224,0.85)',
    mutedColor: 'rgba(240,239,224,0.45)',
  },
  {
    id: 'rainfall',
    name: 'Rainfall Window',
    description: 'Muted grey and soft blue. Watercolor.',
    pageBackground:
      'radial-gradient(circle at 20% 20%, rgba(191,206,220,0.12), transparent 55%), linear-gradient(170deg, #2a3038 0%, #343b45 55%, #22272d 100%)',
    cardBackground: 'rgba(52, 59, 69, 0.72)',
    accent: '#A8C4E0',
    accentSoft: 'rgba(168, 196, 224, 0.16)',
    userBubble: '#e2e9f0',
    userBubbleText: '#343b45',
    headingColor: '#f2f4f8',
    bodyColor: 'rgba(242,244,248,0.84)',
    mutedColor: 'rgba(242,244,248,0.45)',
  },
  {
    id: 'dusk',
    name: 'Desert Dusk',
    description: 'Rust, rose, sand at golden hour.',
    pageBackground:
      'radial-gradient(circle at 80% 15%, rgba(236,162,140,0.22), transparent 55%), linear-gradient(165deg, #3a2220 0%, #4a2a26 55%, #2b1816 100%)',
    cardBackground: 'rgba(60, 35, 32, 0.72)',
    accent: '#F0B59C',
    accentSoft: 'rgba(240, 181, 156, 0.2)',
    userBubble: '#f7dccb',
    userBubbleText: '#4a2a26',
    headingColor: '#ffecdc',
    bodyColor: 'rgba(255,236,220,0.85)',
    mutedColor: 'rgba(255,236,220,0.45)',
  },
]

export function getTheme(id: string | null | undefined): TherapyTheme {
  return THERAPY_THEMES.find((theme) => theme.id === id) ?? THERAPY_THEMES[0]
}

// ── Mood check-in options ─────────────────────────────────────────

export type MoodOption = {
  id: string
  label: string
  emoji: string
  /** A short preface the user effectively sends as their first message when they pick this. */
  starterPhrase: string
}

export const MOOD_OPTIONS: MoodOption[] = [
  { id: 'bright', label: 'Bright', emoji: '☀️', starterPhrase: 'Feeling bright today, want to hold onto this.' },
  { id: 'content', label: 'Content', emoji: '🌿', starterPhrase: 'I feel settled today. Just checking in.' },
  { id: 'calm', label: 'Calm', emoji: '🌊', starterPhrase: 'Calm right now. Want to talk through something lightly.' },
  { id: 'tender', label: 'Tender', emoji: '💛', starterPhrase: 'Feeling tender and a bit soft today.' },
  { id: 'heavy', label: 'Heavy', emoji: '🌧️', starterPhrase: 'Things feel heavy. I needed somewhere to land.' },
  { id: 'overwhelmed', label: 'Overwhelmed', emoji: '🌪️', starterPhrase: 'I am overwhelmed and I do not know where to start.' },
  { id: 'sad', label: 'Sad', emoji: '😔', starterPhrase: 'I am sad today. That is all I can say right now.' },
  { id: 'angry', label: 'Angry', emoji: '🔥', starterPhrase: 'I am angry. I need to vent a bit.' },
  { id: 'numb', label: 'Numb', emoji: '😶‍🌫️', starterPhrase: 'I feel numb. Not sure what is there.' },
  { id: 'thinking', label: 'Just thinking', emoji: '💭', starterPhrase: 'Just thinking out loud, want company.' },
]
