import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTreatmentEvidence } from './health'

const reports = [
  {
    id: 'report-a',
    conditionSlug: 'anxiety',
    symptoms: ['Racing thoughts'],
    triggers: ['Crowds'],
    treatments: [
      { slug: 'cbt', name: 'CBT', effectiveness: 4, side_effects: ['Headache', 'Nausea'] },
      { slug: 'emdr', name: 'EMDR', effectiveness: 3, side_effects: [] },
    ],
    note: 'This private note must never return.',
    updatedAt: new Date('2026-02-03T00:00:00Z'),
    createdAt: new Date('2026-02-01T00:00:00Z'),
  },
  {
    id: 'report-b',
    conditionSlug: 'depression',
    symptoms: ['Low mood'],
    triggers: ['Poor sleep'],
    treatments: [{ slug: 'cbt', name: 'CBT', effectiveness: 2, side_effects: ['Nausea'] }],
    note: 'Another private note.',
    updatedAt: new Date('2026-02-02T00:00:00Z'),
    createdAt: new Date('2026-02-02T00:00:00Z'),
  },
  {
    id: 'report-c',
    conditionSlug: 'anxiety',
    symptoms: ['Tension'],
    triggers: ['Conflict'],
    treatments: [{ slug: 'emdr', name: 'EMDR', effectiveness: 5, side_effects: ['Vivid dreams'] }],
    updatedAt: new Date('2026-02-04T00:00:00Z'),
    createdAt: new Date('2026-02-04T00:00:00Z'),
  },
]

const conditions = [
  { slug: 'anxiety', name: 'Generalised Anxiety', description: 'Anxiety reports' },
  { slug: 'depression', name: 'Depression', description: 'Depression reports' },
  { slug: 'ptsd', name: 'PTSD', description: 'Trauma reports' },
]

test('builds treatment evidence from reports without exposing identity or notes', () => {
  const evidence = buildTreatmentEvidence('cbt', reports, conditions, [
    { conditionSlug: 'ptsd', treatmentSlug: 'cbt', effectivenessAvg: 3.5, effectivenessCount: 4 },
  ])

  assert.equal(evidence.total_report_count, 2)
  assert.equal(evidence.overall_effectiveness_avg, 3)
  assert.equal(evidence.condition_count, 3)
  assert.deepEqual(evidence.side_effects[0], { name: 'Nausea', count: 2, prevalence_pct: 100 })
  assert.deepEqual(evidence.side_effects[1], { name: 'Headache', count: 1, prevalence_pct: 50 })

  assert.deepEqual(
    evidence.conditions.map((condition) => ({
      slug: condition.slug,
      count: condition.report_count,
      avg: condition.effectiveness_avg,
      label: condition.confidence_label,
      source: condition.source_label,
    })),
    [
      { slug: 'ptsd', count: 4, avg: 3.5, label: 'Early signal', source: 'Experience ratings' },
      { slug: 'anxiety', count: 1, avg: 4, label: 'Early signal', source: 'Member reports' },
      { slug: 'depression', count: 1, avg: 2, label: 'Early signal', source: 'Member reports' },
    ],
  )

  assert.equal(evidence.reports.length, 2)
  assert.equal(evidence.reports[0].id, 'report-a')
  assert.equal(Object.hasOwn(evidence.reports[0], 'note'), false)
  assert.equal(Object.hasOwn(evidence.reports[0], 'userId'), false)
  assert.equal(evidence.reports[0].is_anonymized, true)
})

test('labels larger treatment samples with stronger confidence bands', () => {
  const evidence = buildTreatmentEvidence('cbt', [], conditions, [
    { conditionSlug: 'anxiety', treatmentSlug: 'cbt', effectivenessAvg: 4.2, effectivenessCount: 24 },
    { conditionSlug: 'depression', treatmentSlug: 'cbt', effectivenessAvg: 3.7, effectivenessCount: 9 },
  ])

  assert.deepEqual(
    evidence.conditions.map((condition) => [condition.slug, condition.confidence_label]),
    [
      ['anxiety', 'Well reported'],
      ['depression', 'Growing signal'],
    ],
  )
})
