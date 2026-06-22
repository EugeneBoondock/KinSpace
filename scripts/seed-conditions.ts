/**
 * Generates a D1 seed file (drizzle/seed.sql) for KinSpace's conditions /
 * treatments knowledge base — the data that powers the StuffThatWorks-style
 * condition "study" pages.
 *
 * Beyond the bare conditions + treatments lexicon, this emits an EVIDENCE
 * BASELINE for every condition:
 *   - condition_treatments  → effectiveness (0–5) + an evidence weight
 *   - condition_symptoms    → symptom prevalence (0–1)
 *   - condition_triggers    → trigger prevalence (0–1)
 *   - condition_tests       → diagnostic-test prevalence (0–1)
 *
 * These are clinically-grounded reference values, NOT fabricated member
 * reports. The app surfaces them as an "evidence-based starting point" and
 * blends real member reports on top as the community contributes, so a fresh
 * condition page is informative on day one instead of an empty ghost town.
 *
 * Effectiveness scale (0–5), calibrated to typical clinical response:
 *   4.2–4.6  highly effective first-line (e.g. CPAP for apnea, stimulants for ADHD)
 *   3.7–4.1  solid first-line (SSRIs for anxiety, CBT, EMDR for PTSD)
 *   3.1–3.6  useful adjunct / second-line
 *   2.5–3.0  modest / emerging evidence
 *
 * Evidence tier → weight (how strongly the baseline anchors the blended score
 * before member reports move it):  strong = 6, moderate = 4, emerging = 2.
 *
 * Run:   npm run seed
 * Apply: npm run db:seed:local   (or db:seed for remote)
 */

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

type ConditionCategory =
  | 'mental'
  | 'chronic'
  | 'autoimmune'
  | 'neurological'
  | 'pain'
  | 'metabolic'
  | 'sleep'
  | 'infectious'
  | 'cardiovascular'
  | 'respiratory'
  | 'cancer'
  | 'musculoskeletal'
  | 'blood'

type TreatmentKind = 'medication' | 'therapy' | 'lifestyle' | 'supplement' | 'device' | 'procedure'

type SeedCondition = {
  slug: string
  name: string
  category: ConditionCategory
  aliases: string[]
  summary: string
}

type SeedTreatment = {
  slug: string
  name: string
  kind: TreatmentKind
  summary: string
}

type EvidenceTier = 'strong' | 'moderate' | 'emerging'
// [treatment slug, effectiveness 0–5, evidence tier]
type TreatmentEvidence = [string, number, EvidenceTier]
// [display name, prevalence 0–1]
type Prevalence = [string, number]

type ConditionEvidence = {
  treatments: TreatmentEvidence[]
  symptoms: Prevalence[]
  triggers: Prevalence[]
  tests: Prevalence[]
}

const CONDITIONS: SeedCondition[] = [
  { slug: 'depression', name: 'Depression', category: 'mental', aliases: ['Major Depressive Disorder', 'MDD'], summary: 'Persistent low mood, loss of interest, fatigue, sleep/appetite changes. One of the most common mental-health conditions worldwide.' },
  { slug: 'anxiety', name: 'Generalised Anxiety', category: 'mental', aliases: ['GAD', 'Anxiety Disorder'], summary: 'Excessive, hard-to-control worry plus physical symptoms like tension, restlessness, and sleep trouble.' },
  { slug: 'ptsd', name: 'PTSD', category: 'mental', aliases: ['Post-Traumatic Stress Disorder'], summary: 'Trauma-driven re-experiencing, avoidance, hypervigilance, and mood symptoms after a distressing event.' },
  { slug: 'cptsd', name: 'Complex PTSD', category: 'mental', aliases: ['C-PTSD'], summary: 'PTSD plus difficulties with emotion regulation, self-concept, and relationships after prolonged or repeated trauma.' },
  { slug: 'adhd', name: 'ADHD', category: 'mental', aliases: ['Attention Deficit Hyperactivity Disorder'], summary: 'Differences in attention regulation, impulse control, and executive function across the lifespan.' },
  { slug: 'autism', name: 'Autism', category: 'neurological', aliases: ['ASD', 'Autism Spectrum'], summary: 'Neurodivergent pattern affecting communication, sensory processing, and social experience.' },
  { slug: 'bipolar', name: 'Bipolar Disorder', category: 'mental', aliases: ['BP1', 'BP2'], summary: 'Mood episodes ranging from depression to mania or hypomania, often with stable periods in between.' },
  { slug: 'ocd', name: 'OCD', category: 'mental', aliases: ['Obsessive-Compulsive Disorder'], summary: 'Intrusive, distressing thoughts (obsessions) and repeated behaviors or mental acts (compulsions) aimed at reducing them.' },
  { slug: 'bpd', name: 'BPD', category: 'mental', aliases: ['Borderline Personality Disorder', 'EUPD'], summary: 'Intense emotion shifts, unstable self-image, difficult relationship patterns, often rooted in early attachment experiences.' },
  { slug: 'fibromyalgia', name: 'Fibromyalgia', category: 'pain', aliases: ['Fibro', 'FM'], summary: 'Widespread pain, fatigue, sleep disturbance, and cognitive fog without an inflammatory cause on standard tests.' },
  { slug: 'chronic-pain', name: 'Chronic Pain', category: 'pain', aliases: ['Persistent Pain'], summary: 'Pain lasting longer than three months, often multi-system and requiring a combination of approaches.' },
  { slug: 'me-cfs', name: 'ME/CFS', category: 'chronic', aliases: ['Myalgic Encephalomyelitis', 'Chronic Fatigue Syndrome'], summary: 'Debilitating fatigue, post-exertional malaise, unrefreshing sleep, and cognitive dysfunction.' },
  { slug: 'long-covid', name: 'Long COVID', category: 'chronic', aliases: ['Post-acute Sequelae of COVID-19', 'PASC'], summary: 'Multi-system symptoms persisting weeks-to-years after COVID-19 infection.' },
  { slug: 'migraine', name: 'Migraine', category: 'neurological', aliases: ['Chronic Migraine'], summary: 'Recurrent neurological attacks with severe headache, often with nausea, light/sound sensitivity, and sometimes aura.' },
  { slug: 'endometriosis', name: 'Endometriosis', category: 'chronic', aliases: ['Endo'], summary: 'Tissue similar to the uterine lining grows outside the uterus, causing pain, inflammation, and often fertility impacts.' },
  { slug: 'ibs', name: 'IBS', category: 'chronic', aliases: ['Irritable Bowel Syndrome'], summary: 'Functional digestive disorder with abdominal pain and altered bowel habits, often trigger-sensitive.' },
  { slug: 'crohns', name: "Crohn's Disease", category: 'autoimmune', aliases: ['Crohns', 'IBD - Crohn'], summary: 'Chronic inflammation anywhere in the digestive tract, typically patchy and transmural.' },
  { slug: 'ulcerative-colitis', name: 'Ulcerative Colitis', category: 'autoimmune', aliases: ['UC', 'IBD - UC'], summary: 'Chronic inflammation of the colon and rectum, usually continuous and mucosal.' },
  { slug: 'hashimotos', name: "Hashimoto's", category: 'autoimmune', aliases: ['Autoimmune Thyroiditis'], summary: 'Autoimmune attack on the thyroid, often leading to hypothyroidism with fatigue, weight changes, and cognitive slowing.' },
  { slug: 'type-1-diabetes', name: 'Type 1 Diabetes', category: 'autoimmune', aliases: ['T1D'], summary: 'Autoimmune destruction of insulin-producing cells. Lifelong insulin replacement required.' },
  { slug: 'type-2-diabetes', name: 'Type 2 Diabetes', category: 'metabolic', aliases: ['T2D'], summary: 'Insulin resistance and relative insulin deficiency affecting blood glucose regulation.' },
  { slug: 'celiac', name: 'Celiac Disease', category: 'autoimmune', aliases: ['Coeliac'], summary: 'Autoimmune reaction to gluten that damages the small intestine. Treated primarily through strict gluten-free diet.' },
  { slug: 'pots', name: 'POTS', category: 'chronic', aliases: ['Postural Orthostatic Tachycardia Syndrome'], summary: 'Abnormal heart-rate response to standing with dizziness, fatigue, and brain fog.' },
  { slug: 'eds', name: 'Ehlers-Danlos', category: 'chronic', aliases: ['EDS', 'hEDS'], summary: 'Group of connective tissue disorders affecting joints, skin, and other tissues. Hypermobile type is most common.' },
  { slug: 'hypothyroidism', name: 'Hypothyroidism', category: 'metabolic', aliases: ['Underactive Thyroid'], summary: 'Low thyroid hormone production causing fatigue, weight gain, cold intolerance, and mood symptoms.' },
  { slug: 'insomnia', name: 'Insomnia', category: 'sleep', aliases: ['Chronic Insomnia'], summary: 'Difficulty falling asleep, staying asleep, or waking refreshed despite adequate opportunity.' },
  { slug: 'sad', name: 'Seasonal Depression', category: 'mental', aliases: ['SAD', 'Seasonal Affective Disorder'], summary: 'Depressive symptoms that follow a seasonal pattern, commonly in fall/winter, often helped by light therapy.' },
  { slug: 'chronic-lyme', name: 'Chronic Lyme', category: 'chronic', aliases: ['Post-treatment Lyme Disease Syndrome', 'PTLDS'], summary: 'Persistent multi-system symptoms following Lyme infection, including fatigue, joint pain, and cognitive issues.' },
  { slug: 'panic-disorder', name: 'Panic Disorder', category: 'mental', aliases: ['Panic Attacks'], summary: 'Recurrent, unexpected panic attacks plus worry about future attacks and behavior changes to avoid them.' },
  { slug: 'social-anxiety', name: 'Social Anxiety', category: 'mental', aliases: ['Social Phobia'], summary: 'Significant fear of social situations and being judged, leading to avoidance that interferes with life.' },
]

