import assert from 'node:assert/strict'
import test from 'node:test'

import { rpcErrorResponse } from './rpc-errors'

test('rpcErrorResponse passes through the safe duplicate Guide reply error', () => {
  assert.deepEqual(rpcErrorResponse(new Error('This Guide has already replied to this post.')), {
    status: 409,
    shouldLog: false,
    body: {
      ok: false,
      error: 'This Guide has already replied to this post.',
      code: 'GUIDE_ALREADY_REPLIED',
    },
  })
})

test('rpcErrorResponse keeps plan upgrade metadata', () => {
  assert.deepEqual(rpcErrorResponse(new Error('PLAN_REQUIRED')), {
    status: 402,
    shouldLog: false,
    body: {
      ok: false,
      error: 'Upgrade required for this feature.',
      code: 'PLAN_REQUIRED',
      upgrade: true,
    },
  })
})

test('rpcErrorResponse masks unsafe server details', () => {
  assert.deepEqual(rpcErrorResponse(new Error('AI is not configured')), {
    status: 500,
    shouldLog: true,
    body: {
      ok: false,
      error: 'Request failed. Please try again.',
      code: 'REQUEST_FAILED',
    },
  })
})
