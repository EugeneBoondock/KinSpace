// Free, authoritative biomedical literature retrieval for Ask + Research.
//
// Europe PMC (keyless, JSON, abstracts inline in one call) is the backbone — it
// unifies PubMed + preprints. ClinicalTrials.gov API v2 (keyless) adds the
// "what's being studied" angle. Both are free with no API key. In-memory cache
// only (per-isolate) — never KV — so this adds zero KV writes.

const TIMEOUT_MS = 10_000
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

export type LiteratureKind = 'journal' | 'preprint' | 'trial'

export type LiteratureSource = {
  title: string
  url: string
  domain: string
  snippet: string
  kind: LiteratureKind
  citation: string
}

const cache = new Map<string, { value: LiteratureSource[]; expires: number }>()

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

function clean(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type EpmcResult = {
  id?: string
  source?: string
  pmid?: string
  doi?: string
  title?: string
  authorString?: string
  journalTitle?: string
  journalInfo?: { journal?: { title?: string } }
  pubYear?: string
  abstractText?: string
}

async function searchEuropePmc(query: string, max: number): Promise<LiteratureSource[]> {
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(
    query,
  )}&format=json&resultType=core&pageSize=${max}`
  const data = await getJson(url)
  const list = (data?.resultList as { result?: EpmcResult[] } | undefined)?.result
  if (!Array.isArray(list)) return []
  return list
    .map((r): LiteratureSource | null => {
      const title = r.title ? clean(r.title) : ''
      if (!title) return null
      const source = r.source ?? 'MED'
      const id = r.id ?? r.pmid ?? ''
      const isPreprint = source === 'PPR'
      const journal = r.journalInfo?.journal?.title ?? r.journalTitle ?? (isPreprint ? 'Preprint' : '')
      const year = r.pubYear ?? ''
      const abstract = r.abstractText ? clean(r.abstractText).slice(0, 1200) : ''
      const articleUrl =
        id && source
          ? `https://europepmc.org/article/${source}/${id}`
          : r.doi
            ? `https://doi.org/${r.doi}`
            : 'https://europepmc.org'
      return {
        title,
        url: articleUrl,
        domain: 'europepmc.org',
        snippet: abstract || title,
        kind: isPreprint ? 'preprint' : 'journal',
        citation: [r.authorString, title, journal, year].filter(Boolean).join('. ').slice(0, 300),
      }
    })
    .filter((row): row is LiteratureSource => row !== null)
}

type TrialStudy = {
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string }
    statusModule?: { overallStatus?: string }
  }
}

async function searchTrials(query: string, max: number): Promise<LiteratureSource[]> {
  const fields =
    'protocolSection.identificationModule.nctId,protocolSection.identificationModule.briefTitle,protocolSection.statusModule.overallStatus'
  const url = `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(
    query,
  )}&pageSize=${max}&format=json&fields=${encodeURIComponent(fields)}`
  const data = await getJson(url)
  const studies = data?.studies as TrialStudy[] | undefined
  if (!Array.isArray(studies)) return []
  return studies
    .map((study): LiteratureSource | null => {
      const ident = study.protocolSection?.identificationModule
      const nct = ident?.nctId ?? ''
      const title = ident?.briefTitle ? clean(ident.briefTitle) : ''
      if (!title) return null
      const status = study.protocolSection?.statusModule?.overallStatus ?? ''
      return {
        title,
        url: nct ? `https://clinicaltrials.gov/study/${nct}` : 'https://clinicaltrials.gov',
        domain: 'clinicaltrials.gov',
        snippet: `Clinical trial${status ? ` (${status.toLowerCase().replace(/_/g, ' ')})` : ''}: ${title}`,
        kind: 'trial',
        citation: `Clinical trial: ${title}${status ? ` — ${status}` : ''}.${nct ? ` ${nct}` : ''}`,
      }
    })
    .filter((row): row is LiteratureSource => row !== null)
}

/**
 * Authoritative literature for a health query: peer-reviewed + preprints (Europe
 * PMC) and active clinical trials (ClinicalTrials.gov). Best-effort; returns
 * whatever succeeds. Both sources are keyless and free.
 */
export async function searchLiterature(
  query: string,
  opts?: { journals?: number; trials?: number },
): Promise<LiteratureSource[]> {
  const journals = opts?.journals ?? 3
  const trials = opts?.trials ?? 2
  const cacheKey = `${query}::${journals}::${trials}`
  const hit = cache.get(cacheKey)
  if (hit && hit.expires > Date.now()) return hit.value

  const [literature, clinicalTrials] = await Promise.all([
    journals > 0 ? searchEuropePmc(query, journals).catch(() => []) : Promise.resolve([]),
    trials > 0 ? searchTrials(query, trials).catch(() => []) : Promise.resolve([]),
  ])
  const combined = [...literature, ...clinicalTrials]
  cache.set(cacheKey, { value: combined, expires: Date.now() + CACHE_TTL_MS })
  return combined
}
