import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCheckoutUrl } from './payfast'

function withPayfastEnv(fn: () => void) {
  const previous = {
    id: process.env.PAYFAST_MERCHANT_ID,
    key: process.env.PAYFAST_MERCHANT_KEY,
    passphrase: process.env.PAYFAST_PASSPHRASE,
    mode: process.env.PAYFAST_MODE,
  }
  process.env.PAYFAST_MERCHANT_ID = '10000100'
  process.env.PAYFAST_MERCHANT_KEY = '46f0cd694581a'
  process.env.PAYFAST_PASSPHRASE = 'secret'
  process.env.PAYFAST_MODE = 'sandbox'
  try {
    fn()
  } finally {
    process.env.PAYFAST_MERCHANT_ID = previous.id
    process.env.PAYFAST_MERCHANT_KEY = previous.key
    process.env.PAYFAST_PASSPHRASE = previous.passphrase
    process.env.PAYFAST_MODE = previous.mode
  }
}

test('buildCheckoutUrl signs annual plan subscriptions with the PayFast annual frequency', () => {
  withPayfastEnv(() => {
    const url = new URL(
      buildCheckoutUrl({
        userId: 'user-1',
        email: 'member@example.com',
        tier: 'plus',
        amountCents: 118800,
        itemName: 'KinSpace Plus (annual)',
        appUrl: 'https://www.kinspace.co.za',
        purpose: 'plan',
        billingPeriod: 'annual',
      }),
    )

    assert.equal(url.origin + url.pathname, 'https://sandbox.payfast.co.za/eng/process')
    assert.equal(url.searchParams.get('amount'), '1188.00')
    assert.equal(url.searchParams.get('recurring_amount'), '1188.00')
    assert.equal(url.searchParams.get('frequency'), '6')
    assert.equal(url.searchParams.get('custom_str2'), 'plus')
    assert.equal(url.searchParams.get('custom_str3'), 'annual')
    assert.match(url.searchParams.get('m_payment_id') ?? '', /^user-1:plan:plus:annual:\d+$/)
    assert.equal(url.searchParams.get('item_name'), 'KinSpace Plus (annual)')
  })
})

test('buildCheckoutUrl signs quarterly plan subscriptions with the PayFast quarterly frequency', () => {
  withPayfastEnv(() => {
    const url = new URL(
      buildCheckoutUrl({
        userId: 'user-1',
        email: 'member@example.com',
        tier: 'pro',
        amountCents: 74700,
        itemName: 'KinSpace Pro (quarterly)',
        appUrl: 'https://www.kinspace.co.za',
        purpose: 'plan',
        billingPeriod: 'quarterly',
      }),
    )

    assert.equal(url.searchParams.get('amount'), '747.00')
    assert.equal(url.searchParams.get('recurring_amount'), '747.00')
    assert.equal(url.searchParams.get('frequency'), '4')
    assert.equal(url.searchParams.get('custom_str3'), 'quarterly')
    assert.match(url.searchParams.get('m_payment_id') ?? '', /^user-1:plan:pro:quarterly:\d+$/)
  })
})
