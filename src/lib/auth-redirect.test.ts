import assert from 'node:assert/strict'
import test from 'node:test'
import { buildLoginRedirect } from './auth-redirect'

test('buildLoginRedirect keeps the current path in the next parameter', () => {
  assert.equal(buildLoginRedirect('/plan'), '/login?next=%2Fplan')
})

test('buildLoginRedirect includes safe query strings', () => {
  assert.equal(buildLoginRedirect('/plan', 'checkout=complete'), '/login?next=%2Fplan%3Fcheckout%3Dcomplete')
})

test('buildLoginRedirect rejects external paths', () => {
  assert.equal(buildLoginRedirect('https://example.com/phish'), '/login?next=%2F')
})