const TREATMENTS: SeedTreatment[] = [
  { slug: 'ssri-sertraline', name: 'Sertraline (Zoloft)', kind: 'medication', summary: 'SSRI commonly prescribed for depression, anxiety, PTSD, OCD, panic disorder, and social anxiety.' },
  { slug: 'ssri-escitalopram', name: 'Escitalopram (Lexapro)', kind: 'medication', summary: 'SSRI used for depression and generalised anxiety; often well-tolerated.' },
  { slug: 'ssri-fluoxetine', name: 'Fluoxetine (Prozac)', kind: 'medication', summary: 'Long-half-life SSRI used for depression, OCD, and panic.' },
  { slug: 'snri-venlafaxine', name: 'Venlafaxine (Effexor)', kind: 'medication', summary: 'SNRI for depression, anxiety, panic. Dose-dependent effect on norepinephrine.' },
  { slug: 'snri-duloxetine', name: 'Duloxetine (Cymbalta)', kind: 'medication', summary: 'SNRI used for depression, anxiety, fibromyalgia, and chronic pain.' },
  { slug: 'bupropion', name: 'Bupropion (Wellbutrin)', kind: 'medication', summary: 'NDRI with activating profile; sometimes used when SSRIs cause fatigue or sexual side effects.' },
  { slug: 'mirtazapine', name: 'Mirtazapine', kind: 'medication', summary: 'Tetracyclic antidepressant; often helps sleep and appetite at lower doses.' },
  { slug: 'lamotrigine', name: 'Lamotrigine', kind: 'medication', summary: 'Mood stabiliser for bipolar depression; slow titration to avoid rash.' },
  { slug: 'lithium', name: 'Lithium', kind: 'medication', summary: 'First-line mood stabiliser for bipolar disorder; requires monitoring.' },
  { slug: 'methylphenidate', name: 'Methylphenidate', kind: 'medication', summary: 'Stimulant commonly used for ADHD in extended- and immediate-release forms.' },
  { slug: 'amphetamine', name: 'Amphetamine salts (Adderall/Vyvanse)', kind: 'medication', summary: 'Stimulant family used for ADHD.' },
  { slug: 'atomoxetine', name: 'Atomoxetine (Strattera)', kind: 'medication', summary: 'Non-stimulant NRI for ADHD.' },
  { slug: 'guanfacine', name: 'Guanfacine', kind: 'medication', summary: 'Alpha-2 agonist used for ADHD and hyperarousal.' },
  { slug: 'prazosin', name: 'Prazosin', kind: 'medication', summary: 'Alpha-1 blocker often used off-label for PTSD nightmares.' },
  { slug: 'levothyroxine', name: 'Levothyroxine', kind: 'medication', summary: 'Synthetic T4 thyroid hormone replacement, first-line for hypothyroidism.' },
  { slug: 'metformin', name: 'Metformin', kind: 'medication', summary: 'First-line oral medication for type 2 diabetes.' },
  { slug: 'ldn', name: 'Low-Dose Naltrexone', kind: 'medication', summary: 'Off-label use at 0.5-4.5mg for fibromyalgia, ME/CFS, and autoimmune conditions.' },
  { slug: 'propranolol', name: 'Propranolol', kind: 'medication', summary: 'Beta-blocker used for migraine prevention, performance anxiety, and POTS.' },
  { slug: 'cgrp-inhibitor', name: 'CGRP inhibitor (Aimovig, Emgality)', kind: 'medication', summary: 'Newer class of migraine preventives targeting the CGRP pathway.' },
  { slug: 'triptan', name: 'Triptans (Sumatriptan)', kind: 'medication', summary: 'Acute migraine abortive medication family.' },
  { slug: 'cbt', name: 'CBT', kind: 'therapy', summary: 'Cognitive Behavioural Therapy — structured short-to-medium term therapy with strong evidence for depression, anxiety, and many other conditions.' },
  { slug: 'dbt', name: 'DBT', kind: 'therapy', summary: 'Dialectical Behaviour Therapy — skills-based approach originally developed for BPD, useful broadly for emotional regulation.' },
  { slug: 'emdr', name: 'EMDR', kind: 'therapy', summary: 'Eye Movement Desensitization and Reprocessing — evidence-based trauma therapy.' },
  { slug: 'ifs', name: 'IFS', kind: 'therapy', summary: 'Internal Family Systems — parts-based therapy for trauma, self-compassion, and emotional integration.' },
  { slug: 'somatic-experiencing', name: 'Somatic Experiencing', kind: 'therapy', summary: 'Body-based trauma therapy that focuses on nervous system regulation.' },
  { slug: 'act', name: 'ACT', kind: 'therapy', summary: 'Acceptance and Commitment Therapy — mindfulness-plus-values approach.' },
  { slug: 'erp', name: 'ERP for OCD', kind: 'therapy', summary: 'Exposure and Response Prevention — gold-standard therapy for OCD.' },
  { slug: 'psychodynamic', name: 'Psychodynamic therapy', kind: 'therapy', summary: 'Depth-oriented exploration of patterns and early relationships.' },
  { slug: 'cbt-i', name: 'CBT-I', kind: 'therapy', summary: 'Cognitive Behavioural Therapy for Insomnia — first-line for chronic insomnia.' },
  { slug: 'meditation', name: 'Meditation practice', kind: 'lifestyle', summary: 'Consistent mindfulness or concentration practice; many evidence-based forms.' },
  { slug: 'yoga', name: 'Yoga', kind: 'lifestyle', summary: 'Gentle movement + breath. Research support for depression, anxiety, chronic pain.' },
  { slug: 'walking', name: 'Daily walks', kind: 'lifestyle', summary: 'Simple, repeatable movement that compounds; strong evidence across mood and metabolic conditions.' },
  { slug: 'strength-training', name: 'Strength training', kind: 'lifestyle', summary: 'Progressive resistance work — depression, diabetes, and chronic pain benefit.' },
  { slug: 'cold-exposure', name: 'Cold exposure', kind: 'lifestyle', summary: 'Short cold showers or plunges; reported benefits for mood and inflammation (research is early).' },
  { slug: 'sleep-hygiene', name: 'Sleep hygiene', kind: 'lifestyle', summary: 'Consistent bedtime, light management, stimulus control. Foundational for most conditions.' },
  { slug: 'low-fodmap', name: 'Low-FODMAP diet', kind: 'lifestyle', summary: 'Elimination diet commonly trialled for IBS.' },
  { slug: 'gluten-free', name: 'Gluten-free diet', kind: 'lifestyle', summary: "Mandatory for celiac; some report benefit for Hashimoto's and fibromyalgia." },
  { slug: 'autoimmune-protocol', name: 'AIP (Autoimmune Protocol)', kind: 'lifestyle', summary: 'Elimination-style diet often tried for autoimmune flares.' },
  { slug: 'pacing', name: 'Pacing', kind: 'lifestyle', summary: 'Energy management strategy for ME/CFS, long COVID, and chronic pain.' },
  { slug: 'vitamin-d', name: 'Vitamin D', kind: 'supplement', summary: 'Common deficiency affecting many conditions; dosage is individual.' },
  { slug: 'magnesium', name: 'Magnesium', kind: 'supplement', summary: 'Often used for sleep, migraine, fibromyalgia, and muscle tension.' },
  { slug: 'omega-3', name: 'Omega-3 (fish oil)', kind: 'supplement', summary: 'Anti-inflammatory; evidence for mood and cardiovascular outcomes.' },
  { slug: 'l-theanine', name: 'L-theanine', kind: 'supplement', summary: 'Calming amino acid from green tea; used for anxiety and sleep.' },
  { slug: 'melatonin', name: 'Melatonin', kind: 'supplement', summary: 'Sleep-timing hormone; low-dose often more effective than high-dose.' },
  { slug: 'saffron', name: 'Saffron extract', kind: 'supplement', summary: 'Herbal extract with growing evidence for mild-to-moderate depression.' },
  { slug: 'nac', name: 'N-Acetylcysteine (NAC)', kind: 'supplement', summary: 'Glutathione precursor used in OCD, trichotillomania, and bipolar.' },
  { slug: 'b-complex', name: 'B-complex vitamins', kind: 'supplement', summary: 'Especially B12/folate; matters for energy, mood, and methylation.' },
  { slug: 'light-therapy', name: 'Light therapy box', kind: 'device', summary: '10,000 lux morning exposure for seasonal depression and circadian disorders.' },
  { slug: 'tens', name: 'TENS unit', kind: 'device', summary: 'Transcutaneous electrical nerve stimulation for chronic pain.' },
  { slug: 'cpap', name: 'CPAP', kind: 'device', summary: 'Continuous Positive Airway Pressure device for sleep apnea.' },
  { slug: 'compression-garments', name: 'Compression garments', kind: 'device', summary: 'Used for POTS and circulatory support.' },
]

