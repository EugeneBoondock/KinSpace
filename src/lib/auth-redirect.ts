type QueryInput = string | URLSearchParams | Record<string, string | string[] | undefined> | null | undefined

function safePath(pathname: string): string {
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return '/'
  return pathname
}

function queryToString(query: QueryInput): string {
  if (!query) return ''
  if (typeof query === 'string') return query.replace(/^\?/, '')
  if (query instanceof URLSearchParams) return query.toString()

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item)
    } else if (typeof value === 'string') {
      params.set(key, value)
    }
  }
  return params.toString()
}

export function buildLoginRedirect(pathname: string, query?: QueryInput): string {
  const path = safePath(pathname)
  const queryString = queryToString(query)
  const next = queryString ? `${path}?${queryString}` : path
  return `/login?${new URLSearchParams({ next }).toString()}`
}
