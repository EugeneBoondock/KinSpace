import assert from 'node:assert/strict'
import test from 'node:test'

import { RpcError, rpc } from './rpc-client'

test('rpc preserves upgrade metadata on failed responses', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        ok: false,
        error: 'Upgrade required for this feature.',
        code: 'PLAN_REQUIRED',
        upgrade: true,
      }),
      {
      status: 402,
      headers: { 'Content-Type': 'application/json' },
      },
    )

  try {
    await assert.rejects(
      () => rpc('requestGuidePostComment', ['post-1', 'mira']),
      (error) => {
        assert.ok(error instanceof RpcError)
        assert.equal(error.message, 'Upgrade required for this feature.')
        assert.equal(error.method, 'requestGuidePostComment')
        assert.equal(error.status, 402)
        assert.equal(error.code, 'PLAN_REQUIRED')
        assert.equal(error.upgrade, true)
        return true
      },
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