// ── Evidence baseline per condition ─────────────────────────────────────────
// Clinically-grounded reference values. Treatment slugs MUST match TREATMENTS
// above. Symptom / trigger / test names are free text and build the lexicon
// automatically (slugified).
const EVIDENCE: Record<string, ConditionEvidence> = {
  depression: {
    treatments: [
      ['cbt', 4.0, 'strong'], ['ssri-sertraline', 3.7, 'strong'], ['ssri-escitalopram', 3.8, 'strong'],
      ['bupropion', 3.6, 'strong'], ['walking', 3.6, 'strong'], ['strength-training', 3.5, 'moderate'],
      ['act', 3.5, 'moderate'], ['light-therapy', 3.2, 'moderate'], ['omega-3', 3.0, 'moderate'],
      ['saffron', 3.1, 'emerging'], ['meditation', 3.3, 'moderate'], ['psychodynamic', 3.2, 'moderate'],
    ],
    symptoms: [
      ['Low mood', 0.95], ['Loss of interest', 0.88], ['Fatigue', 0.84], ['Sleep disturbance', 0.80],
      ['Difficulty concentrating', 0.72], ['Appetite changes', 0.66], ['Feelings of worthlessness', 0.64],
      ['Hopelessness', 0.60], ['Irritability', 0.52],
    ],
    triggers: [
      ['Stress', 0.74], ['Poor sleep', 0.62], ['Isolation', 0.58], ['Grief or loss', 0.46], ['Seasonal change', 0.34],
    ],
    tests: [
      ['PHQ-9 questionnaire', 0.70], ['Thyroid panel (TSH)', 0.55], ['Vitamin D level', 0.44], ['Vitamin B12 / folate', 0.36],
    ],
  },
  anxiety: {
    treatments: [
      ['cbt', 4.1, 'strong'], ['ssri-escitalopram', 3.7, 'strong'], ['ssri-sertraline', 3.6, 'strong'],
      ['snri-venlafaxine', 3.5, 'strong'], ['act', 3.5, 'moderate'], ['meditation', 3.5, 'moderate'],
      ['walking', 3.3, 'moderate'], ['l-theanine', 2.9, 'emerging'], ['yoga', 3.2, 'moderate'],
      ['magnesium', 2.8, 'emerging'], ['propranolol', 3.0, 'moderate'],
    ],
    symptoms: [
      ['Excessive worry', 0.94], ['Restlessness', 0.78], ['Muscle tension', 0.74], ['Difficulty concentrating', 0.68],
      ['Sleep disturbance', 0.66], ['Irritability', 0.58], ['Racing heart', 0.54], ['Fatigue', 0.50],
    ],
    triggers: [
      ['Stress', 0.80], ['Caffeine', 0.52], ['Poor sleep', 0.50], ['Work pressure', 0.48], ['Uncertainty', 0.46],
    ],
    tests: [
      ['GAD-7 questionnaire', 0.72], ['Thyroid panel (TSH)', 0.48], ['ECG', 0.30],
    ],
  },
  ptsd: {
    treatments: [
      ['emdr', 4.0, 'strong'], ['cbt', 3.8, 'strong'], ['somatic-experiencing', 3.5, 'moderate'],
      ['ifs', 3.5, 'moderate'], ['prazosin', 3.4, 'moderate'], ['ssri-sertraline', 3.4, 'strong'],
      ['ssri-fluoxetine', 3.3, 'strong'], ['yoga', 3.2, 'moderate'], ['meditation', 3.0, 'moderate'],
    ],
    symptoms: [
      ['Flashbacks', 0.82], ['Nightmares', 0.78], ['Hypervigilance', 0.80], ['Avoidance', 0.76],
      ['Emotional numbness', 0.66], ['Intrusive thoughts', 0.74], ['Sleep disturbance', 0.72], ['Startle response', 0.62],
    ],
    triggers: [
      ['Reminders of trauma', 0.86], ['Stress', 0.60], ['Loud noises', 0.46], ['Poor sleep', 0.42], ['Crowds', 0.36],
    ],
    tests: [
      ['PCL-5 questionnaire', 0.68], ['Clinical interview (CAPS-5)', 0.40],
    ],
  },
  cptsd: {
    treatments: [
      ['ifs', 3.8, 'moderate'], ['dbt', 3.7, 'moderate'], ['emdr', 3.6, 'moderate'],
      ['somatic-experiencing', 3.6, 'moderate'], ['cbt', 3.4, 'moderate'], ['psychodynamic', 3.4, 'moderate'],
      ['yoga', 3.2, 'moderate'], ['meditation', 3.1, 'moderate'],
    ],
    symptoms: [
      ['Emotional dysregulation', 0.86], ['Negative self-concept', 0.82], ['Relationship difficulties', 0.80],
      ['Flashbacks', 0.70], ['Hypervigilance', 0.72], ['Dissociation', 0.64], ['Shame', 0.74], ['Sleep disturbance', 0.66],
    ],
    triggers: [
      ['Reminders of trauma', 0.78], ['Relationship conflict', 0.66], ['Stress', 0.60], ['Feeling trapped', 0.50],
    ],
    tests: [
      ['ITQ questionnaire', 0.52], ['Clinical interview', 0.44],
    ],
  },
  adhd: {
    treatments: [
      ['amphetamine', 4.4, 'strong'], ['methylphenidate', 4.3, 'strong'], ['atomoxetine', 3.4, 'strong'],
      ['guanfacine', 3.3, 'moderate'], ['cbt', 3.3, 'moderate'], ['strength-training', 3.1, 'moderate'],
      ['walking', 3.0, 'moderate'], ['omega-3', 2.8, 'emerging'], ['meditation', 2.9, 'emerging'],
    ],
    symptoms: [
      ['Inattention', 0.92], ['Difficulty focusing', 0.90], ['Procrastination', 0.84], ['Forgetfulness', 0.80],
      ['Impulsivity', 0.72], ['Restlessness', 0.66], ['Time blindness', 0.70], ['Emotional dysregulation', 0.64],
    ],
    triggers: [
      ['Boredom', 0.62], ['Poor sleep', 0.58], ['Unstructured time', 0.56], ['Overwhelm', 0.54], ['Stress', 0.48],
    ],
    tests: [
      ['ASRS screener', 0.66], ['Clinical interview', 0.58], ['Continuous performance test', 0.30],
    ],
  },
  autism: {
    treatments: [
      ['act', 3.3, 'moderate'], ['cbt', 3.2, 'moderate'], ['meditation', 3.0, 'emerging'],
      ['melatonin', 3.4, 'moderate'], ['ssri-sertraline', 2.9, 'moderate'], ['yoga', 3.0, 'emerging'],
    ],
    symptoms: [
      ['Sensory sensitivity', 0.86], ['Social communication differences', 0.84], ['Need for routine', 0.80],
      ['Overwhelm / shutdown', 0.72], ['Special interests', 0.78], ['Difficulty with change', 0.74], ['Sleep disturbance', 0.60],
    ],
    triggers: [
      ['Sensory overload', 0.82], ['Change in routine', 0.70], ['Social demands', 0.64], ['Bright lights or noise', 0.58],
    ],
    tests: [
      ['ADOS-2 assessment', 0.52], ['AQ questionnaire', 0.48], ['Developmental history', 0.46],
    ],
  },
  bipolar: {
    treatments: [
      ['lithium', 4.1, 'strong'], ['lamotrigine', 3.8, 'strong'], ['cbt', 3.3, 'moderate'],
      ['sleep-hygiene', 3.4, 'moderate'], ['omega-3', 2.9, 'emerging'], ['nac', 2.8, 'emerging'],
      ['walking', 3.0, 'moderate'],
    ],
    symptoms: [
      ['Mood swings', 0.92], ['Depressive episodes', 0.86], ['Elevated mood / mania', 0.78], ['Sleep changes', 0.80],
      ['Racing thoughts', 0.68], ['Impulsivity', 0.62], ['Irritability', 0.60], ['Fatigue', 0.56],
    ],
    triggers: [
      ['Sleep disruption', 0.74], ['Stress', 0.66], ['Seasonal change', 0.42], ['Substance use', 0.40],
    ],
    tests: [
      ['Mood chart', 0.56], ['Clinical interview', 0.50], ['Thyroid panel (TSH)', 0.34],
    ],
  },
  ocd: {
    treatments: [
      ['erp', 4.2, 'strong'], ['cbt', 3.7, 'strong'], ['ssri-fluoxetine', 3.5, 'strong'],
      ['ssri-sertraline', 3.5, 'strong'], ['act', 3.2, 'moderate'], ['nac', 2.8, 'emerging'], ['meditation', 2.9, 'emerging'],
    ],
    symptoms: [
      ['Intrusive thoughts', 0.92], ['Compulsions', 0.88], ['Checking behaviours', 0.70], ['Contamination fears', 0.58],
      ['Need for symmetry', 0.52], ['Reassurance seeking', 0.66], ['Mental rituals', 0.62],
    ],
    triggers: [
      ['Stress', 0.70], ['Uncertainty', 0.66], ['Fatigue', 0.46], ['Specific feared situations', 0.60],
    ],
    tests: [
      ['Y-BOCS scale', 0.62], ['Clinical interview', 0.48],
    ],
  },
  bpd: {
    treatments: [
      ['dbt', 4.1, 'strong'], ['ifs', 3.4, 'moderate'], ['psychodynamic', 3.4, 'moderate'],
      ['cbt', 3.2, 'moderate'], ['act', 3.1, 'moderate'], ['meditation', 3.0, 'emerging'],
    ],
    symptoms: [
      ['Emotional intensity', 0.92], ['Fear of abandonment', 0.84], ['Unstable relationships', 0.82],
      ['Identity disturbance', 0.72], ['Impulsivity', 0.70], ['Chronic emptiness', 0.66], ['Self-harm urges', 0.58], ['Dissociation', 0.52],
    ],
    triggers: [
      ['Perceived rejection', 0.80], ['Relationship conflict', 0.72], ['Stress', 0.58], ['Feeling criticised', 0.62],
    ],
    tests: [
      ['Clinical interview', 0.54], ['MSI-BPD screener', 0.42],
    ],
  },
  fibromyalgia: {
    treatments: [
      ['snri-duloxetine', 3.5, 'strong'], ['ldn', 3.4, 'moderate'], ['strength-training', 3.4, 'moderate'],
      ['cbt', 3.3, 'moderate'], ['pacing', 3.4, 'moderate'], ['magnesium', 2.9, 'emerging'],
      ['yoga', 3.2, 'moderate'], ['vitamin-d', 2.8, 'emerging'], ['tens', 3.0, 'moderate'], ['walking', 3.1, 'moderate'],
    ],
    symptoms: [
      ['Widespread pain', 0.96], ['Fatigue', 0.90], ['Sleep disturbance', 0.86], ['Brain fog', 0.80],
      ['Morning stiffness', 0.72], ['Headaches', 0.58], ['Sensitivity to touch', 0.66], ['Anxiety or low mood', 0.62],
    ],
    triggers: [
      ['Overexertion', 0.74], ['Poor sleep', 0.70], ['Stress', 0.68], ['Weather changes', 0.54], ['Cold', 0.40],
    ],
    tests: [
      ['Tender point exam', 0.50], ['Widespread Pain Index', 0.46], ['Bloodwork to rule out other causes', 0.60],
    ],
  },
  'chronic-pain': {
    treatments: [
      ['cbt', 3.5, 'moderate'], ['snri-duloxetine', 3.4, 'moderate'], ['strength-training', 3.4, 'moderate'],
      ['pacing', 3.4, 'moderate'], ['tens', 3.1, 'moderate'], ['act', 3.3, 'moderate'],
      ['yoga', 3.2, 'moderate'], ['walking', 3.2, 'moderate'], ['meditation', 3.1, 'moderate'], ['magnesium', 2.7, 'emerging'],
    ],
    symptoms: [
      ['Persistent pain', 0.96], ['Fatigue', 0.78], ['Sleep disturbance', 0.74], ['Reduced mobility', 0.70],
      ['Low mood', 0.64], ['Muscle tension', 0.62], ['Brain fog', 0.54],
    ],
    triggers: [
      ['Overexertion', 0.72], ['Stress', 0.66], ['Poor sleep', 0.60], ['Inactivity', 0.50], ['Weather changes', 0.46],
    ],
    tests: [
      ['Pain assessment scale', 0.56], ['Imaging (MRI / X-ray)', 0.50], ['Nerve conduction study', 0.24],
    ],
  },
  'me-cfs': {
    treatments: [
      ['pacing', 3.8, 'moderate'], ['ldn', 3.2, 'emerging'], ['vitamin-d', 2.7, 'emerging'],
      ['b-complex', 2.7, 'emerging'], ['magnesium', 2.7, 'emerging'], ['sleep-hygiene', 3.0, 'moderate'],
      ['compression-garments', 2.8, 'emerging'],
    ],
    symptoms: [
      ['Post-exertional malaise', 0.94], ['Severe fatigue', 0.96], ['Unrefreshing sleep', 0.86], ['Brain fog', 0.84],
      ['Orthostatic intolerance', 0.66], ['Muscle pain', 0.62], ['Sore throat / flu-like feelings', 0.48],
    ],
    triggers: [
      ['Overexertion', 0.88], ['Stress', 0.62], ['Poor sleep', 0.58], ['Infections', 0.50], ['Standing too long', 0.52],
    ],
    tests: [
      ['Symptom criteria assessment', 0.54], ['Bloodwork to rule out other causes', 0.62], ['Tilt table test', 0.26],
    ],
  },
  'long-covid': {
    treatments: [
      ['pacing', 3.7, 'moderate'], ['compression-garments', 3.0, 'emerging'], ['b-complex', 2.7, 'emerging'],
      ['vitamin-d', 2.7, 'emerging'], ['omega-3', 2.7, 'emerging'], ['sleep-hygiene', 3.0, 'moderate'], ['walking', 2.8, 'emerging'],
    ],
    symptoms: [
      ['Fatigue', 0.92], ['Post-exertional malaise', 0.78], ['Brain fog', 0.82], ['Breathlessness', 0.66],
      ['Heart palpitations', 0.58], ['Loss of smell or taste', 0.44], ['Sleep disturbance', 0.62], ['Headaches', 0.50],
    ],
    triggers: [
      ['Overexertion', 0.82], ['Stress', 0.56], ['Standing too long', 0.50], ['Poor sleep', 0.52],
    ],
    tests: [
      ['Symptom assessment', 0.52], ['Bloodwork', 0.50], ['Cardiopulmonary evaluation', 0.30],
    ],
  },
  migraine: {
    treatments: [
      ['cgrp-inhibitor', 4.0, 'strong'], ['triptan', 4.1, 'strong'], ['propranolol', 3.6, 'strong'],
      ['magnesium', 3.2, 'moderate'], ['sleep-hygiene', 3.2, 'moderate'], ['b-complex', 2.9, 'emerging'],
      ['cbt', 3.0, 'moderate'], ['yoga', 2.9, 'emerging'],
    ],
    symptoms: [
      ['Throbbing headache', 0.94], ['Light sensitivity', 0.86], ['Sound sensitivity', 0.80], ['Nausea', 0.74],
      ['Aura', 0.34], ['Visual disturbance', 0.40], ['Neck pain', 0.56], ['Fatigue after attack', 0.62],
    ],
    triggers: [
      ['Stress', 0.78], ['Poor sleep', 0.66], ['Hormonal changes', 0.52], ['Dehydration', 0.50],
      ['Bright lights', 0.46], ['Skipped meals', 0.44], ['Certain foods', 0.40], ['Weather changes', 0.42],
    ],
    tests: [
      ['Headache diary', 0.64], ['Neurological exam', 0.48], ['MRI (to rule out other causes)', 0.34],
    ],
  },
  endometriosis: {
    treatments: [
      ['cbt', 3.0, 'moderate'], ['pacing', 3.0, 'moderate'], ['tens', 3.1, 'moderate'],
      ['low-fodmap', 2.9, 'emerging'], ['yoga', 3.0, 'emerging'], ['magnesium', 2.7, 'emerging'], ['omega-3', 2.7, 'emerging'],
    ],
    symptoms: [
      ['Pelvic pain', 0.94], ['Painful periods', 0.90], ['Fatigue', 0.74], ['Pain during sex', 0.62],
      ['Bloating', 0.70], ['Heavy bleeding', 0.64], ['Bowel or bladder pain', 0.52], ['Infertility concerns', 0.44],
    ],
    triggers: [
      ['Menstrual cycle', 0.84], ['Stress', 0.54], ['Certain foods', 0.42], ['Overexertion', 0.40],
    ],
    tests: [
      ['Pelvic ultrasound', 0.60], ['Laparoscopy', 0.50], ['Pelvic exam', 0.46],
    ],
  },
  ibs: {
    treatments: [
      ['low-fodmap', 3.7, 'strong'], ['cbt', 3.4, 'strong'], ['peppermint-oil', 3.2, 'moderate'],
      ['meditation', 3.0, 'moderate'], ['yoga', 3.0, 'moderate'], ['ssri-sertraline', 2.9, 'moderate'], ['walking', 2.9, 'emerging'],
    ],
    symptoms: [
      ['Abdominal pain', 0.92], ['Bloating', 0.88], ['Altered bowel habits', 0.86], ['Diarrhea', 0.62],
      ['Constipation', 0.58], ['Urgency', 0.60], ['Cramping', 0.66], ['Fatigue', 0.48],
    ],
    triggers: [
      ['Certain foods', 0.82], ['Stress', 0.78], ['Caffeine', 0.46], ['Irregular meals', 0.44], ['Hormonal changes', 0.36],
    ],
    tests: [
      ['Symptom criteria (Rome IV)', 0.58], ['Bloodwork to rule out other causes', 0.56], ['Colonoscopy', 0.30],
    ],
  },
  crohns: {
    treatments: [
      ['autoimmune-protocol', 3.0, 'emerging'], ['low-fodmap', 3.0, 'moderate'], ['vitamin-d', 2.9, 'moderate'],
      ['omega-3', 2.7, 'emerging'], ['pacing', 2.8, 'emerging'], ['cbt', 2.9, 'moderate'],
    ],
    symptoms: [
      ['Abdominal pain', 0.90], ['Diarrhea', 0.84], ['Fatigue', 0.80], ['Weight loss', 0.58],
      ['Blood in stool', 0.50], ['Reduced appetite', 0.56], ['Mouth ulcers', 0.36], ['Joint pain', 0.44],
    ],
    triggers: [
      ['Stress', 0.62], ['Certain foods', 0.60], ['Infections', 0.40], ['Missed medication', 0.38], ['Smoking', 0.34],
    ],
    tests: [
      ['Colonoscopy', 0.74], ['Calprotectin stool test', 0.58], ['MRI enterography', 0.40], ['Bloodwork (CRP)', 0.56],
    ],
  },
  'ulcerative-colitis': {
    treatments: [
      ['low-fodmap', 3.0, 'moderate'], ['autoimmune-protocol', 2.9, 'emerging'], ['vitamin-d', 2.8, 'moderate'],
      ['omega-3', 2.7, 'emerging'], ['cbt', 2.9, 'moderate'], ['pacing', 2.8, 'emerging'],
    ],
    symptoms: [
      ['Bloody diarrhea', 0.86], ['Abdominal pain', 0.82], ['Urgency', 0.78], ['Fatigue', 0.74],
      ['Weight loss', 0.48], ['Reduced appetite', 0.52], ['Joint pain', 0.40],
    ],
    triggers: [
      ['Stress', 0.62], ['Certain foods', 0.56], ['Infections', 0.40], ['Missed medication', 0.42], ['NSAIDs', 0.34],
    ],
    tests: [
      ['Colonoscopy', 0.76], ['Calprotectin stool test', 0.58], ['Bloodwork (CRP)', 0.54],
    ],
  },
  hashimotos: {
    treatments: [
      ['levothyroxine', 4.0, 'strong'], ['gluten-free', 2.9, 'emerging'], ['vitamin-d', 2.9, 'moderate'],
      ['autoimmune-protocol', 2.8, 'emerging'], ['omega-3', 2.6, 'emerging'], ['b-complex', 2.6, 'emerging'],
    ],
    symptoms: [
      ['Fatigue', 0.88], ['Weight gain', 0.66], ['Cold intolerance', 0.62], ['Brain fog', 0.70],
      ['Hair loss', 0.58], ['Dry skin', 0.56], ['Low mood', 0.60], ['Constipation', 0.46],
    ],
    triggers: [
      ['Stress', 0.56], ['Iodine excess', 0.28], ['Poor sleep', 0.44], ['Infections', 0.34],
    ],
    tests: [
      ['TSH and free T4', 0.86], ['Thyroid antibodies (TPO)', 0.78], ['Thyroid ultrasound', 0.40],
    ],
  },
  'type-1-diabetes': {
    treatments: [
      ['strength-training', 3.2, 'moderate'], ['walking', 3.3, 'moderate'], ['cbt', 2.9, 'moderate'],
      ['sleep-hygiene', 2.8, 'emerging'], ['pacing', 2.6, 'emerging'],
    ],
    symptoms: [
      ['High blood sugar', 0.86], ['Frequent urination', 0.74], ['Excessive thirst', 0.72], ['Fatigue', 0.78],
      ['Blood sugar swings', 0.80], ['Blurred vision', 0.40], ['Unexpected weight loss', 0.44],
    ],
    triggers: [
      ['Missed insulin', 0.66], ['Illness', 0.58], ['Stress', 0.54], ['Carb-heavy meals', 0.56], ['Exercise timing', 0.42],
    ],
    tests: [
      ['HbA1c', 0.82], ['Continuous glucose monitor', 0.66], ['C-peptide', 0.36], ['Autoantibody panel', 0.40],
    ],
  },
  'type-2-diabetes': {
    treatments: [
      ['metformin', 4.0, 'strong'], ['walking', 3.7, 'strong'], ['strength-training', 3.6, 'strong'],
      ['low-fodmap', 2.6, 'emerging'], ['sleep-hygiene', 2.9, 'moderate'], ['cbt', 2.8, 'emerging'],
    ],
    symptoms: [
      ['High blood sugar', 0.84], ['Fatigue', 0.74], ['Frequent urination', 0.62], ['Excessive thirst', 0.58],
      ['Blurred vision', 0.40], ['Slow-healing wounds', 0.34], ['Numbness or tingling', 0.38],
    ],
    triggers: [
      ['Carb-heavy meals', 0.66], ['Inactivity', 0.60], ['Stress', 0.52], ['Poor sleep', 0.50], ['Illness', 0.40],
    ],
    tests: [
      ['HbA1c', 0.86], ['Fasting glucose', 0.70], ['Lipid panel', 0.50], ['Continuous glucose monitor', 0.40],
    ],
  },
  celiac: {
    treatments: [
      ['gluten-free', 4.5, 'strong'], ['vitamin-d', 3.0, 'moderate'], ['b-complex', 2.9, 'moderate'], ['omega-3', 2.5, 'emerging'],
    ],
    symptoms: [
      ['Bloating', 0.78], ['Diarrhea', 0.70], ['Abdominal pain', 0.72], ['Fatigue', 0.74],
      ['Nutrient deficiencies', 0.58], ['Brain fog', 0.54], ['Weight loss', 0.40], ['Skin rash', 0.30],
    ],
    triggers: [
      ['Gluten exposure', 0.94], ['Cross-contamination', 0.62], ['Eating out', 0.50],
    ],
    tests: [
      ['tTG-IgA antibody', 0.84], ['Small intestine biopsy', 0.62], ['Genetic test (HLA-DQ2/DQ8)', 0.40],
    ],
  },
  pots: {
    treatments: [
      ['compression-garments', 3.5, 'moderate'], ['propranolol', 3.3, 'moderate'], ['pacing', 3.3, 'moderate'],
      ['strength-training', 3.2, 'moderate'], ['magnesium', 2.6, 'emerging'], ['walking', 2.9, 'moderate'],
    ],
    symptoms: [
      ['Rapid heartbeat on standing', 0.92], ['Dizziness', 0.86], ['Fatigue', 0.84], ['Brain fog', 0.74],
      ['Lightheadedness', 0.78], ['Palpitations', 0.66], ['Exercise intolerance', 0.62], ['Fainting', 0.40],
    ],
    triggers: [
      ['Standing too long', 0.84], ['Heat', 0.66], ['Dehydration', 0.62], ['Large meals', 0.46], ['Poor sleep', 0.44],
    ],
    tests: [
      ['Tilt table test', 0.62], ['Active stand test', 0.58], ['Heart rate monitoring', 0.50],
    ],
  },
  eds: {
    treatments: [
      ['strength-training', 3.4, 'moderate'], ['pacing', 3.2, 'moderate'], ['compression-garments', 3.0, 'emerging'],
      ['cbt', 3.0, 'moderate'], ['tens', 3.0, 'moderate'], ['magnesium', 2.6, 'emerging'],
    ],
    symptoms: [
      ['Joint hypermobility', 0.92], ['Joint pain', 0.86], ['Frequent dislocations', 0.62], ['Fatigue', 0.78],
      ['Easy bruising', 0.58], ['Soft / stretchy skin', 0.56], ['Dizziness', 0.54], ['Digestive issues', 0.50],
    ],
    triggers: [
      ['Overexertion', 0.70], ['Repetitive movement', 0.56], ['Stress', 0.46], ['Poor sleep', 0.42],
    ],
    tests: [
      ['Beighton score', 0.66], ['Clinical assessment', 0.56], ['Genetic testing', 0.30],
    ],
  },
  hypothyroidism: {
    treatments: [
      ['levothyroxine', 4.2, 'strong'], ['vitamin-d', 2.7, 'emerging'], ['b-complex', 2.6, 'emerging'],
      ['strength-training', 2.8, 'emerging'], ['sleep-hygiene', 2.8, 'emerging'],
    ],
    symptoms: [
      ['Fatigue', 0.90], ['Weight gain', 0.66], ['Cold intolerance', 0.64], ['Brain fog', 0.66],
      ['Dry skin', 0.58], ['Hair thinning', 0.56], ['Constipation', 0.50], ['Low mood', 0.58],
    ],
    triggers: [
      ['Missed medication', 0.56], ['Stress', 0.44], ['Pregnancy', 0.26], ['Poor sleep', 0.40],
    ],
    tests: [
      ['TSH', 0.88], ['Free T4', 0.74], ['Free T3', 0.46], ['Thyroid antibodies', 0.44],
    ],
  },
  insomnia: {
    treatments: [
      ['cbt-i', 4.3, 'strong'], ['sleep-hygiene', 3.6, 'strong'], ['melatonin', 3.2, 'moderate'],
      ['magnesium', 2.9, 'emerging'], ['l-theanine', 2.8, 'emerging'], ['meditation', 3.1, 'moderate'], ['walking', 3.0, 'moderate'],
    ],
    symptoms: [
      ['Difficulty falling asleep', 0.90], ['Waking during the night', 0.84], ['Early waking', 0.66], ['Daytime fatigue', 0.86],
      ['Difficulty concentrating', 0.70], ['Irritability', 0.62], ['Racing mind at night', 0.74],
    ],
    triggers: [
      ['Stress', 0.78], ['Screen time before bed', 0.58], ['Caffeine', 0.56], ['Irregular schedule', 0.52], ['Anxiety', 0.62],
    ],
    tests: [
      ['Sleep diary', 0.64], ['Insomnia Severity Index', 0.52], ['Sleep study', 0.24],
    ],
  },
  sad: {
    treatments: [
      ['light-therapy', 4.1, 'strong'], ['cbt', 3.6, 'strong'], ['walking', 3.3, 'moderate'],
      ['vitamin-d', 3.0, 'moderate'], ['ssri-sertraline', 3.3, 'moderate'], ['bupropion', 3.2, 'moderate'],
    ],
    symptoms: [
      ['Low mood in winter', 0.92], ['Low energy', 0.84], ['Oversleeping', 0.70], ['Carbohydrate cravings', 0.62],
      ['Loss of interest', 0.72], ['Difficulty concentrating', 0.60], ['Social withdrawal', 0.58],
    ],
    triggers: [
      ['Shorter daylight', 0.88], ['Seasonal change', 0.74], ['Cold weather', 0.50], ['Reduced sun exposure', 0.66],
    ],
    tests: [
      ['Seasonal pattern assessment', 0.58], ['PHQ-9 questionnaire', 0.48], ['Vitamin D level', 0.42],
    ],
  },
  'chronic-lyme': {
    treatments: [
      ['pacing', 3.2, 'emerging'], ['ldn', 3.0, 'emerging'], ['vitamin-d', 2.6, 'emerging'],
      ['omega-3', 2.5, 'emerging'], ['b-complex', 2.5, 'emerging'], ['cbt', 2.8, 'emerging'],
    ],
    symptoms: [
      ['Fatigue', 0.90], ['Joint pain', 0.78], ['Brain fog', 0.80], ['Muscle aches', 0.68],
      ['Sleep disturbance', 0.62], ['Headaches', 0.56], ['Nerve pain', 0.50], ['Low mood', 0.54],
    ],
    triggers: [
      ['Overexertion', 0.70], ['Stress', 0.60], ['Poor sleep', 0.52], ['Infections', 0.40],
    ],
    tests: [
      ['Lyme serology (ELISA/Western blot)', 0.56], ['Clinical assessment', 0.50],
    ],
  },
  'panic-disorder': {
    treatments: [
      ['cbt', 4.1, 'strong'], ['ssri-sertraline', 3.6, 'strong'], ['ssri-escitalopram', 3.6, 'strong'],
      ['snri-venlafaxine', 3.4, 'moderate'], ['meditation', 3.2, 'moderate'], ['act', 3.2, 'moderate'],
      ['propranolol', 3.0, 'moderate'], ['yoga', 3.0, 'moderate'],
    ],
    symptoms: [
      ['Panic attacks', 0.94], ['Racing heart', 0.86], ['Shortness of breath', 0.78], ['Fear of losing control', 0.74],
      ['Dizziness', 0.66], ['Chest tightness', 0.62], ['Sweating', 0.58], ['Fear of future attacks', 0.80],
    ],
    triggers: [
      ['Stress', 0.70], ['Caffeine', 0.54], ['Crowded places', 0.50], ['Physical sensations', 0.56], ['Poor sleep', 0.44],
    ],
    tests: [
      ['Clinical interview', 0.56], ['ECG (to rule out cardiac causes)', 0.40], ['Thyroid panel (TSH)', 0.30],
    ],
  },
  'social-anxiety': {
    treatments: [
      ['cbt', 4.1, 'strong'], ['ssri-escitalopram', 3.6, 'strong'], ['ssri-sertraline', 3.5, 'strong'],
      ['act', 3.3, 'moderate'], ['propranolol', 3.2, 'moderate'], ['meditation', 3.0, 'moderate'], ['yoga', 2.9, 'emerging'],
    ],
    symptoms: [
      ['Fear of judgement', 0.92], ['Avoidance of social situations', 0.84], ['Blushing or sweating', 0.62],
      ['Racing heart', 0.66], ['Anticipatory anxiety', 0.80], ['Self-consciousness', 0.78], ['Difficulty speaking up', 0.70],
    ],
    triggers: [
      ['Public speaking', 0.78], ['Meeting new people', 0.70], ['Being observed', 0.64], ['Conflict', 0.50], ['Stress', 0.46],
    ],
    tests: [
      ['Liebowitz Social Anxiety Scale', 0.56], ['Clinical interview', 0.48],
    ],
  },
}

