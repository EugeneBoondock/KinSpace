export type GuideAttachmentType = 'image' | 'video' | 'audio' | 'file' | 'link'

export type GuideAttachment = {
  type: GuideAttachmentType
  url: string
  name?: string
  mimeType?: string
}

export const GUIDE_ATTACHMENT_BLOCK_START = '[[kinspace-guide-attachments]]'
export const GUIDE_ATTACHMENT_BLOCK_END = '[[/kinspace-guide-attachments]]'

const TYPES = new Set<GuideAttachmentType>(['image', 'video', 'audio', 'file', 'link'])
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/wav'])
const FILE_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export function guideAttachmentTypeForMime(mimeType: string): GuideAttachmentType | null {
  if (IMAGE_TYPES.has(mimeType)) return 'image'
  if (VIDEO_TYPES.has(mimeType)) return 'video'
  if (AUDIO_TYPES.has(mimeType)) return 'audio'
  if (FILE_TYPES.has(mimeType)) return 'file'
  return null
}

function cleanName(value: unknown): string | undefined {
  const cleaned = String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return cleaned || undefined
}

function cleanMime(value: unknown): string | undefined {
  const cleaned = String(value ?? '').trim().toLowerCase().slice(0, 140)
  return cleaned || undefined
}

export function isSafeGuideAttachmentUrl(value: unknown): value is string {
  const url = String(value ?? '').trim()
  if (!url) return false
  if (url.startsWith('/api/media/')) return true
  if (url.startsWith('https://')) {
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'https:' && !parsed.username && !parsed.password
    } catch {
      return false
    }
  }
  return false
}

function isKinSpaceMediaUrl(value: string): boolean {
  if (value.startsWith('/api/media/')) return true
  try {
    const parsed = new URL(value)
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'www.kinspace.co.za' || parsed.hostname === 'kinspace.co.za') &&
      parsed.pathname.startsWith('/api/media/')
    )
  } catch {
    return false
  }
}

function safeAttachmentTypeForUrl(type: GuideAttachmentType, url: string): GuideAttachmentType {
  if ((type === 'image' || type === 'video' || type === 'audio') && !isKinSpaceMediaUrl(url)) {
    return 'link'
  }
  return type
}

export function normaliseGuideAttachments(input: unknown, limit = 6): GuideAttachment[] {
  if (!Array.isArray(input)) return []
  const safe: GuideAttachment[] = []

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const record = raw as Record<string, unknown>
    const type = String(record.type ?? '').trim().toLowerCase() as GuideAttachmentType
    const url = String(record.url ?? '').trim()
    if (!TYPES.has(type)) continue
    if (!isSafeGuideAttachmentUrl(url)) continue
    safe.push({
      type: safeAttachmentTypeForUrl(type, url),
      url,
      ...(cleanName(record.name) ? { name: cleanName(record.name) } : {}),
      ...(cleanMime(record.mimeType) ? { mimeType: cleanMime(record.mimeType) } : {}),
    })
    if (safe.length >= limit) break
  }

  return safe
}

export function formatGuideMessageContent(text: string, attachments: GuideAttachment[] = []): string {
  const body = String(text ?? '').trim()
  const safe = normaliseGuideAttachments(attachments)
  if (safe.length === 0) return body
  return `${body}${body ? '\n\n' : ''}${GUIDE_ATTACHMENT_BLOCK_START}\n${JSON.stringify(safe)}\n${GUIDE_ATTACHMENT_BLOCK_END}`
}

export function parseGuideMessageContent(content: string): { text: string; attachments: GuideAttachment[] } {
  let text = String(content ?? '')
  const attachments: GuideAttachment[] = []
  const pattern = new RegExp(
    `\\n?${escapeRegExp(GUIDE_ATTACHMENT_BLOCK_START)}\\n([\\s\\S]*?)\\n${escapeRegExp(GUIDE_ATTACHMENT_BLOCK_END)}`,
    'g',
  )

  text = text.replace(pattern, (_match, rawJson: string) => {
    try {
      attachments.push(...normaliseGuideAttachments(JSON.parse(rawJson)))
    } catch {
      // Keep malformed marker blocks out of the visible message.
    }
    return ''
  })

  return { text: text.trim(), attachments }
}

export function toGuideModelMessageContent(content: string, extraAttachments: GuideAttachment[] = []): string {
  const parsed = parseGuideMessageContent(content)
  const attachments = normaliseGuideAttachments([...parsed.attachments, ...extraAttachments])
  if (attachments.length === 0) return parsed.text || String(content ?? '').trim()

  const lines = attachments.map((attachment) => {
    const label = attachment.name || attachment.url
    return `Attached ${attachment.type}: ${label} (${attachment.url})`
  })

  return [parsed.text || 'The user sent an attachment.', `Attachments:\n${lines.join('\n')}`]
    .filter(Boolean)
    .join('\n\n')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
