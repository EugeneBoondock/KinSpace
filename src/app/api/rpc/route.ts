import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserId } from '@/server/http/auth'
import { rateLimit } from '@/server/http/rate-limit'
import { getDb } from '@/server/db/client'
import { dataMethods, type Ctx } from '@/server/data'
import { serializeForClient } from '@/server/data/serialize'
import { rpcErrorResponse } from '@/server/http/rpc-errors'

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
    const response = rpcErrorResponse(error)
    if (response.shouldLog) {
      // Log the method name only. The error object may contain SQL or health data.
      console.error(`rpc failed: ${method}`)
    }
    return NextResponse.json(response.body, { status: response.status })
  }
}
