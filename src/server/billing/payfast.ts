/**
 * PayFast (South African gateway) integration. We build a signed redirect to
 * PayFast's process page for checkout, and validate the server-to-server ITN
 * (Instant Transaction Notification) on /api/payfast/notify.
 *
 * PayFast requires an MD5 signature. Web Crypto has no MD5 and workerd's
 * node:crypto MD5 support is not guaranteed, so we use a small self-contained
 * MD5 (RFC 1321). Payments must not depend on a runtime quirk.
 */

import {
  billingPeriodFromInput,
  billingPeriodMonths,
  billingPeriodPayfastFrequency,
  type BillingPeriod,
} from './tiers'

const LIVE_PROCESS = 'https://www.payfast.co.za/eng/process'
const SANDBOX_PROCESS = 'https://sandbox.payfast.co.za/eng/process'
const LIVE_VALIDATE = 'https://www.payfast.co.za/eng/query/validate'
const SANDBOX_VALIDATE = 'https://sandbox.payfast.co.za/eng/query/validate'
const LIVE_API = 'https://api.payfast.co.za'
const SANDBOX_API = 'https://sandbox.payfast.co.za'

function cfg() {
  return {
    merchantId: (process.env.PAYFAST_MERCHANT_ID ?? '').trim(),
    merchantKey: (process.env.PAYFAST_MERCHANT_KEY ?? '').trim(),
    passphrase: (process.env.PAYFAST_PASSPHRASE ?? '').trim(),
    sandbox: (process.env.PAYFAST_MODE ?? 'live').trim().toLowerCase() === 'sandbox',
  }
}

export function payfastConfigured(): boolean {
  const c = cfg()
  return Boolean(c.merchantId && c.merchantKey)
}

/** PayFast urlencoding: uppercase hex, spaces as '+', value trimmed. */
function pfEncode(value: string): string {
  return encodeURIComponent(value.trim()).replace(/%20/g, '+').replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

/** Signature over ordered fields (skip empties + signature) + passphrase, MD5 hex. */
function signFields(ordered: Array<[string, string]>, passphrase: string): string {
  const parts: string[] = []
  for (const [k, v] of ordered) {
    if (k === 'signature') continue
    if (v === '' || v == null) continue
    parts.push(`${k}=${pfEncode(String(v))}`)
  }
  let str = parts.join('&')
  if (passphrase) str += `&passphrase=${pfEncode(passphrase)}`
  return md5(str)
}

function apiTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, '')
}

function apiSignature(fields: Record<string, string>, passphrase: string): string {
  const data: Record<string, string> = { ...fields }
  if (passphrase) data.passphrase = passphrase
  const parts = Object.entries(data)
    .filter(([, value]) => value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${pfEncode(value)}`)
  return md5(parts.join('&')).toLowerCase()
}

function nextBillingDate(period: BillingPeriod): string {
  const next = new Date()
  next.setUTCMonth(next.getUTCMonth() + billingPeriodMonths(period))
  return next.toISOString().slice(0, 10)
}

export type CheckoutInput = {
  userId: string
  email: string
  firstName?: string
  tier: string
  amountCents: number
  itemName: string
  appUrl: string
  purpose?: 'plan' | 'guide_credits'
  billingPeriod?: BillingPeriod
  packId?: string
  credits?: number
}

/** Builds the signed PayFast redirect URL for plan subscriptions or credit packs. */
export function buildCheckoutUrl(input: CheckoutInput): string {
  const c = cfg()
  const amount = (input.amountCents / 100).toFixed(2)
  const purpose = input.purpose ?? 'plan'
  const billingPeriod = billingPeriodFromInput(input.billingPeriod)
  const paymentId =
    purpose === 'guide_credits'
      ? `${input.userId}:${purpose}:${input.packId ?? 'credits'}:${Date.now()}`
      : `${input.userId}:${purpose}:${input.tier}:${billingPeriod}:${Date.now()}`
  const custom2 = purpose === 'guide_credits' ? 'guide_credits' : input.tier
  const custom3 = purpose === 'guide_credits' ? input.packId ?? '' : billingPeriod
  const custom4 = purpose === 'guide_credits' ? String(input.credits ?? 0) : ''
  const recurringFields: Array<[string, string]> =
    purpose === 'plan'
      ? [
          ['subscription_type', '1'],
          ['billing_date', nextBillingDate(billingPeriod)],
          ['recurring_amount', amount],
          ['frequency', billingPeriodPayfastFrequency(billingPeriod)],
          ['cycles', '0'],
        ]
      : []
  // Order matters for the signature. Keep insertion order stable.
  const ordered: Array<[string, string]> = [
    ['merchant_id', c.merchantId],
    ['merchant_key', c.merchantKey],
    ['return_url', `${input.appUrl}/plan?checkout=complete`],
    ['cancel_url', `${input.appUrl}/plan?checkout=cancelled`],
    ['notify_url', `${input.appUrl}/api/payfast/notify`],
    ['name_first', (input.firstName ?? '').slice(0, 100)],
    ['email_address', input.email],
    ['m_payment_id', paymentId],
    ['amount', amount],
    ...recurringFields,
    ['item_name', input.itemName.slice(0, 100)],
    ['custom_str1', input.userId],
    ['custom_str2', custom2],
    ['custom_str3', custom3],
    ['custom_str4', custom4],
  ]
  const signature = signFields(ordered, c.passphrase)
  const qs = ordered
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${pfEncode(String(v))}`)
    .join('&')
  const base = c.sandbox ? SANDBOX_PROCESS : LIVE_PROCESS
  return `${base}?${qs}&signature=${signature}`
}

