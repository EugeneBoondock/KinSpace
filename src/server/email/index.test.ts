import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildBrevoPayload, parseEmailSender } from './index'

test('parseEmailSender reads a display name address', () => {
  assert.deepEqual(parseEmailSender('KinSpace <hello@kinspace.co.za>'), {
    name: 'KinSpace',
    email: 'hello@kinspace.co.za',
  })
})

test('buildBrevoPayload uses Brevo transactional email fields', () => {
  assert.deepEqual(
    buildBrevoPayload(
      {
        to: 'member@example.com',
        subject: 'Confirm your email',
        html: '<p>Welcome</p>',
        text: 'Welcome',
      },
      'KinSpace <hello@kinspace.co.za>',
    ),
    {
      sender: { name: 'KinSpace', email: 'hello@kinspace.co.za' },
      to: [{ email: 'member@example.com' }],
      subject: 'Confirm your email',
      htmlContent: '<p>Welcome</p>',
      textContent: 'Welcome',
    },
  )
})
