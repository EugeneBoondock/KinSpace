/**
 * Guided symptom check, PURE core (no imports), unit-testable in isolation.
 * The DB wrapper lives in ./symptom-check.ts.
 *
 * This is an Ada/K-Health-style GUIDED EXPLORER, deliberately NOT a diagnostic
 * engine. Two safety-first principles, enforced here:
 *   1. EMERGENCY FIRST. An explicit red-flag screen (not inferred) routes to
 *      urgent care / crisis BEFORE any condition matching is surfaced.
 *   2. NEVER DIAGNOSE. We only report "conditions where members commonly log the
 *      symptoms you picked", drawn from our own evidence/community prevalence
 *      data, always alongside "this is not a diagnosis, talk to a clinician".
 */

export type Triage = 'crisis' | 'urgent' | 'see-clinician'

export type EmergencyFlag = { id: string; label: string; kind: 'medical' | 'crisis' }

/** Explicit emergency screen, the UI renders these as checkboxes; the core
 *  recognizes the ids. Intentionally short, plain, and action-oriented. */
export const EMERGENCY_FLAGS: EmergencyFlag[] = [
  { id: 'chest-pain', label: 'Chest pain, pressure, or tightness', kind: 'medical' },
  { id: 'breathing', label: 'Severe trouble breathing', kind: 'medical' },
  { id: 'stroke', label: 'Face drooping, arm weakness, or slurred speech', kind: 'medical' },
  { id: 'worst-headache', label: 'A sudden, severe, worst-ever headache', kind: 'medical' },
  { id: 'severe-bleeding', label: 'Severe or uncontrolled bleeding', kind: 'medical' },
  { id: 'fainting', label: 'Fainting or loss of consciousness', kind: 'medical' },
  { id: 'severe-allergic', label: 'Sudden swelling, hives, or trouble swallowing', kind: 'medical' },
  { id: 'self-harm', label: 'Thoughts of harming yourself or ending your life', kind: 'crisis' },
]
const FLAG_BY_ID = new Map(EMERGENCY_FLAGS.map((f) => [f.id, f]))

export type SymptomCheckInput = {
  reportedSymptoms: string[] // names or slugs the member selected
  redFlagsChecked: string[] // EmergencyFlag ids the member explicitly checked
  note?: string | null
  crisisInNote?: boolean // computed by the wrapper via detectCrisisSeverity
  conditionSymptomRows: Array<{ conditionSlug: string; symptomSlug: string; prevalence: number | null }>
  conditionRows: Array<{ slug: string; name: string; category?: string | null }>
  symptomRows: Array<{ slug: string; name: string }>
}

export type SymptomCandidate = {
  slug: string
  name: string
  category: string | null
  matched_symptoms: string[]
  match_count: number
  total_reported: number
  /** 0–100, how strongly the picked symptoms cluster in this condition. NOT a probability. */
  match_strength: number
}

export type SymptomCheckResult = {
  triage: Triage
  crisis: boolean
  red_flags: string[]
  reported: string[]
  candidates: SymptomCandidate[]
  next_steps: string[]
  disclaimer: string
}

const slugify = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const DISCLAIMER =
  'This is not a diagnosis and not medical advice. It organizes what you told us against patterns members report, to help you and a clinician have a clearer conversation.'