export async function cancelPayfastSubscription(token: string): Promise<boolean> {
  const c = cfg()
  if (!token || !payfastConfigured()) return false
  const timestamp = apiTimestamp()
  const version = 'v1'
  const signature = apiSignature(
    {
      'merchant-id': c.merchantId,
      timestamp,
      version,
    },
    c.passphrase,
  )
  const base = c.sandbox ? SANDBOX_API : LIVE_API
  try {
    const response = await fetch(`${base}/subscriptions/${encodeURIComponent(token)}/cancel`, {
      method: 'PUT',
      headers: {
        'merchant-id': c.merchantId,
        version,
        timestamp,
        signature,
      },
    })
    if (!response.ok) return false
    const data = (await response.json().catch(() => null)) as { response?: unknown } | null
    return data == null || data.response === true || data.response === 'true'
  } catch {
    return false
  }
}

/** Parse a raw urlencoded ITN body into ordered, decoded [key,value] pairs. */
function parseOrdered(rawBody: string): Array<[string, string]> {
  return rawBody
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf('=')
      const k = idx >= 0 ? pair.slice(0, idx) : pair
      const v = idx >= 0 ? pair.slice(idx + 1) : ''
      return [decodeURIComponent(k), decodeURIComponent(v.replace(/\+/g, ' '))] as [string, string]
    })
}

/** Recompute the ITN signature from the raw posted body (preserves field order). */
export function verifyItnSignature(rawBody: string): boolean {
  const c = cfg()
  const ordered = parseOrdered(rawBody)
  const received = ordered.find(([k]) => k === 'signature')?.[1] ?? ''
  if (!received) return false
  return signFields(ordered, c.passphrase).toLowerCase() === received.toLowerCase()
}

/** Authoritative confirmation: post the ITN back to PayFast, expect "VALID". */
export async function validateItnWithPayfast(rawBody: string): Promise<boolean> {
  const url = cfg().sandbox ? SANDBOX_VALIDATE : LIVE_VALIDATE
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: rawBody,
    })
    const text = await res.text()
    return text.trim().startsWith('VALID')
  } catch {
    return false
  }
}

export function itnField(rawBody: string, key: string): string {
  return parseOrdered(rawBody).find(([k]) => k === key)?.[1] ?? ''
}

