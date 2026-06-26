type PublicKeyResponse = { ok?: boolean; publicKey?: string; error?: string }

export async function getVapidPublicKey(): Promise<string> {
  const res = await fetch('/api/push/public-key', { cache: 'no-store' })
  const json = (await res.json().catch(() => null)) as PublicKeyResponse | null
  if (!res.ok || !json?.ok || typeof json.publicKey !== 'string' || !json.publicKey) {
    throw new Error(json?.error || 'Background reminders are not configured.')
  }
  return json.publicKey
}
