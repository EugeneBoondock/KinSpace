// Single source of truth for crisis detection across the app (client + server).
// Replaces three divergent detectors that only caught explicit phrases. Research
// on AI mental-health tools shows the biggest failure is missing PASSIVE/indirect
// ideation and degrading as risk escalates, so we detect both, return a tier
// (not a boolean), and pair it with SA-first resources. This is a deterministic,
// human-authored safety layer ABOVE the model; the model is never the only net.

export type CrisisSeverity = 'none' | 'passive' | 'active'

// Explicit, active statements of intent / self-harm.
const ACTIVE_SIGNALS = [
  'kill myself',
  'killing myself',
  'kill me',
  'suicide',
  'suicidal',
  'end it all',
  'end my life',
  'ending my life',
  'take my life',
  'taking my life',
  'want to die',
  'wanna die',
  'want to be dead',
  'better off dead',
  'hurt myself',
  'harm myself',
  'self harm',
  'self-harm',
  'cut myself',
  'overdose',
  "don't want to live",
  'do not want to live',
  "don't want to be alive",
  'kms',
]

// Passive / indirect ideation: the signals bots usually miss.
const PASSIVE_SIGNALS = [
  'no point anymore',
  'no point in living',
  "what's the point anymore",
  'whats the point anymore',
  'better off without me',
  'everyone would be better off',
  'world would be better without me',
  'tired of being here',
  'tired of living',
  'tired of being alive',
  "can't do this anymore",
  'cant do this anymore',
  "can't go on",
  'cant go on',
  'give up on life',
  'wish i could disappear',
  "wish i wasn't here",
  'wish i wasnt here',
  "won't be a burden much longer",
  'wont be a burden much longer',
  'no reason to keep going',
  'nothing to live for',
  'nothing left to live for',
  'done with life',
  'not worth living',
  'rather not wake up',
  "don't want to wake up",
]

/** Highest-severity crisis signal found in a message: 'active' > 'passive' > 'none'. */
export function detectCrisisSeverity(text: string): CrisisSeverity {
  const lower = (text || '').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  if (ACTIVE_SIGNALS.some((phrase) => lower.includes(phrase))) return 'active'
  if (PASSIVE_SIGNALS.some((phrase) => lower.includes(phrase))) return 'passive'
  return 'none'
}

/** Any crisis-level signal (passive or active). */
export function isCrisisText(text: string): boolean {
  return detectCrisisSeverity(text) !== 'none'
}

// SA-first crisis copy: the ONE place this wording lives, so no screen ever
// shows a US-only number again.
export const SA_CRISIS_LINES = {
  sadag: { label: 'SADAG mental health line (24/7)', tel: '0800567567', display: '0800 567 567', sms: '31393' },
  suicide: { label: 'Suicide Crisis Helpline (24/7)', tel: '0800121314', display: '0800 12 13 14' },
  emergency: { label: 'Emergency', tel: '10111', display: '10111 (112 from a cellphone)' },
  outside: { label: 'Outside South Africa', url: 'https://findahelpline.com' },
} as const

/** A warm, SA-first spoken/written crisis response (no method info, points to a human). */
export const SA_CRISIS_REPLY =
  'I’m really glad you told me this. If you might act on these thoughts, please reach a person right now. ' +
  'in South Africa call SADAG on 0800 567 567 (24h) or SMS 31393, the Suicide Crisis Helpline on 0800 12 13 14, ' +
  'or emergency services on 10111 (112 from a cellphone). Outside South Africa, findahelpline.com lists local lines. ' +
  'If you can, move toward someone you trust and tell them you need help right now. I’m not a clinician, but I’m here with you and you don’t have to carry this alone.'