// ── Self-contained MD5 (RFC 1321), hex output ───────────────────────────────
function md5(input: string): string {
  function toBytes(str: string): number[] {
    const utf8 = unescape(encodeURIComponent(str))
    const bytes: number[] = []
    for (let i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i) & 0xff)
    return bytes
  }
  function add32(a: number, b: number): number {
    return (a + b) & 0xffffffff
  }
  function rol(n: number, c: number): number {
    return (n << c) | (n >>> (32 - c))
  }
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
    a = add32(add32(a, q), add32(x, t))
    return add32(rol(a, s), b)
  }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & c) | (~b & d), a, b, x, s, t)
  }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & d) | (c & ~d), a, b, x, s, t)
  }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(b ^ c ^ d, a, b, x, s, t)
  }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(c ^ (b | ~d), a, b, x, s, t)
  }

  const bytes = toBytes(input)
  const len = bytes.length
  const words: number[] = []
  for (let i = 0; i < len; i++) words[i >> 2] = (words[i >> 2] || 0) | (bytes[i] << ((i % 4) * 8))
  words[len >> 2] = (words[len >> 2] || 0) | (0x80 << ((len % 4) * 8))
  const bitLen = len * 8
  const nWords = (((len + 8) >> 6) + 1) * 16
  while (words.length < nWords) words.push(0)
  words[nWords - 2] = bitLen & 0xffffffff
  words[nWords - 1] = Math.floor(bitLen / 0x100000000) & 0xffffffff

  let a = 1732584193
  let b = -271733879
  let c = -1732584194
  let d = 271733878

  for (let i = 0; i < words.length; i += 16) {
    const oa = a
    const ob = b
    const oc = c
    const od = d
    const x = words.slice(i, i + 16)
    a = ff(a, b, c, d, x[0], 7, -680876936)
    d = ff(d, a, b, c, x[1], 12, -389564586)
    c = ff(c, d, a, b, x[2], 17, 606105819)
    b = ff(b, c, d, a, x[3], 22, -1044525330)
    a = ff(a, b, c, d, x[4], 7, -176418897)
    d = ff(d, a, b, c, x[5], 12, 1200080426)
    c = ff(c, d, a, b, x[6], 17, -1473231341)
    b = ff(b, c, d, a, x[7], 22, -45705983)
    a = ff(a, b, c, d, x[8], 7, 1770035416)
    d = ff(d, a, b, c, x[9], 12, -1958414417)
    c = ff(c, d, a, b, x[10], 17, -42063)
    b = ff(b, c, d, a, x[11], 22, -1990404162)
    a = ff(a, b, c, d, x[12], 7, 1804603682)
    d = ff(d, a, b, c, x[13], 12, -40341101)
    c = ff(c, d, a, b, x[14], 17, -1502002290)
    b = ff(b, c, d, a, x[15], 22, 1236535329)
    a = gg(a, b, c, d, x[1], 5, -165796510)
    d = gg(d, a, b, c, x[6], 9, -1069501632)
    c = gg(c, d, a, b, x[11], 14, 643717713)
    b = gg(b, c, d, a, x[0], 20, -373897302)
    a = gg(a, b, c, d, x[5], 5, -701558691)
    d = gg(d, a, b, c, x[10], 9, 38016083)
    c = gg(c, d, a, b, x[15], 14, -660478335)
    b = gg(b, c, d, a, x[4], 20, -405537848)
    a = gg(a, b, c, d, x[9], 5, 568446438)
    d = gg(d, a, b, c, x[14], 9, -1019803690)
    c = gg(c, d, a, b, x[3], 14, -187363961)
    b = gg(b, c, d, a, x[8], 20, 1163531501)
    a = gg(a, b, c, d, x[13], 5, -1444681467)
    d = gg(d, a, b, c, x[2], 9, -51403784)
    c = gg(c, d, a, b, x[7], 14, 1735328473)
    b = gg(b, c, d, a, x[12], 20, -1926607734)
    a = hh(a, b, c, d, x[5], 4, -378558)
    d = hh(d, a, b, c, x[8], 11, -2022574463)
    c = hh(c, d, a, b, x[11], 16, 1839030562)
    b = hh(b, c, d, a, x[14], 23, -35309556)
    a = hh(a, b, c, d, x[1], 4, -1530992060)
    d = hh(d, a, b, c, x[4], 11, 1272893353)
    c = hh(c, d, a, b, x[7], 16, -155497632)
    b = hh(b, c, d, a, x[10], 23, -1094730640)
    a = hh(a, b, c, d, x[13], 4, 681279174)
    d = hh(d, a, b, c, x[0], 11, -358537222)
    c = hh(c, d, a, b, x[3], 16, -722521979)
    b = hh(b, c, d, a, x[6], 23, 76029189)
    a = hh(a, b, c, d, x[9], 4, -640364487)
    d = hh(d, a, b, c, x[12], 11, -421815835)
    c = hh(c, d, a, b, x[15], 16, 530742520)
    b = hh(b, c, d, a, x[2], 23, -995338651)
    a = ii(a, b, c, d, x[0], 6, -198630844)
    d = ii(d, a, b, c, x[7], 10, 1126891415)
    c = ii(c, d, a, b, x[14], 15, -1416354905)
    b = ii(b, c, d, a, x[5], 21, -57434055)
    a = ii(a, b, c, d, x[12], 6, 1700485571)
    d = ii(d, a, b, c, x[3], 10, -1894986606)
    c = ii(c, d, a, b, x[10], 15, -1051523)
    b = ii(b, c, d, a, x[1], 21, -2054922799)
    a = ii(a, b, c, d, x[8], 6, 1873313359)
    d = ii(d, a, b, c, x[15], 10, -30611744)
    c = ii(c, d, a, b, x[6], 15, -1560198380)
    b = ii(b, c, d, a, x[13], 21, 1309151649)
    a = ii(a, b, c, d, x[4], 6, -145523070)
    d = ii(d, a, b, c, x[11], 10, -1120210379)
    c = ii(c, d, a, b, x[2], 15, 718787259)
    b = ii(b, c, d, a, x[9], 21, -343485551)
    a = add32(a, oa)
    b = add32(b, ob)
    c = add32(c, oc)
    d = add32(d, od)
  }

  function toHex(n: number): string {
    let s = ''
    for (let i = 0; i < 4; i++) s += ((n >> (i * 8)) & 0xff).toString(16).padStart(2, '0')
    return s
  }
  return toHex(a) + toHex(b) + toHex(c) + toHex(d)
}
