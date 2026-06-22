import assert from 'node:assert/strict'
import test from 'node:test'
import { filterConditionReportsForSearch } from './health'

const reports = [
  {
    id: 'report-a',
    ageOfOnset: 24,
    symptoms: ['Brain fog', 'Fatigue'],
    triggers: ['Poor sleep'],
    comorbidities: ['Anxiety'],
    tests: ['Blood panel'],
    treatments: [
      { slug: 'cbt', name: 'CBT', effectiveness: 4, side_effects: [] },
      { slug: 'sertraline', name: 'Sertraline', effectiveness: 3, side_effects: ['Nausea'] },
    ],
    note: 'Sleep pacing helped most.',
    isSearchVisible: true,
    updatedAt: new Date('2026-01-03T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    id: 'report-b',
    ageOfOnset: 31,
    symptoms: ['Low mood'],
    triggers: ['Conflict'],
    comorbidities: ['PTSD'],
    tests: [],
    treatments: [{ slug: 'emdr', name: 'EMDR', effectiveness: 5, side_effects: ['Vivid dreams'] }],
    note: 'Therapy was the turning point.',
    isSearchVisible: true,
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    createdAt: new Date('2026-01-02T00:00:00Z'),
  },
  {
    id: 'report-hidden',
    ageOfOnset: 29,
    symptoms: ['Fatigue'],
    triggers: ['Long work days'],
    comorbidities: [],
    tests: [],
    treatments: [{ slug: 'cbt', name: 'CBT', effectiveness: 4, side_effects: [] }],
    note: 'hidden-search-token',
    isSearchVisible: false,
    updatedAt: new Date('2026-01-04T00:00:00Z'),
    createdAt: new Date('2026-01-04T00:00:00Z'),
  },
  {
    id: 'report-draft',
    ageOfOnset: 34,
    symptoms: ['Sleep trouble'],
    triggers: [],
    comorbidities: [],
    tests: [],
    treatments: [{ slug: 'cbt', name: 'CBT', effectiveness: 4, side_effects: [] }],
    note: 'draft-search-token',
    isSearchVisible: true,
    completionState: 'draft',
    updatedAt: new Date('2026-01-05T00:00:00Z'),
    createdAt: new Date('2026-01-05T00:00:00Z'),
  },
]

test('filters condition reports by treatment, symptom, side effect, and free text without exposing identity or notes', () => {
  const treatmentResults = filterConditionReportsForSearch(reports, { treatment: 'sertraline' })
  assert.equal(treatmentResults.length, 1)
  assert.equal(treatmentResults[0].id, 'report-a')
  assert.deepEqual(treatmentResults[0].match_reasons, ['Treatment: Sertraline'])
  assert.equal(Object.hasOwn(treatmentResults[0], 'profile'), false)
  assert.equal(Object.hasOwn(treatmentResults[0], 'note'), false)

  const symptomResults = filterConditionReportsForSearch(reports, { symptom: 'low mood' })
  assert.equal(symptomResults[0].id, 'report-b')
  assert.deepEqual(symptomResults[0].match_reasons, ['Symptom: Low mood'])

  const sideEffectResults = filterConditionReportsForSearch(reports, { sideEffect: 'nausea' })
  assert.equal(sideEffectResults[0].id, 'report-a')
  assert.deepEqual(sideEffectResults[0].match_reasons, ['Side effect: Nausea'])

  const noteResults = filterConditionReportsForSearch(reports, { query: 'pacing' })
  assert.equal(noteResults[0].id, 'report-a')
  assert.deepEqual(noteResults[0].match_reasons, ['Matched report details'])

  const hiddenResults = filterConditionReportsForSearch(reports, { query: 'hidden-search-token' })
  assert.equal(hiddenResults.length, 0)

  const draftResults = filterConditionReportsForSearch(reports, { query: 'draft-search-token' })
  assert.equal(draftResults.length, 0)
})

test('returns newest anonymized report summaries when no search filters are provided', () => {
  const results = filterConditionReportsForSearch(reports, { limit: 1 })
  assert.equal(results.length, 1)
  assert.equal(results[0].id, 'report-a')
  assert.equal(results[0].is_anonymized, true)
  assert.deepEqual(results[0].symptoms, ['Brain fog', 'Fatigue'])
  assert.deepEqual(results[0].treatments[1], {
    slug: 'sertraline',
    name: 'Sertraline',
    effectiveness: 3,
    side_effects: ['Nausea'],
  })
})
