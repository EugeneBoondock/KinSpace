import { getEnv } from '@/server/env'
import { toBase64Url, fromBase64Url } from '@/server/auth/crypto'

/**
 * Application-level field encryption at rest (AES-256-GCM) for the most
 * sensitive PRIVATE fields (journal, therapy summaries, mood notes, emergency
 * contacts). This is encryption-at-rest with a server-managed key — the server
 * decrypts to power AI features and the owner's own views. It defends against a
 * D1 dump / row leak; it is NOT zero-knowledge E2E (which is incompatible with
 * the AI Guide reading conditions and with social sharing).
 *
 * Key: FIELD_ENCRYPTION_KEY (base64url 32 bytes) if set; otherwise derived from
 * AUTH_SECRET so local dev works without extra config. Set a dedicated
 * FIELD_ENCRYPTION_KEY secret in production.
 */

const PREFIX = 'enc.v1:'
let cachedKey: CryptoKey | null = null

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey
  const env = getEnv()
  let raw: Uint8Array
  if (env.FIELD_ENCRYPTION_KEY) {
    raw = fromBase64Url(env.FIELD_ENCRYPTION_KEY)
  } else {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`fieldkey:${env.AUTH_SECRET ?? 'dev'}`))
    raw = new Uint8Array(digest)
  }
  cachedKey = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  return cachedKey
}

/** Encrypts a string. Returns null/empty unchanged. Output is self-describing (enc.v1:iv.ct). */
export async function encryptField(plaintext: string | null | undefined): Promise<string | null> {
  if (plaintext == null || plaintext === '') return plaintext ?? null
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  return `${PREFIX}${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ct))}`
}

/** Decrypts a value. Passes through non-encrypted (legacy plaintext) values unchanged. */
export async function decryptField(value: string | null | undefined): Promise<string | null> {
  if (value == null) return null
  if (!value.startsWith(PREFIX)) return value
  try {
    const [ivB64, ctB64] = value.slice(PREFIX.length).split('.')
    const key = await getKey()
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64Url(ivB64) }, key, fromBase64Url(ctB64))
    return new TextDecoder().decode(pt)
  } catch {
    return null
  }
}

export async function encryptJson(value: unknown): Promise<string | null> {
  if (value == null) return null
  return encryptField(JSON.stringify(value))
}

export async function decryptJson<T>(value: string | null | undefined): Promise<T | null> {
  const decrypted = await decryptField(value)
  if (decrypted == null) return null
  try {
    return JSON.parse(decrypted) as T
  } catch {
    return null
  }
}
