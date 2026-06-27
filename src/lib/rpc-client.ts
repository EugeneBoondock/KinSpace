export class RpcError extends Error {
  readonly method: string
  readonly status: number
  readonly upgrade: boolean

  constructor(message: string, options: { method: string; status: number; upgrade?: boolean }) {
    super(message)
    this.name = 'RpcError'
    this.method = options.method
    this.status = options.status
    this.upgrade = Boolean(options.upgrade)
    Object.setPrototypeOf(this, RpcError.prototype)
  }
}

/** Client to server data RPC. All DatabaseService calls funnel through here. */
export async function rpc<T = unknown>(method: string, args: unknown[]): Promise<T> {
  const res = await fetch('/api/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, args }),
  })
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean
    data?: T
    error?: string
    upgrade?: boolean
  } | null
  if (!res.ok || !json?.ok) {
    throw new RpcError(json?.error || `Request failed (${method})`, {
      method,
      status: res.status,
      upgrade: Boolean(json?.upgrade),
    })
  }
  return json.data as T
}
