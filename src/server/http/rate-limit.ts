export type RateLimitResult = { allowed: boolean; remaining: number; limit: number }

/**
 * In-memory, per-isolate fixed-window rate limiter.
 *
 * We deliberately do NOT use KV here. Every RPC call (and every AI route) passes
 * through rate limiting, and the previous KV-backed limiter did a KV write on
 * each allowed request — which exhausts the Workers KV free-tier write budget
 * (~1,000 writes/day) almost immediately, even with a single tester. Counting
 * per-isolate in memory is enough to blunt bursts and abuse; D1 + session auth
 * still gate real access, and the AI routes also enforce monthly quotas in D1.
 *
 * Trade-off: counters are per-isolate, not globally consistent, so a determined
 * attacker spread across isolates sees a higher effective ceiling. That is an
 * acceptable pre-launch trade for eliminating the KV write storm. If precise
 * global limits are ever needed, move the hot endpoints to a Durable Object.
 */
type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 5000

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowMs = windowSeconds * 1000
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    // Opportunistic cleanup so the map can't grow without bound over an
    // isolate's lifetime.
    if (buckets.size > MAX_BUCKETS) {
      for (const [k, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(k)
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: Math.max(0, limit - 1), limit }
  }

  if (existing.count >= limit) return { allowed: false, remaining: 0, limit }
  existing.count += 1
  return { allowed: true, remaining: Math.max(0, limit - existing.count), limit }
}
