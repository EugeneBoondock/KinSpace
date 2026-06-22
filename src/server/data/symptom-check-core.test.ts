import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSymptomCheck, EMERGENCY_FLAGS, type SymptomCheckInput } from './symptom-check-core'

const conditionRows = [
  { slug: 'long-covid', name: 'Long COVID', category: 'chronic' },
  { slug: 'fibromyalgia', name: 'Fibromyalgia', category: 'pain' },
  { slug: 'migraine', name: 'Migraine', category: 'neurological' },
  { slug: 'depression', name: 'Depression', category: 'mental' },
]
const symptomRows = [
  { slug: 'fatigue', name: 'Fatigue' },
  { slug: 'brain-fog', name: 'Brain fog' },
  { slug: 'throbbing-headache', name: 'Throbbing headache' },
  { slug: 'low-mood', name: 'Low mood' },
]
const conditionSymptomRows = [
  { conditionSlug: 'long-covid', symptomSlug: 'fatigue', prevalence: 0.92 },
  { conditionSlug: 'long-covid', symptomSlug: 'brain-fog', prevalence: 0.82 },
  { conditionSlug: 'fibromyalgia', symptomSlug: 'fatigue', prevalence: 0.9 },
  { conditionSlug: 'fibromyalgia', symptomSlug: 'brain-fog', prevalence: 0.8 },
  { conditionSlug: 'migraine', symptomSlug: 'throbbing-headache', prevalence: 0.94 },
  { conditionSlug: 'depression', symptomSlug: 'low-mood', prevalence: 0.95 },
  { conditionSlug: 'depression', symptomSlug: 'fatigue', prevalence: 0.84 },
]
const base: Omit<SymptomCheckInput, 'reportedSymptoms' | 'redFlagsChecked'> = {
  note: null,
  conditionSymptomRows,
  conditionRows,
  symptomRows,
}

test('matches conditions where the picked symptoms cluster, excludes non-matches', () => {
  const r = buildSymptomCheck({ ...base, reportedSymptoms: ['Fatigue', 'Brain fog'], redFlagsChecked: [] })
  assert.equal(r.triage, 'see-clinician')
  // long-covid + fibromyalgia both explain BOTH symptoms → top, match_count 2.
  assert.equal(r.candidates[0].match_count, 2)
  const names = r.candidates.map((c) => c.name)
  assert.ok(names.includes('Long COVID') && names.includes('Fibromyalgia'))
  // migraine shares none of the picked symptoms → must not appear.
  assert.ok(!names.includes('Migraine'))
  // depression explains only Fatigue → present but ranked below the 2-matches.
  const depression = r.candidates.find((c) => c.name === 'Depression')
  assert.ok(depression && depression.match_count === 1)
})

test('EMERGENCY FIRST: a medical red flag routes to urgent, not a condition guess', () => {
  const r = buildSymptomCheck({ ...base, reportedSymptoms: ['Fatigue'], redFlagsChecked: ['chest-pain'] })
  assert.equal(r.triage, 'urgent')
  assert.ok(r.red_flags.some((f) => /chest/i.test(f)))
  assert.ok(r.next_steps.some((s) => /urgent|emergency/i.test(s)))
  assert.equal(r.candidates.length, 0) // urgent must not surface condition guesses either
})

test('self-harm flag routes to crisis and suppresses condition matches', () => {
  const r = buildSymptomCheck({ ...base, reportedSymptoms: ['Fatigue', 'Low mood'], redFlagsChecked: ['self-harm'] })
  assert.equal(r.triage, 'crisis')
  assert.equal(r.crisis, true)
  assert.equal(r.candidates.length, 0)
  assert.ok(r.next_steps.some((s) => /crisis|emergency/i.test(s)))
})

test('crisis detected in the free-text note also routes to crisis', () => {
  const r = buildSymptomCheck({ ...base, reportedSymptoms: ['Low mood'], redFlagsChecked: [], crisisInNote: true })
  assert.equal(r.triage, 'crisis')
  assert.equal(r.candidates.length, 0)
})

test('always carries a non-diagnostic disclaimer + clinician next step', () => {
  const r = buildSymptomCheck({ ...base, reportedSymptoms: ['Fatigue'], redFlagsChecked: [] })
  assert.match(r.disclaimer, /not a diagnosis/i)
  assert.ok(r.next_steps.some((s) => /clinician/i.test(s)))
})

test('unknown symptom yields no false matches but is still acknowledged', () => {
  const r = buildSymptomCheck({ ...base, reportedSymptoms: ['Glitter sneezes'], redFlagsChecked: [] })
  assert.equal(r.candidates.length, 0)
  assert.deepEqual(r.reported, ['Glitter sneezes'])
})

test('emergency flag list includes a crisis-kind option', () => {
  assert.ok(EMERGENCY_FLAGS.some((f) => f.kind === 'crisis'))
})
