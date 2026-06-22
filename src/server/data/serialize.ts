function toSnake(key: string): string {
  return key.replace(/([A-Z])/g, '_$1').replace(/__+/g, '_').toLowerCase()
}

/**
 * Converts a server result (camelCase Drizzle rows + Date objects) into the
 * legacy Firestore-shaped payload the frontend expects: snake_case keys and
 * ISO date strings. Applied centrally by the RPC layer.
 */
export function serializeForClient(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(serializeForClient)
  if (value && typeof value === 'object') {
    if (value instanceof Map) {
      const obj: Record<string, unknown> = {}
      for (const [k, v] of value.entries()) obj[String(k)] = serializeForClient(v)
      return obj
    }
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[toSnake(k)] = serializeForClient(v)
    }
    return out
  }
  return value
}
