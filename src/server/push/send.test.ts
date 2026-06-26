import { describe, expect, it } from 'vitest'
import { vapidPublicKeyFromJwk } from './send'

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

describe('vapidPublicKeyFromJwk', () => {
  it('builds the browser subscription key from the private JWK public fields', () => {
    const x = new Uint8Array(32).fill(1)
    const y = new Uint8Array(32).fill(2)
    const publicKey = vapidPublicKeyFromJwk({ x: base64Url(x), y: base64Url(y) })

    expect(publicKey).toBeTruthy()
    const bytes = decodeBase64Url(publicKey!)
    expect(bytes).toHaveLength(65)
    expect(bytes[0]).toBe(0x04)
    expect(bytes.slice(1, 33)).toEqual(x)
    expect(bytes.slice(33)).toEqual(y)
  })

  it('rejects malformed public fields', () => {
    const y = new Uint8Array(32).fill(2)
    expect(vapidPublicKeyFromJwk({ x: 'short', y: base64Url(y) })).toBeNull()
    expect(vapidPublicKeyFromJwk({ x: base64Url(new Uint8Array(32)), y: '' })).toBeNull()
  })
})
