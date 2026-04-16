// Cheap DuckDuckGo-based web search + markdown.new page fetcher.
// Zero external API keys required. Modeled after MessageCFO's web-research.ts
// but trimmed to a single retrieval path per call to minimise latency + cost.

const SEARCH_TIMEOUT_MS = 12_000
const FETCH_TIMEOUT_MS = 15_000
const MAX_CHARS = 8_000 // per fetched page — smaller than MessageCFO's 12k to save tokens
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export type SearchResult = {
  title: string
  url: string
  domain: string
  snippet: string
}

export type WebPage = {
  url: string
  title: string
  domain: string
  snippet: string
  excerpt: string
  method: 'markdown.new' | 'direct_html'
}

// ── Caches ────────────────────────────────────────────────────────────

type CacheEntry<T> = { value: T; expires: number }
const searchCache = new Map<string, CacheEntry<SearchResult[]>>()
const fetchCache = new Map<string, CacheEntry<WebPage>>()

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T) {
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS })
}
function getCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (hit.expires < Date.now()) {
    cache.delete(key)
    return null
  }
  return hit.value
}

// ── HTML utilities ────────────────────────────────────────────────────

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
}

function stripTags(value: string) {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function unwrapDuckDuckGo(raw: string): string {
  let url = decodeEntities(raw).trim()
  if (!url) return ''
  if (url.startsWith('//')) url = `https:${url}`
  if (url.startsWith('/')) url = `https://duckduckgo.com${url}`
  try {
    const parsed = new URL(url)
    if (parsed.hostname.endsWith('duckduckgo.com') && parsed.pathname.startsWith('/l/')) {
      const target = parsed.searchParams.get('uddg')
      if (target) return decodeURIComponent(target)
    }
    return parsed.toString()
  } catch {
    return url
  }
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function parseDuckDuckGo(html: string, max: number): SearchResult[] {
  const results: SearchResult[] = []
  const resultRegex = /<a[^>]+class="[^"]*result-link[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<td[^>]+class="[^"]*result-snippet[^"]*"[^>]*>([\s\S]*?)<\/td>/gi
  let match: RegExpExecArray | null
  while ((match = resultRegex.exec(html)) && results.length < max) {
    const url = unwrapDuckDuckGo(match[1])
    const title = stripTags(match[2])
    const snippet = stripTags(match[3])
    if (!url || !title) continue
    if (!/^https?:\/\//i.test(url)) continue
    results.push({ title, url, snippet, domain: domainOf(url) })
  }

  if (results.length === 0) {
    const htmlResultRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
    while ((match = htmlResultRegex.exec(html)) && results.length < max) {
      const url = unwrapDuckDuckGo(match[1])
      const title = stripTags(match[2])
      const snippet = stripTags(match[3])
      if (!url || !title) continue
      if (!/^https?:\/\//i.test(url)) continue
      results.push({ title, url, snippet, domain: domainOf(url) })
    }
  }

  // Dedup by url
  const seen = new Set<string>()
  return results.filter((result) => {
    if (seen.has(result.url)) return false
    seen.add(result.url)
    return true
  })
}

// ── Search ────────────────────────────────────────────────────────────

export async function searchWeb(query: string, max = 6): Promise<SearchResult[]> {
  const key = `${query}::${max}`
  const cached = getCache(searchCache, key)
  if (cached) return cached

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)
  try {
    const endpoints = [
      {
        url: 'https://html.duckduckgo.com/html/',
        method: 'POST' as const,
        body: new URLSearchParams({ q: query }).toString(),
      },
      {
        url: `https://lite.duckduckgo.com/lite/?${new URLSearchParams({ q: query })}`,
        method: 'GET' as const,
      },
    ]

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: {
            'User-Agent': UA,
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
            ...(endpoint.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
          },
          body: endpoint.body,
          signal: controller.signal,
          redirect: 'follow',
        })
        if (!response.ok) continue
        const html = await response.text()
        if (!html || html.length < 200) continue
        const parsed = parseDuckDuckGo(html, max)
        if (parsed.length > 0) {
          setCache(searchCache, key, parsed)
          return parsed
        }
      } catch {
        // try next endpoint
      }
    }
  } finally {
    clearTimeout(timer)
  }

  return []
}

// ── Fetch ─────────────────────────────────────────────────────────────

export async function fetchPage(url: string): Promise<WebPage | null> {
  const cached = getCache(fetchCache, url)
  if (cached) return cached

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    // Try markdown.new first — it returns clean markdown content.
    try {
      const mdUrl = `https://markdown.new/${url.replace(/^https?:\/\//, '')}`
      const response = await fetch(mdUrl, {
        headers: { 'User-Agent': UA, Accept: 'text/plain, text/markdown, */*' },
        signal: controller.signal,
        redirect: 'follow',
      })
      if (response.ok) {
        const text = await response.text()
        if (text && text.length > 200) {
          const trimmed = text.slice(0, MAX_CHARS).trim()
          const titleMatch = trimmed.match(/^#\s+(.+)$/m)
          const page: WebPage = {
            url,
            title: titleMatch ? titleMatch[1].trim() : domainOf(url),
            domain: domainOf(url),
            snippet: trimmed.slice(0, 320),
            excerpt: trimmed,
            method: 'markdown.new',
          }
          setCache(fetchCache, url, page)
          return page
        }
      }
    } catch {
      // fall through
    }

    // Fallback: direct HTML + strip
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
        redirect: 'follow',
      })
      if (!response.ok) return null
      const html = await response.text()
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      const text = stripTags(html).slice(0, MAX_CHARS)
      if (text.length < 200) return null
      const page: WebPage = {
        url,
        title: titleMatch ? decodeEntities(titleMatch[1].trim()) : domainOf(url),
        domain: domainOf(url),
        snippet: text.slice(0, 320),
        excerpt: text,
        method: 'direct_html',
      }
      setCache(fetchCache, url, page)
      return page
    } catch {
      return null
    }
  } finally {
    clearTimeout(timer)
  }
}
