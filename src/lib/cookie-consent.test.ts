import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCookieConsentCookie,
  normalizeCookieConsent,
  shouldShowCookieConsent,
} from './cookie-consent'

test('normalizeCookieConsent accepts only saved cookie choices', () => {
  assert.equal(normalizeCookieConsent('accepted'), 'accepted')
  assert.equal(normalizeCookieConsent('essential'), 'essential')
  assert.equal(normalizeCookieConsent('granted'), null)
  assert.equal(normalizeCookieConsent(null), null)
})

test('buildCookieConsentCookie writes a durable first-party cookie', () => {
  assert.equal(
    buildCookieConsentCookie('accepted'),
    'kinspace_cookie_consent=accepted; Max-Age=31536000; Path=/; SameSite=Lax; Secure',
  )
})

test('shouldShowCookieConsent hides the banner after a valid choice', () => {
  assert.equal(shouldShowCookieConsent(null), true)
  assert.equal(shouldShowCookieConsent('essential'), false)
  assert.equal(shouldShowCookieConsent('accepted'), false)
})