const TIER_WEIGHT: Record<EvidenceTier, number> = { strong: 6, moderate: 4, emerging: 2 }

// ── Africa / South Africa-prevalent conditions ──────────────────────────────
// Authored + adversarially clinical-safety-verified via a multi-agent workflow
// (scripts/seed-data/africa-conditions.json is the verified output). Merged here
// so the directory covers the region's real disease burden (HIV, TB, hypertension,
// malaria, sickle cell, etc.) on top of the base set.
type AfricaTreatment = { slug: string; name: string; kind: string; summary: string }
type AfricaEvTreatment = { slug: string; effectiveness: number; tier: EvidenceTier }
type AfricaPrev = { name: string; prevalence: number }
type AfricaCondition = {
  slug: string
  name: string
  category: string
  aliases: string[]
  summary: string
  evidence: { treatments: AfricaEvTreatment[]; symptoms: AfricaPrev[]; triggers: AfricaPrev[]; tests: AfricaPrev[] }
}

function mergeAfricaConditions(): void {
  const path = join(process.cwd(), 'scripts', 'seed-data', 'africa-conditions.json')
  let data: { newTreatments: AfricaTreatment[]; conditions: AfricaCondition[] }
  try {
    data = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    console.warn('⚠ scripts/seed-data/africa-conditions.json not found — skipping Africa set')
    return
  }

  // Only add new treatments that a condition actually references (no orphan lexicon).
  const referenced = new Set<string>()
  for (const c of data.conditions) for (const t of c.evidence.treatments) referenced.add(t.slug)

  const treatmentSlugs = new Set(TREATMENTS.map((t) => t.slug))
  for (const t of data.newTreatments) {
    if (treatmentSlugs.has(t.slug) || !referenced.has(t.slug)) continue
    const kind = (['medication', 'therapy', 'lifestyle', 'supplement', 'device', 'procedure'] as const).includes(
      t.kind as TreatmentKind,
    )
      ? (t.kind as TreatmentKind)
      : 'medication'
    TREATMENTS.push({ slug: t.slug, name: t.name, kind, summary: t.summary })
    treatmentSlugs.add(t.slug)
  }

  const conditionSlugs = new Set(CONDITIONS.map((c) => c.slug))
  for (const c of data.conditions) {
    if (!conditionSlugs.has(c.slug)) {
      CONDITIONS.push({
        slug: c.slug,
        name: c.name,
        category: c.category as ConditionCategory,
        aliases: c.aliases,
        summary: c.summary,
      })
      conditionSlugs.add(c.slug)
    }
    EVIDENCE[c.slug] = {
      treatments: c.evidence.treatments.map((t) => [t.slug, t.effectiveness, t.tier] as TreatmentEvidence),
      symptoms: c.evidence.symptoms.map((s) => [s.name, s.prevalence] as Prevalence),
      triggers: c.evidence.triggers.map((s) => [s.name, s.prevalence] as Prevalence),
      tests: c.evidence.tests.map((s) => [s.name, s.prevalence] as Prevalence),
    }
  }
}

