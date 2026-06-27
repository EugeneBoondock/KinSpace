import { getPersona } from '@/lib/therapy-config'

type FollowUpReason = 'idle' | 'quiet'

type FollowUpInput = {
  personaId?: string | null
  sessionId: string
  appUrl?: string
  reason?: FollowUpReason
}

export type GuideFollowUpMessage = {
  title: string
  body: string
  url: string
  emailSubject: string
  emailText: string
  emailHtml: string
  sessionMemory: string
}

function appOrigin(appUrl?: string): string {
  const raw = appUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://www.kinspace.co.za'
  try {
    const parsed = new URL(raw)
    return parsed.origin
  } catch {
    return 'https://www.kinspace.co.za'
  }
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildGuideFollowUpMessage(input: FollowUpInput): GuideFollowUpMessage {
  const persona = getPersona(input.personaId)
  const path = `/therapy?session=${encodeURIComponent(input.sessionId)}&source=guide-follow-up`
  const link = `${appOrigin(input.appUrl)}${path}`
  const title = `${persona.name} saved your Guide room`
  const body =
    input.reason === 'quiet'
      ? `${persona.name} left a quiet check-in for you. Tap to open the Guide room.`
      : `${persona.name} saved the room after you stepped away. Tap to reopen the session.`
  const emailSubject = `${persona.name} from KinSpace`
  const emailText = `${body}\n\nOpen your session: ${link}`
  const escapedBody = htmlEscape(body)
  const escapedLink = htmlEscape(link)
  const emailHtml = `
<div style="font-family:ui-sans-serif,system-ui,sans-serif;background:#2A4A42;color:#eedfc8;padding:28px;border-radius:16px;max-width:520px;margin:0 auto">
  <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:rgba(238,223,200,.62);margin:0 0 8px">KinSpace Guide</p>
  <h1 style="font-size:20px;margin:0 0 12px">${htmlEscape(persona.name)} checked in</h1>
  <p style="line-height:1.6;margin:0 0 22px">${escapedBody}</p>
  <p style="margin:0 0 20px"><a href="${escapedLink}" style="display:inline-block;background:#eedfc8;color:#2A4A42;font-weight:700;padding:12px 18px;border-radius:999px;text-decoration:none">Open the session</a></p>
  <p style="font-size:12px;line-height:1.5;color:rgba(238,223,200,.62);margin:0">This alert does not include private health details. The memory lives inside your Guide room.</p>
</div>`
  const sessionMemory =
    `${persona.name} sent a private follow-up for this room. The alert and email used safe, general wording and did not include health details.`

  return { title, body, url: path, emailSubject, emailText, emailHtml, sessionMemory }
}
