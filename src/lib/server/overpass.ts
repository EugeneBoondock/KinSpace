const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
]

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Overpass timeout')), timeoutMs)
    promise.then(
      (result) => {
        clearTimeout(timeout)
        resolve(result)
      },
      (error) => {
        clearTimeout(timeout)
        reject(error)
      },
    )
  })
}

export async function postOverpass(query: string, timeoutMs = 25_000) {
  let lastError: unknown
  const body = new URLSearchParams({ data: query }).toString()

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await withTimeout(
        fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            // OSM/Overpass usage policy requires a descriptive User-Agent. Node's
            // fetch (undici) otherwise gets blocked with an HTML/XML error page,
            // which broke the care map (response.json() threw → "degraded").
            'User-Agent': 'KinSpace/1.0 (care map; +https://kinspace.co.za)',
            Accept: 'application/json',
          },
          body,
          cache: 'no-store',
        }),
        timeoutMs,
      )

      if (!response.ok) {
        throw new Error(`Overpass request failed: ${endpoint}`)
      }

      return await response.json()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('All Overpass endpoints failed')
}