mergeAfricaConditions()

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const esc = (value: string) => value.replace(/'/g, "''")
const TS = '(unixepoch() * 1000)'

function buildSql(): string {
  const lines: string[] = [
    '-- KinSpace D1 seed: conditions + treatments knowledge base',
    '-- + clinically-grounded evidence baseline (effectiveness, symptom/trigger/test prevalence).',
    '-- Re-runnable: every insert is INSERT OR IGNORE / upsert-safe.',
    '',
  ]

  // Conditions
  for (const c of CONDITIONS) {
    const aliases = esc(JSON.stringify(c.aliases))
    lines.push(
      `INSERT OR IGNORE INTO conditions (slug, name, aliases, description, category, created_at, updated_at) ` +
        `VALUES ('${esc(c.slug)}', '${esc(c.name)}', '${aliases}', '${esc(c.summary)}', '${esc(c.category)}', ${TS}, ${TS});`,
    )
  }
  lines.push('')

  // Treatments lexicon
  const treatmentSlugs = new Set(TREATMENTS.map((t) => t.slug))
  for (const t of TREATMENTS) {
    lines.push(
      `INSERT OR IGNORE INTO treatments (slug, name, kind, description, created_at, updated_at) ` +
        `VALUES ('${esc(t.slug)}', '${esc(t.name)}', '${esc(t.kind)}', '${esc(t.summary)}', ${TS}, ${TS});`,
    )
  }
  lines.push('')

  // Collect lexicon entries (symptoms / triggers / tests) from the evidence map.
  const symptomNames = new Map<string, string>()
  const triggerNames = new Map<string, string>()
  const testNames = new Map<string, string>()
  const register = (map: Map<string, string>, name: string) => {
    const s = slugify(name)
    if (s && !map.has(s)) map.set(s, name)
  }

  // Treatments referenced in evidence but missing from the lexicon (e.g. peppermint oil)
  const extraTreatments = new Map<string, string>()

  for (const ev of Object.values(EVIDENCE)) {
    for (const [tslug] of ev.treatments) {
      if (!treatmentSlugs.has(tslug)) extraTreatments.set(tslug, tslug)
    }
    for (const [name] of ev.symptoms) register(symptomNames, name)
    for (const [name] of ev.triggers) register(triggerNames, name)
    for (const [name] of ev.tests) register(testNames, name)
  }

  // Friendly names for ad-hoc treatment slugs that aren't in the main lexicon.
  const EXTRA_TREATMENT_NAMES: Record<string, { name: string; kind: string }> = {
    'peppermint-oil': { name: 'Peppermint oil', kind: 'supplement' },
  }
  for (const tslug of extraTreatments.keys()) {
    const meta = EXTRA_TREATMENT_NAMES[tslug] ?? { name: tslug.replace(/-/g, ' '), kind: 'supplement' }
    lines.push(
      `INSERT OR IGNORE INTO treatments (slug, name, kind, description, created_at, updated_at) ` +
        `VALUES ('${esc(tslug)}', '${esc(meta.name)}', '${esc(meta.kind)}', '', ${TS}, ${TS});`,
    )
  }
  if (extraTreatments.size) lines.push('')

  for (const [slug, name] of symptomNames)
    lines.push(`INSERT OR IGNORE INTO symptoms (slug, name, created_at) VALUES ('${esc(slug)}', '${esc(name)}', ${TS});`)
  lines.push('')
  for (const [slug, name] of triggerNames)
    lines.push(`INSERT OR IGNORE INTO triggers (slug, name, created_at) VALUES ('${esc(slug)}', '${esc(name)}', ${TS});`)
  lines.push('')
  for (const [slug, name] of testNames)
    lines.push(`INSERT OR IGNORE INTO tests (slug, name, created_at) VALUES ('${esc(slug)}', '${esc(name)}', ${TS});`)
  lines.push('')

  // Evidence baselines per condition.
  // NOTE: these tables use an app-generated text `id` primary key (pk() with a
  // JS $defaultFn, NOT a SQL default), so raw-SQL inserts MUST supply `id`. We
  // build deterministic ids from the slug pair — unique by construction and
  // idempotent across re-runs (the unique indexes also guard duplicates).
  let treatLinks = 0
  let symptomLinks = 0
  for (const [conditionSlug, ev] of Object.entries(EVIDENCE)) {
    for (const [tslug, effectiveness, tier] of ev.treatments) {
      const weight = TIER_WEIGHT[tier]
      const id = `ct-${conditionSlug}-${tslug}`
      lines.push(
        `INSERT OR IGNORE INTO condition_treatments (id, condition_slug, treatment_slug, effectiveness_avg, effectiveness_count, created_at, updated_at) ` +
          `VALUES ('${esc(id)}', '${esc(conditionSlug)}', '${esc(tslug)}', ${effectiveness}, ${weight}, ${TS}, ${TS});`,
      )
      treatLinks++
    }
    for (const [name, prevalence] of ev.symptoms) {
      const s = slugify(name)
      lines.push(
        `INSERT OR IGNORE INTO condition_symptoms (id, condition_slug, symptom_slug, prevalence) ` +
          `VALUES ('cs-${esc(conditionSlug)}-${esc(s)}', '${esc(conditionSlug)}', '${esc(s)}', ${prevalence});`,
      )
      symptomLinks++
    }
    for (const [name, prevalence] of ev.triggers) {
      const s = slugify(name)
      lines.push(
        `INSERT OR IGNORE INTO condition_triggers (id, condition_slug, trigger_slug, prevalence) ` +
          `VALUES ('ctr-${esc(conditionSlug)}-${esc(s)}', '${esc(conditionSlug)}', '${esc(s)}', ${prevalence});`,
      )
    }
    for (const [name, prevalence] of ev.tests) {
      const s = slugify(name)
      lines.push(
        `INSERT OR IGNORE INTO condition_tests (id, condition_slug, test_slug, prevalence) ` +
          `VALUES ('cte-${esc(conditionSlug)}-${esc(s)}', '${esc(conditionSlug)}', '${esc(s)}', ${prevalence});`,
      )
    }
    lines.push('')
  }

  lines.push(
    `-- Summary: ${CONDITIONS.length} conditions, ${TREATMENTS.length} treatments, ` +
      `${treatLinks} treatment links, ${symptomNames.size} symptoms, ${triggerNames.size} triggers, ${testNames.size} tests.`,
  )

  return lines.join('\n')
}

const outDir = join(process.cwd(), 'drizzle')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, 'seed.sql')
writeFileSync(outPath, buildSql(), 'utf8')

const evidenceConditions = Object.keys(EVIDENCE).length
console.log(`✓ Wrote ${CONDITIONS.length} conditions + ${TREATMENTS.length} treatments to drizzle/seed.sql`)
console.log(`✓ Evidence baseline for ${evidenceConditions} conditions (treatments + symptoms + triggers + tests)`)
console.log('Apply with: npm run db:seed:local   (local)   or   npm run db:seed   (remote)')
