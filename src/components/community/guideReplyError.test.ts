import assert from 'node:assert/strict'
import test from 'node:test'

import { RpcError } from '@/lib/rpc-client'
import { guideReplyErrorToast } from './guideReplyError'

test('guideReplyErrorToast gives a plan action for Guide quota failures', () => {
  const message = guideReplyErrorToast(
    new RpcError('Upgrade required for this feature.', {
      method: 'requestGuidePostComment',
      status: 402,
      upgrade: true,
    }),
  )

  assert.equal(message, 'You have reached your monthly Guide limit. Upgrade or add Guide credits to ask the Guide here.')
})

test('guideReplyErrorToast explains duplicate public Guide replies', () => {
  assert.equal(
    guideReplyErrorToast(new Error('This Guide has already replied to this post.')),
    'This Guide has already replied to this post.',
  )
  assert.equal(
    guideReplyErrorToast(
      new RpcError('Request failed. Please try again.', {
        method: 'requestGuidePostComment',
        status: 409,
        code: 'GUIDE_ALREADY_REPLIED',
      }),
    ),
    'This Guide has already replied to this post.',
  )
})

test('guideReplyErrorToast keeps a private fallback for unknown failures', () => {
  assert.equal(guideReplyErrorToast(new Error('AI is not configured')), 'Guide could not reply right now')
})
