// AI-assisted medication identification from a photo. The user takes/uploads
// a picture of a pill, blister pack, or box; a vision-capable model reads the
// imprint/label and returns plain-language, NEVER-DIAGNOSING facts about the med.
//
// Cost shape: 1 vision LLM call per identify. No web fetches, no persistence.

import OpenAI from 'openai'

export type Confidence = 'high' | 'medium' | 'low'

export type MedicationIdentification = {
  name: string
  generic_name: string | null
  drug_class: string | null
  used_for: string[]
  common_benefits: string[]
  common_side_effects: string[]
  serious_warnings: string[]
  interactions: string[]
  ask_your_doctor: string[]
  confidence: Confidence
  disclaimer: string
}

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (client) return client
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
  client = new OpenAI({ apiKey })
  return client
}

const DEFAULT_DISCLAIMER =
  'This is general information, not medical advice. Always confirm with a pharmacist or doctor before taking, changing, or stopping any medication.'

const SYSTEM_PROMPT = `You are KinSpace Med Lens — a careful health companion that identifies a medication from a photo and explains it in warm, plain language. You are NOT a pharmacist and you NEVER replace one.

You will receive a single photo. It may show a pill (with an imprint code, shape, and color), a blister pack, a bottle, or a box/label.

How to identify:
- Read any visible text: brand name, generic name, strength, the imprint stamped on a tablet/capsule, and label wording.
- Use shape, color, and imprint together when there is no readable name.
- If you genuinely cannot tell what it is, DO NOT guess a specific drug. Set "confidence" to "low", leave fields you are unsure about empty, and add to "ask_your_doctor": "I couldn't read it clearly — try a sharper, well-lit photo of the label or the imprint on the pill."

Absolute rules:
- NEVER invent or suggest a specific personal dosage or schedule. Describe the medication generally only.
- NEVER diagnose, and never tell someone to start or stop a medicine.
- Prefer well-established, general drug facts. If unsure about a detail, leave that array empty rather than inventing.
- "serious_warnings" are the things that matter most: black-box warnings, overdose risk, dangerous combinations, allergy/anaphylaxis signs, when to seek urgent care.
- "interactions" are common drug/food/alcohol interactions, in plain language.
- Keep every list item short (a phrase or one sentence), at a 6th-8th grade reading level.

Respond with STRICT JSON only — no prose, no markdown fences — matching exactly:
{
  "name": string,                       // best-guess brand or common name, or a short description if unknown
  "generic_name": string | null,
  "drug_class": string | null,          // e.g. "Statin", "SSRI", "Beta blocker"
  "used_for": string[],                 // 0-5 conditions/purposes this is commonly used for
  "common_benefits": string[],          // 0-5 plain-language benefits
  "common_side_effects": string[],      // 0-6 common side effects
  "serious_warnings": string[],         // 0-5 serious warnings / when to seek urgent care
  "interactions": string[],             // 0-5 common interactions (drugs, food, alcohol)
  "ask_your_doctor": string[],          // 1-5 questions/notes to raise with a clinician or pharmacist
  "confidence": "high" | "medium" | "low",
  "disclaimer": string                  // general-information-not-advice + confirm with a pharmacist/doctor
}`

function asStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
    .slice(0, max)
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asConfidence(value: unknown): Confidence {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'low'
}

/** Strips ```json fences and parses the model output safely. Returns null on failure. */
function parseModelJson(raw: string): Record<string, unknown> | null {
  let text = raw.trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  }
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

/**
 * Identifies a medication from a base64 data-URL image. Returns null only when
 * the model fails or returns unusable output; a low-confidence "couldn't read it"
 * result is still a valid identification.
 */
export async function identifyMedication(imageDataUrl: string): Promise<MedicationIdentification | null> {
  const model = process.env.OPENAI_MODEL_FULL || 'gpt-5.4'
  const openai = getClient()

  try {
    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Identify the medication in this photo and explain it. Respond with strict JSON only.',
            },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: 0.2,
      max_completion_tokens: 900,
    })

    const text = completion.choices[0]?.message?.content?.trim()
    if (!text) return null

    const parsed = parseModelJson(text)
    if (!parsed) return null

    const name = asNullableString(parsed.name)
    const askYourDoctor = asStringArray(parsed.ask_your_doctor, 5)
    const confidence = asConfidence(parsed.confidence)

    return {
      name: name ?? 'Unidentified medication',
      generic_name: asNullableString(parsed.generic_name),
      drug_class: asNullableString(parsed.drug_class),
      used_for: asStringArray(parsed.used_for, 5),
      common_benefits: asStringArray(parsed.common_benefits, 5),
      common_side_effects: asStringArray(parsed.common_side_effects, 6),
      serious_warnings: asStringArray(parsed.serious_warnings, 5),
      interactions: asStringArray(parsed.interactions, 5),
      ask_your_doctor:
        askYourDoctor.length > 0
          ? askYourDoctor
          : ["I couldn't read it clearly — try a sharper, well-lit photo of the label or the imprint on the pill."],
      confidence,
      disclaimer: asNullableString(parsed.disclaimer) ?? DEFAULT_DISCLAIMER,
    }
  } catch (error) {
    console.error('Medication identify failed:', error)
    return null
  }
}