export function buildSymptomCheck(input: SymptomCheckInput): SymptomCheckResult {
  const checkedFlags = (input.redFlagsChecked ?? []).map((id) => FLAG_BY_ID.get(id)).filter(Boolean) as EmergencyFlag[]
  const hasCrisisFlag = checkedFlags.some((f) => f.kind === 'crisis') || Boolean(input.crisisInNote)
  const medicalFlags = checkedFlags.filter((f) => f.kind === 'medical')

  // Resolve reported symptoms to canonical lexicon names (dedup by slug).
  const nameBySlug = new Map(input.symptomRows.map((s) => [s.slug, s.name]))
  const reportedSlugs = new Set<string>()
  const reportedNames: string[] = []
  for (const raw of input.reportedSymptoms ?? []) {
    const slug = slugify(String(raw))
    if (!slug || reportedSlugs.has(slug)) continue
    reportedSlugs.add(slug)
    reportedNames.push(nameBySlug.get(slug) ?? String(raw).trim())
  }

  // Emergency first, short-circuit the framing (still compute candidates for context,
  // but triage + next steps lead with getting help now).
  const triage: Triage = hasCrisisFlag ? 'crisis' : medicalFlags.length > 0 ? 'urgent' : 'see-clinician'

  // Candidate conditions: accumulate matched symptoms + prevalence per condition.
  const conditionMeta = new Map(input.conditionRows.map((c) => [c.slug, c]))
  const acc = new Map<string, { matched: Map<string, number> }>()
  if (reportedSlugs.size > 0) {
    for (const row of input.conditionSymptomRows) {
      if (!reportedSlugs.has(row.symptomSlug)) continue
      const entry = acc.get(row.conditionSlug) ?? { matched: new Map() }
      entry.matched.set(row.symptomSlug, typeof row.prevalence === 'number' ? row.prevalence : 0)
      acc.set(row.conditionSlug, entry)
    }
  }

  const totalReported = reportedSlugs.size
  const candidates: SymptomCandidate[] = [...acc.entries()]
    .map(([slug, { matched }]) => {
      const meta = conditionMeta.get(slug)
      const prevalences = [...matched.values()]
      const coverage = totalReported > 0 ? matched.size / totalReported : 0
      const avgPrev = prevalences.length ? prevalences.reduce((s, p) => s + p, 0) / prevalences.length : 0
      // Strength blends how many of YOUR symptoms it explains (coverage) with how
      // characteristic they are of it (avg prevalence). Bounded 0–100, never a probability.
      const strength = Math.round((0.6 * coverage + 0.4 * avgPrev) * 100)
      return {
        slug,
        name: meta?.name ?? slug,
        category: meta?.category ?? null,
        matched_symptoms: [...matched.keys()].map((s) => nameBySlug.get(s) ?? s),
        match_count: matched.size,
        total_reported: totalReported,
        match_strength: strength,
      }
    })
    .sort((a, b) => b.match_count - a.match_count || b.match_strength - a.match_strength || a.name.localeCompare(b.name))
    .slice(0, 6)

  const next_steps = buildNextSteps(triage, candidates, totalReported)

  return {
    triage,
    crisis: hasCrisisFlag,
    red_flags: checkedFlags.map((f) => f.label),
    reported: reportedNames,
    // Emergency-first lives in the engine, not just the UI: only the routine path
    // ever surfaces condition matches, so urgent/crisis never compete with "get help now".
    candidates: triage === 'see-clinician' ? candidates : [],
    next_steps,
    disclaimer: DISCLAIMER,
  }
}

function buildNextSteps(triage: Triage, candidates: SymptomCandidate[], totalReported: number): string[] {
  if (triage === 'crisis') {
    return [
      'You deserve support right now. Please reach a crisis line, you do not have to face this alone.',
      'If you might act on these thoughts or are in danger, contact emergency services.',
    ]
  }
  if (triage === 'urgent') {
    return [
      'The symptom you flagged can be serious. Please seek urgent or emergency care now rather than waiting.',
      'If symptoms are severe or worsening, call your local emergency number.',
    ]
  }
  const steps = [
    'Bring this list to a clinician, these are starting points to discuss, not conclusions.',
  ]
  if (candidates.length > 0) {
    steps.push('Open any condition below to see what members report works, and the questions worth asking your doctor.')
  } else if (totalReported > 0) {
    steps.push('We could not match these to a studied condition yet, a clinician is the best next step, and you can ask the community.')
  }
  steps.push('If anything gets worse, or any of the emergency signs appear, please seek care right away.')
  steps.push('If you would rather talk it through, the AI guide and Lanterns peer support are here too.')
  return steps
}
