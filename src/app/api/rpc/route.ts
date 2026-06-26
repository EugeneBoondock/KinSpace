import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserId } from '@/server/http/auth'
import { rateLimit } from '@/server/http/rate-limit'
import { getDb } from '@/server/db/client'
import { dataMethods, type Ctx } from '@/server/data'
import { serializeForClient } from '@/server/data/serialize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 64_000
const MAX_ARGS = 12
const AUTH_READ_RPC_LIMIT = 600
const AUTH_WRITE_RPC_LIMIT = 150
const ANON_READ_RPC_LIMIT = 240
const ANON_WRITE_RPC_LIMIT = 60
const READ_METHOD_PREFIXES = ['get', 'list', 'search', 'find', 'is', 'can']

function isReadMethod(method: string): boolean {
  return READ_METHOD_PREFIXES.some((prefix) => method.startsWith(prefix))
}

/**
 * Single data RPC endpoint. Rate-limited, size-capped, authenticates the
 * session, derives the actor (client ids are never trusted), dispatches to the
 * D1 data layer, and serializes the result to the legacy snake_case shape.
 */
export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: 'Request too large.' }, { status: 413 })
  }

  const body = (await request.json().catch(() => null)) as { method?: string; args?: unknown[] } | null
  const method = body?.method
  const args = Array.isArray(body?.args) ? body.args.slice(0, MAX_ARGS) : []
  const knownMethod = !!method && Object.prototype.hasOwnProperty.call(dataMethods, method)
  const readMethod = knownMethod && isReadMethod(method)

  const userId = await getSessionUserId(request)
  const rlKey = userId ?? `ip:${request.headers.get('cf-connecting-ip') ?? 'anon'}`
  const rpcLimit = userId
    ? readMethod ? AUTH_READ_RPC_LIMIT : AUTH_WRITE_RPC_LIMIT
    : readMethod ? ANON_READ_RPC_LIMIT : ANON_WRITE_RPC_LIMIT
  const limited = await rateLimit(`rpc:${readMethod ? 'read' : 'write'}:${rlKey}`, rpcLimit, 60)
  if (!limited.allowed) {
    return NextResponse.json({ ok: false, error: 'Too many requests. Please slow down.' }, { status: 429 })
  }

  if (!knownMethod) {
    return NextResponse.json({ ok: false, error: 'Unknown method.' }, { status: 400 })
  }

  const ctx: Ctx = { db: getDb(), userId }
  try {
    const result = await dataMethods[method](ctx, ...args)
    return NextResponse.json({ ok: true, data: serializeForClient(result) })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ ok: false, error: 'Please sign in to continue.' }, { status: 401 })
    }
    if (message === 'Not authorized') {
      return NextResponse.json({ ok: false, error: 'Not authorized.' }, { status: 403 })
    }
    if (message === 'PLAN_REQUIRED') {
      return NextResponse.json(
        { ok: false, error: 'Upgrade required for this feature.', upgrade: true },
        { status: 402 },
      )
    }
    // Log the method name only - never the error object (may contain SQL/PHI).
    console.error(`rpc failed: ${method}`)
    return NextResponse.json({ ok: false, error: 'Request failed. Please try again.' }, { status: 500 })
  }
}
