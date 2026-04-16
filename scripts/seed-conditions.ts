/**
 * Idempotent seeding script for KinSpace conditions/treatments/symptoms.
 * Uses firebase-admin — requires FIREBASE_SERVICE_ACCOUNT_JSON (preferred) or
 * FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY in .env.local.
 *
 * Run: npm run seed
 */

import { config as loadEnv } from 'dotenv'
import { getAdminDb, isAdminConfigured } from '../src/lib/server/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

loadEnv({ path: '.env.local' })
loadEnv() // fallback to .env

type SeedCondition = {
  slug: string
  name: string
  category: 'mental' | 'chronic' | 'autoimmune' | 'neurological' | 'pain' | 'metabolic' | 'sleep'
  aliases: string[]
  summary: string
}

type SeedTreatment = {
  slug: string
  name: string
  kind: 'medication' | 'therapy' | 'lifestyle' | 'supplement' | 'device'
  summary: string
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
  { slug: 'hashimotos', name: "Hashimoto's", category: 'autoimmune', aliases: ['Autoimmune Thyroiditis'], summary: "Autoimmune attack on the thyroid, often leading to hypothyroidism with fatigue, weight changes, and cognitive slowing." },
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
  { slug: 'social-anxiety', name: 'Social Anxiety', category: 'mental', aliases: ['Social Phobia', 'SAD'], summary: 'Significant fear of social situations and being judged, leading to avoidance that interferes with life.' },
]

const TREATMENTS: SeedTreatment[] = [
  // Medications
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

  // Therapies
  { slug: 'cbt', name: 'CBT', kind: 'therapy', summary: 'Cognitive Behavioural Therapy — structured short-to-medium term therapy with strong evidence for depression, anxiety, and many other conditions.' },
  { slug: 'dbt', name: 'DBT', kind: 'therapy', summary: 'Dialectical Behaviour Therapy — skills-based approach originally developed for BPD, useful broadly for emotional regulation.' },
  { slug: 'emdr', name: 'EMDR', kind: 'therapy', summary: 'Eye Movement Desensitization and Reprocessing — evidence-based trauma therapy.' },
  { slug: 'ifs', name: 'IFS', kind: 'therapy', summary: 'Internal Family Systems — parts-based therapy for trauma, self-compassion, and emotional integration.' },
  { slug: 'somatic-experiencing', name: 'Somatic Experiencing', kind: 'therapy', summary: 'Body-based trauma therapy that focuses on nervous system regulation.' },
  { slug: 'act', name: 'ACT', kind: 'therapy', summary: 'Acceptance and Commitment Therapy — mindfulness-plus-values approach.' },
  { slug: 'erp', name: 'ERP for OCD', kind: 'therapy', summary: 'Exposure and Response Prevention — gold-standard therapy for OCD.' },
  { slug: 'psychodynamic', name: 'Psychodynamic therapy', kind: 'therapy', summary: 'Depth-oriented exploration of patterns and early relationships.' },

  // Lifestyle / mind-body
  { slug: 'meditation', name: 'Meditation practice', kind: 'lifestyle', summary: 'Consistent mindfulness or concentration practice; many evidence-based forms.' },
  { slug: 'yoga', name: 'Yoga', kind: 'lifestyle', summary: 'Gentle movement + breath. Research support for depression, anxiety, chronic pain.' },
  { slug: 'walking', name: 'Daily walks', kind: 'lifestyle', summary: 'Simple, repeatable movement that compounds; strong evidence across mood and metabolic conditions.' },
  { slug: 'strength-training', name: 'Strength training', kind: 'lifestyle', summary: 'Progressive resistance work — depression, diabetes, and chronic pain benefit.' },
  { slug: 'cold-exposure', name: 'Cold exposure', kind: 'lifestyle', summary: 'Short cold showers or plunges; reported benefits for mood and inflammation (research is early).' },
  { slug: 'sleep-hygiene', name: 'Sleep hygiene', kind: 'lifestyle', summary: 'Consistent bedtime, light management, stimulus control. Foundational for most conditions.' },
  { slug: 'cbt-i', name: 'CBT-I', kind: 'therapy', summary: 'Cognitive Behavioural Therapy for Insomnia — first-line for chronic insomnia.' },
  { slug: 'low-fodmap', name: 'Low-FODMAP diet', kind: 'lifestyle', summary: 'Elimination diet commonly trialled for IBS.' },
  { slug: 'gluten-free', name: 'Gluten-free diet', kind: 'lifestyle', summary: 'Mandatory for celiac; some report benefit for Hashimoto\'s and fibromyalgia.' },
  { slug: 'autoimmune-protocol', name: 'AIP (Autoimmune Protocol)', kind: 'lifestyle', summary: 'Elimination-style diet often tried for autoimmune flares.' },
  { slug: 'pacing', name: 'Pacing', kind: 'lifestyle', summary: 'Energy management strategy for ME/CFS, long COVID, and chronic pain.' },

  // Supplements
  { slug: 'vitamin-d', name: 'Vitamin D', kind: 'supplement', summary: 'Common deficiency affecting many conditions; dosage is individual.' },
  { slug: 'magnesium', name: 'Magnesium', kind: 'supplement', summary: 'Often used for sleep, migraine, fibromyalgia, and muscle tension.' },
  { slug: 'omega-3', name: 'Omega-3 (fish oil)', kind: 'supplement', summary: 'Anti-inflammatory; evidence for mood and cardiovascular outcomes.' },
  { slug: 'l-theanine', name: 'L-theanine', kind: 'supplement', summary: 'Calming amino acid from green tea; used for anxiety and sleep.' },
  { slug: 'melatonin', name: 'Melatonin', kind: 'supplement', summary: 'Sleep-timing hormone; low-dose often more effective than high-dose.' },
  { slug: 'saffron', name: 'Saffron extract', kind: 'supplement', summary: 'Herbal extract with growing evidence for mild-to-moderate depression.' },
  { slug: 'nac', name: 'N-Acetylcysteine (NAC)', kind: 'supplement', summary: 'Glutathione precursor used in OCD, trichotillomania, and bipolar.' },
  { slug: 'b-complex', name: 'B-complex vitamins', kind: 'supplement', summary: 'Especially B12/folate; matters for energy, mood, and methylation.' },

  // Devices
  { slug: 'light-therapy', name: 'Light therapy box', kind: 'device', summary: '10,000 lux morning exposure for seasonal depression and circadian disorders.' },
  { slug: 'tens', name: 'TENS unit', kind: 'device', summary: 'Transcutaneous electrical nerve stimulation for chronic pain.' },
  { slug: 'cpap', name: 'CPAP', kind: 'device', summary: 'Continuous Positive Airway Pressure device for sleep apnea.' },
  { slug: 'compression-garments', name: 'Compression garments', kind: 'device', summary: 'Used for POTS and circulatory support.' },
]

