// Authoritative, free drug-fact grounding for the medication shelf.
//
// Pipeline: RxNorm (normalize an OCR'd name -> RXCUI) -> openFDA drug label
// (official boxed warning + label sections) -> openFDA FAERS (patient-reported
// reactions, structured counts) -> MedlinePlus Connect (plain-language link).
//
// All sources are free and US-government / NLM. openFDA works keyless at
// 1,000 req/day per IP; set OPENFDA_API_KEY (a free key) to lift it to
// 120,000/day. Caching is in-memory per-isolate only — never KV — so this adds
// zero KV writes. Best-effort throughout: any source can fail without breaking
// medication identification.

const TIMEOUT_MS = 8_000
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export type DrugFactSource = {
  title: string
  url: string
  kind: 'fda' | 'medlineplus' | 'rxnorm'
}

export type DrugFacts = {
  rxcui: string | null
  matched_name: string | null
  boxed_warning: string | null
  /** Patient-reported reactions from openFDA FAERS — unverified, no causation. */
  patient_reported_reactions: Array<{ term: string; count: number }>
  medlineplus_url: string | null
  sources: DrugFactSource[]
}

const cache = new Map<string, { value: DrugFacts | null; expires: number }>()

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'KinSpace/1.0 (health support app)' },
      signal: controller.signal,
    })
    if (!response.ok) return null
    return (await response.json()) as Record<string, unknown>
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function fdaKeyParam(): string {
  const key = process.env.OPENFDA_API_KEY
  return key ? `&api_key=${encodeURIComponent(key)}` : ''
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

function firstString(value: unknown): string | null {
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim() || null
  if (typeof value === 'string') return value.trim() || null
  return null
}

async function resolveRxcui(name: string): Promise<{ rxcui: string; matched: string } | null> {
  const data = await getJson(
    `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(name)}&maxEntries=1`,
  )
  const group = data?.approximateGroup as { candidate?: Array<{ rxcui?: string; name?: string }> } | undefined
  const candidate = group?.candidate?.[0]
  if (candidate?.rxcui) return { rxcui: candidate.rxcui, matched: candidate.name ?? name }
  return null
}

async function fetchLabelBoxedWarning(rxcui: string, name: string): Promise<string | null> {
  const key = fdaKeyParam()
  let data = await getJson(
    `https://api.fda.gov/drug/label.json?search=openfda.rxcui:"${encodeURIComponent(rxcui)}"&limit=1${key}`,
  )
  let result = (data?.results as Array<Record<string, unknown>> | undefined)?.[0]
  if (!result && name) {
    data = await getJson(
      `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(name)}"&limit=1${key}`,
    )
    result = (data?.results as Array<Record<string, unknown>> | undefined)?.[0]
  }
  if (!result) return null
  const boxed = firstString(result.boxed_warning) ?? firstString(result.warnings)
  if (!boxed) return null
  // These label fields are long prose — keep a readable lead.
  return boxed.replace(/\s+/g, ' ').trim().slice(0, 600)
}

async function fetchFaersReactions(rxcui: string): Promise<Array<{ term: string; count: number }>> {
  const key = fdaKeyParam()
  const data = await getJson(
    `https://api.fda.gov/drug/event.json?search=patient.drug.openfda.rxcui:"${encodeURIComponent(rxcui)}"&count=patient.reaction.reactionmeddrapt.exact${key}`,
  )
  const results = data?.results as Array<{ term?: string; count?: number }> | undefined
  if (!Array.isArray(results)) return []
  return results
    .slice(0, 8)
    .map((row) => ({ term: titleCase(String(row.term ?? '')), count: Number(row.count ?? 0) }))
    .filter((row) => row.term && row.count > 0)
}

async function fetchMedlinePlusUrl(rxcui: string): Promise<string | null> {
  // RxNorm code system OID is 2.16.840.1.113883.6.88.
  const data = await getJson(
    `https://connect.medlineplus.gov/service?mainSearchCriteria.v.cs=2.16.840.1.113883.6.88&mainSearchCriteria.v.c=${encodeURIComponent(rxcui)}&knowledgeResponseType=application/json`,
  )
  const feed = data?.feed as { entry?: Array<{ link?: Array<{ href?: string }> }> } | undefined
  const entry = feed?.entry?.[0]
  const href = entry?.link?.find((link) => link.href)?.href
  return href ?? null
}

/**
 * Best-effort authoritative facts for a medication name (brand or generic).
 * Returns null only if the name can't be normalized to an RxNorm concept.
 */
export async function getDrugFacts(name: string): Promise<DrugFacts | null> {
  const cleaned = String(name ?? '').trim()
  if (!cleaned || cleaned.toLowerCase() === 'unidentified medication') return null

  const cacheKey = cleaned.toLowerCase()
  const hit = cache.get(cacheKey)
  if (hit && hit.expires > Date.now()) return hit.value

  const resolved = await resolveRxcui(cleaned)
  if (!resolved) {
    cache.set(cacheKey, { value: null, expires: Date.now() + CACHE_TTL_MS })
    return null
  }

  const [boxedWarning, reactions, medlineplusUrl] = await Promise.all([
    fetchLabelBoxedWarning(resolved.rxcui, resolved.matched),
    fetchFaersReactions(resolved.rxcui),
    fetchMedlinePlusUrl(resolved.rxcui),
  ])

  const sources: DrugFactSource[] = [
    { title: 'RxNorm (NIH/NLM)', url: 'https://www.nlm.nih.gov/research/umls/rxnorm/', kind: 'rxnorm' },
  ]
  if (boxedWarning || reactions.length > 0) {
    sources.push({ title: 'U.S. FDA drug labeling & FAERS', url: 'https://open.fda.gov/', kind: 'fda' })
  }
  if (medlineplusUrl) sources.push({ title: 'MedlinePlus (NIH/NLM)', url: medlineplusUrl, kind: 'medlineplus' })

  const facts: DrugFacts = {
    rxcui: resolved.rxcui,
    matched_name: resolved.matched,
    boxed_warning: boxedWarning,
    patient_reported_reactions: reactions,
    medlineplus_url: medlineplusUrl,
    sources,
  }
  cache.set(cacheKey, { value: facts, expires: Date.now() + CACHE_TTL_MS })
  return facts
}
