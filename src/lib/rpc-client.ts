/** Client → server data RPC. All DatabaseService calls funnel through here. */
export async function rpc<T = unknown>(method: string, args: unknown[]): Promise<T> {
  const res = await fetch('/api/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, args }),
  })
  const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; error?: string } | null
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `Request failed (${method})`)
  }
  return json.data as T
}