async function run() {
  if (!isAdminConfigured()) {
    console.error('❌ Firebase Admin is not configured.')
    console.error('Set FIREBASE_SERVICE_ACCOUNT_JSON in .env.local (paste the whole service account JSON as one line).')
    console.error('Or set FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.')
    process.exit(1)
  }

  const db = getAdminDb()
  const now = FieldValue.serverTimestamp()

  console.log(`Seeding ${CONDITIONS.length} conditions...`)
  for (const condition of CONDITIONS) {
    const ref = db.collection('conditions').doc(condition.slug)
    const snap = await ref.get()
    if (snap.exists) {
      console.log(`  • ${condition.name} — already exists, skipping`)
      continue
    }
    await ref.set({
      name: condition.name,
      slug: condition.slug,
      category: condition.category,
      aliases: condition.aliases,
      summary: condition.summary,
      member_count: 0,
      created_at: now,
      updated_at: now,
    })
    console.log(`  ✓ ${condition.name}`)
  }

  console.log(`\nSeeding ${TREATMENTS.length} treatments...`)
  for (const treatment of TREATMENTS) {
    const ref = db.collection('treatments').doc(treatment.slug)
    const snap = await ref.get()
    if (snap.exists) {
      console.log(`  • ${treatment.name} — already exists, skipping`)
      continue
    }
    await ref.set({
      name: treatment.name,
      slug: treatment.slug,
      kind: treatment.kind,
      summary: treatment.summary,
      warnings: [],
      status: 'approved',
      submitted_by: 'system',
      created_at: now,
    })
    console.log(`  ✓ ${treatment.name}`)
  }

  console.log('\n✅ Seed complete.')
}

run().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
