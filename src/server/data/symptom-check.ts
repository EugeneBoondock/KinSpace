import type { Ctx } from './_shared'
import { conditions, symptoms, conditionSymptoms } from '@/server/db/schema'
import { detectCrisisSeverity } from '@/lib/crisis-detect'
import { buildSymptomCheck, EMERGENCY_FLAGS, type SymptomCheckResult } from './symptom-check-core'

export type { SymptomCheckResult } from './symptom-check-core'

/**
 * Guided symptom check. Read-only (no writes); works for anonymous visitors too,
 * so the landing's "not sure where to start" can route here. The note is screened
 * for crisis language via the platform's shared detector; nothing is persisted.
 */
export async function getSymptomCheck(
  ctx: Ctx,
  data: { symptoms?: string[]; redFlags?: string[]; note?: string | null },
): Promise<SymptomCheckResult> {
  const [conditionRows, symptomRows, csRows] = await Promise.all([
    ctx.db.query.conditions.findMany(),
    ctx.db.query.symptoms.findMany(),
    ctx.db.query.conditionSymptoms.findMany(),
  ])

  const note = data?.note ? String(data.note).slice(0, 1000) : null
  const crisisInNote = note ? detectCrisisSeverity(note) !== 'none' : false

  return buildSymptomCheck({
    reportedSymptoms: Array.isArray(data?.symptoms) ? data.symptoms.slice(0, 25).map((s) => String(s)) : [],
    redFlagsChecked: Array.isArray(data?.redFlags) ? data.redFlags.slice(0, 16).map((s) => String(s)) : [],
    note,
    crisisInNote,
    conditionSymptomRows: csRows.map((r) => ({
      conditionSlug: r.conditionSlug,
      symptomSlug: r.symptomSlug,
      prevalence: r.prevalence,
    })),
    conditionRows: conditionRows.map((c) => ({ slug: c.slug, name: c.name, category: c.category })),
    symptomRows: symptomRows.map((s) => ({ slug: s.slug, name: s.name })),
  })
}

/** Intake options: the emergency screen + a chip list of the most cross-cutting
 *  symptoms (ranked by how many conditions report them), for fast selection. */
export async function getSymptomCheckOptions(ctx: Ctx) {
  const [symptomRows, csRows] = await Promise.all([
    ctx.db.query.symptoms.findMany(),
    ctx.db.query.conditionSymptoms.findMany(),
  ])
  const counts = new Map<string, number>()
  for (const row of csRows) counts.set(row.symptomSlug, (counts.get(row.symptomSlug) ?? 0) + 1)
  const nameBySlug = new Map(symptomRows.map((s) => [s.slug, s.name]))
  const common = [...counts.entries()]
    .filter(([slug]) => nameBySlug.has(slug))
    .sort((a, b) => b[1] - a[1] || (nameBySlug.get(a[0]) ?? '').localeCompare(nameBySlug.get(b[0]) ?? ''))
    .slice(0, 40)
    .map(([slug]) => ({ slug, name: nameBySlug.get(slug) as string }))
  return { emergency_flags: EMERGENCY_FLAGS, common_symptoms: common }
}
