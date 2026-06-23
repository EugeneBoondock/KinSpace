import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

type SeedTreatment = { slug: string }
type EvidenceEntry = {
  slug: string
  effectiveness: number
  tier: 'strong' | 'moderate' | 'emerging'
}
type SeedCondition = {
  slug: string
  name: string
  category: string
  aliases: string[]
  summary: string
  evidence: {
    treatments: EvidenceEntry[]
    symptoms: Array<{ name: string; prevalence: number }>
    triggers: Array<{ name: string; prevalence: number }>
    tests: Array<{ name: string; prevalence: number }>
  }
}

const seed = JSON.parse(readFileSync('scripts/seed-data/africa-conditions.json', 'utf8')) as {
  newTreatments: SeedTreatment[]
  conditions: SeedCondition[]
}

const conditionBySlug = new Map(seed.conditions.map((condition) => [condition.slug, condition]))

const addedDisabilitySlugs = [
  'cerebral-palsy',
  'spinal-cord-injury',
  'limb-loss',
  'intellectual-disability',
  'hearing-loss',
  'vision-impairment',
]

const addedCardiovascularSlugs = [
  'coronary-artery-disease',
  'atrial-fibrillation',
  'rheumatic-heart-disease',
  'peripheral-artery-disease',
]

function assertHasBaseline(condition: SeedCondition): void {
  assert.ok(condition.summary.length >= 80, `${condition.slug} should have a useful summary`)
  assert.ok(condition.evidence.treatments.length >= 5, `${condition.slug} should have ranked treatments`)
  assert.ok(condition.evidence.symptoms.length >= 5, `${condition.slug} should have symptoms`)
  assert.ok(condition.evidence.triggers.length >= 4, `${condition.slug} should have triggers`)
  assert.ok(condition.evidence.tests.length >= 3, `${condition.slug} should have tests`)

  for (const treatment of condition.evidence.treatments) {
    assert.ok(treatment.effectiveness >= 0 && treatment.effectiveness <= 5, `${condition.slug} has an invalid score`)
    assert.match(treatment.tier, /^(strong|moderate|emerging)$/)
  }
}

function assertNoDashCopy(condition: SeedCondition): void {
  const copy = [
    condition.summary,
    ...condition.aliases,
    ...condition.evidence.symptoms.map((item) => item.name),
    ...condition.evidence.triggers.map((item) => item.name),
    ...condition.evidence.tests.map((item) => item.name),
  ].join('\n')

  assert.doesNotMatch(copy, /[—–]/u, `${condition.slug} should avoid dash glyphs in surfaced copy`)
}

test('Africa condition seed includes requested disability and cardiovascular coverage', () => {
  for (const slug of addedDisabilitySlugs) {
    const condition = conditionBySlug.get(slug)
    assert.ok(condition, `${slug} should be seeded`)
    assert.equal(condition.category, 'disability')
    assertHasBaseline(condition)
    assertNoDashCopy(condition)
  }

  for (const slug of addedCardiovascularSlugs) {
    const condition = conditionBySlug.get(slug)
    assert.ok(condition, `${slug} should be seeded`)
    assert.equal(condition.category, 'cardiovascular')
    assertHasBaseline(condition)
    assertNoDashCopy(condition)
  }
})

test('new seed coverage defines new treatment lexicon entries used by the added records', () => {
  const newTreatmentSlugs = new Set(seed.newTreatments.map((treatment) => treatment.slug))

  for (const slug of [
    'cardiac-rehabilitation',
    'coronary-angioplasty-stent',
    'rate-control-medicine',
    'valve-surgery',
    'mobility-aids',
    'wheelchair-seating',
    'assistive-technology',
    'hearing-aids',
    'low-vision-aids',
    'orthotics',
    'spasticity-treatment',
  ]) {
    assert.ok(newTreatmentSlugs.has(slug), `${slug} should be defined in the treatment lexicon`)
  }
})

test('condition category navigation exposes disability filtering', () => {
  const conditionsPage = readFileSync('src/app/conditions/page.tsx', 'utf8')
  const explorer = readFileSync('src/components/ConditionExplorer.tsx', 'utf8')
  const symptomChecker = readFileSync('src/app/symptom-checker/page.tsx', 'utf8')

  assert.match(conditionsPage, /id: 'disability'/)
  assert.match(explorer, /disability:\s*'var\(--accent-5\)'/)
  assert.match(explorer, /disability:\s*'blue'/)
  assert.match(symptomChecker, /disability:\s*'blue'/)
})
