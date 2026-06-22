import assert from 'node:assert/strict'
import test from 'node:test'
import { buildHealthTimelineEvents } from './timeline'

test('builds typed timeline events with condition, treatment, side effect, medication, and life event links', () => {
  const events = buildHealthTimelineEvents({
    moods: [],
    symptoms: [
      {
        id: 'symptom-1',
        symptom: 'Fatigue',
        severity: 4,
        note: 'Afternoon crash',
        conditionSlug: 'anxiety',
        loggedAt: new Date('2026-02-03T10:00:00Z'),
        createdAt: new Date('2026-02-03T09:00:00Z'),
      },
    ],
    treatments: [
      {
        id: 'treatment-1',
        treatment: 'CBT',
        effectiveness: 5,
        sideEffects: ['Vivid dreams'],
        notes: 'Useful session',
        conditionSlug: 'anxiety',
        createdAt: new Date('2026-02-04T09:00:00Z'),
      },
    ],
    journals: [
      {
        id: 'journal-1',
        title: 'Moved house',
        body: 'Stress spiked after the move.',
        eventKind: 'life_event',
        conditionSlug: 'anxiety',
        intensity: 3,
        createdAt: new Date('2026-02-05T09:00:00Z'),
      },
    ],
    medications: [
      {
        id: 'med-1',
        medication: 'Sertraline',
        dose: '50mg',
        lastTakenAt: new Date('2026-02-06T08:00:00Z'),
        createdAt: new Date('2026-02-01T08:00:00Z'),
      },
    ],
  })

  assert.deepEqual(
    events.map((event) => event.type),
    ['medication', 'life_event', 'side_effect', 'treatment', 'symptom'],
  )
  assert.equal(events[0].medication, 'Sertraline')
  assert.equal(events[1].condition_slug, 'anxiety')
  assert.equal(events[1].value, 3)
  assert.equal(events[2].side_effect, 'Vivid dreams')
  assert.equal(events[2].treatment, 'CBT')
  assert.equal(events[4].condition_slug, 'anxiety')
})
