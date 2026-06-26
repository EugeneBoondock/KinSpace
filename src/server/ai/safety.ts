import { CRISIS_RESOURCES } from '@/lib/crisis-resources'
import { isCrisisText, SA_CRISIS_REPLY } from '@/lib/crisis-detect'

/**
 * Code-level safety guardrails for all AI features. These are intentionally
 * conservative (false positives are acceptable on a vulnerable-user platform).
 */

const CRISIS_PATTERNS: RegExp[] = [
  /\bkill(ing)?\s+my\s*self\b/i,
  /\bsuicid/i,
  /\bend(ing)?\s+my\s+life\b/i,
  /\bwant(ing)?\s+to\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(be\s+here|live)\b/i,
  /\bself[-\s]?harm/i,
  /\bhurt(ing)?\s+my\s*self\b/i,
  /\bcut(ting)?\s+my\s*self\b/i,
  /\boverdos/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\bbetter\s+off\s+dead\b/i,
  /\bend\s+it\s+all\b/i,
]

export function detectCrisis(text: string): boolean {
  if (!text) return false
  // Shared detector (catches passive ideation) first, regex patterns as a supplement.
  return isCrisisText(text) || CRISIS_PATTERNS.some((pattern) => pattern.test(text))
}

/** Scans the most recent user message in a conversation. */
export function detectCrisisInMessages(messages: Array<{ role: string; content: string }>): boolean {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  return lastUser ? detectCrisis(lastUser.content) : false
}

export const MEDICAL_DISCLAIMER =
  'KinSpace offers peer support and general, plain-language information, not medical advice, diagnosis, or treatment. ' +
  'Always consult a qualified health professional about your situation, and call emergency services if you are in danger.'

/** Plain-text crisis block appended to AI replies when distress is detected. */
export function crisisMessage(): string {
  return SA_CRISIS_REPLY
}

export { CRISIS_RESOURCES }
