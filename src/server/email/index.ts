import { getEnv } from '../env'

type SendArgs = { to: string; subject: string; html: string; text?: string }
type EmailSender = { email: string; name?: string }

export function parseEmailSender(value: string): EmailSender {
  const match = value.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/)
  if (!match) return { email: value.trim() }

  const rawName = match[1].trim().replace(/^["']|["']$/g, '')
  return {
    email: match[2].trim(),
    ...(rawName ? { name: rawName } : {}),
  }
}

export function buildBrevoPayload(args: SendArgs, from: string) {
  return {
    sender: parseEmailSender(from),
    to: [{ email: args.to }],
    subject: args.subject,
    htmlContent: args.html,
    ...(args.text ? { textContent: args.text } : {}),
  }
}

/**
 * Sends a transactional email via the configured provider. In dev, missing
 * provider keys log and return ok:false so callers can keep running.
 */
export async function sendEmail(args: SendArgs): Promise<{ ok: boolean }> {
  const env = getEnv()
  const from = env.EMAIL_FROM ?? 'KinSpace <hello@kinspace.co.za>'
  const provider = (env.EMAIL_PROVIDER ?? 'resend').toLowerCase()

  if (provider === 'resend' && env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: args.to, subject: args.subject, html: args.html, text: args.text }),
      })
      return { ok: res.ok }
    } catch {
      return { ok: false }
    }
  }

  if (provider === 'brevo' && env.BREVO_API_KEY) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': env.BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildBrevoPayload(args, from)),
      })
      if (!res.ok) console.warn(`[email] Brevo rejected "${args.subject}" for ${args.to}: ${res.status}`)
      return { ok: res.ok }
    } catch {
      return { ok: false }
    }
  }

  console.warn(`[email] No provider configured - skipped "${args.subject}" to ${args.to}`)
  return { ok: false }
}

const SHELL = (title: string, body: string) => `
<div style="font-family:ui-sans-serif,system-ui,sans-serif;background:#2A4A42;color:#eedfc8;padding:32px;border-radius:16px;max-width:480px;margin:0 auto">
  <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
  ${body}
  <p style="color:rgba(238,223,200,0.6);font-size:12px;margin-top:24px">KinSpace - a calmer place to heal. If you did not request this, you can ignore this email.</p>
</div>`

const BUTTON = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#eedfc8;color:#2A4A42;font-weight:600;padding:12px 24px;border-radius:9999px;text-decoration:none">${label}</a>`

export function verificationEmailHtml(link: string): string {
  return SHELL(
    'Confirm your email',
    `<p style="line-height:1.6">Welcome to KinSpace. Please confirm your email to secure your account and unlock everything.</p><p style="margin:24px 0">${BUTTON(link, 'Verify my email')}</p>`,
  )
}

export function passwordResetEmailHtml(link: string): string {
  return SHELL(
    'Reset your password',
    `<p style="line-height:1.6">We received a request to reset your KinSpace password. This link expires in 1 hour.</p><p style="margin:24px 0">${BUTTON(link, 'Choose a new password')}</p>`,
  )
}
