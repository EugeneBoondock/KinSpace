import { and, eq } from 'drizzle-orm'
import { getPersona } from '@/lib/therapy-config'
import { decryptField, encryptField } from '@/server/crypto/field-encryption'
import type { Database } from '@/server/db/client'
import { guideMemories, therapySessions } from '@/server/db/schema'

const MAX_MEMORY_CHARS = 24_000
const PDF_PAGE_LINE_COUNT = 48
const PDF_LINE_WIDTH = 88

export type GuideMemorySessionInput = {
  sessionId: string
  summary: string
  keyThemes?: string[] | null
  endedAt?: Date | string | null
}

export type GuideMemorySnapshot = {
  personaId: string
  personaName: string
  summary: string
  latestSessionSummary: string | null
  latestSessionId: string | null
  latestSessionEndedAt: Date | null
  keyThemes: string[]
  sessionCount: number
  updatedAt: Date | null
}

export function normaliseGuidePersonaId(personaId: string | null | undefined): string {
  return getPersona(personaId ?? null).id
}

function markerFor(sessionId: string): string {
  return String(sessionId || 'session').replace(/[^a-zA-Z0-9_-]/g, '_')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDay(value: Date | string | null | undefined): string {
  return toDate(value)?.toISOString().slice(0, 10) ?? 'Unknown date'
}

function cleanThemes(value: string[] | null | undefined): string[] {
  return Array.from(
    new Set(
      (value ?? [])
        .map((theme) => String(theme ?? '').trim())
        .filter(Boolean)
        .slice(0, 8),
    ),
  )
}

function removeSessionBlock(summary: string, sessionId: string): string {
  const marker = markerFor(sessionId)
  const pattern = new RegExp(
    `\\n?<!-- guide-session:${escapeRegExp(marker)} -->[\\s\\S]*?<!-- /guide-session:${escapeRegExp(marker)} -->\\n?`,
    'g',
  )
  return summary.replace(pattern, '\n').trim()
}

function hasSessionBlock(summary: string | null | undefined, sessionId: string): boolean {
  if (!summary) return false
  return summary.includes(`<!-- guide-session:${markerFor(sessionId)} -->`)
}

function formatSessionBlock(input: GuideMemorySessionInput): string {
  const marker = markerFor(input.sessionId)
  const themes = cleanThemes(input.keyThemes)
  const themeLine = themes.length > 0 ? `Themes: ${themes.join(', ')}` : 'Themes: none saved'
  return [
    `<!-- guide-session:${marker} -->`,
    `### Session on ${formatDay(input.endedAt)}`,
    themeLine,
    '',
    String(input.summary ?? '').trim(),
    `<!-- /guide-session:${marker} -->`,
  ].join('\n')
}

function trimGuideMemory(summary: string): string {
  if (summary.length <= MAX_MEMORY_CHARS) return summary
  const blocks = summary.match(/<!-- guide-session:[\s\S]*?<!-- \/guide-session:[^>]+ -->/g) ?? []
  if (blocks.length === 0) return summary.slice(-MAX_MEMORY_CHARS).trim()

  const kept: string[] = []
  let size = '## Session notes\n\n'.length
  for (const block of [...blocks].reverse()) {
    if (size + block.length + 2 > MAX_MEMORY_CHARS) break
    kept.unshift(block)
    size += block.length + 2
  }
  return ['## Session notes', '', ...kept].join('\n\n').trim()
}

export function expandGuideMemory(input: {
  existingSummary?: string | null
  sessionId: string
  sessionSummary: string
  keyThemes?: string[] | null
  endedAt?: Date | string | null
}): string {
  const sessionSummary = String(input.sessionSummary ?? '').trim()
  if (!sessionSummary) return String(input.existingSummary ?? '').trim()

  const existing = removeSessionBlock(String(input.existingSummary ?? '').trim(), input.sessionId)
  const base = existing || '## Session notes'
  const next = `${base}\n\n${formatSessionBlock({
    sessionId: input.sessionId,
    summary: sessionSummary,
    keyThemes: input.keyThemes,
    endedAt: input.endedAt,
  })}`

  return trimGuideMemory(next)
}

export function buildGuideMemoryFromSessions(sessions: GuideMemorySessionInput[]): string {
  return [...sessions]
    .filter((session) => String(session.summary ?? '').trim())
    .sort((first, second) => (toDate(first.endedAt)?.getTime() ?? 0) - (toDate(second.endedAt)?.getTime() ?? 0))
    .reduce(
      (summary, session) =>
        expandGuideMemory({
          existingSummary: summary,
          sessionId: session.sessionId,
          sessionSummary: session.summary,
          keyThemes: session.keyThemes,
          endedAt: session.endedAt,
        }),
      '',
    )
}

function emptyGuideMemorySnapshot(personaId: string | null | undefined): GuideMemorySnapshot {
  const persona = getPersona(personaId ?? null)
  return {
    personaId: persona.id,
    personaName: persona.name,
    summary: '',
    latestSessionSummary: null,
    latestSessionId: null,
    latestSessionEndedAt: null,
    keyThemes: [],
    sessionCount: 0,
    updatedAt: null,
  }
}

async function getSummarisedSessions(
  db: Database,
  userId: string,
  personaId: string,
  options: { excludeSessionId?: string } = {},
): Promise<GuideMemorySessionInput[]> {
  const rows = await db.query.therapySessions.findMany({ where: eq(therapySessions.userId, userId) })
  const sessions: GuideMemorySessionInput[] = []

  for (const row of rows) {
    if (row.id === options.excludeSessionId) continue
    if (normaliseGuidePersonaId(row.persona) !== personaId) continue
    const summary = await decryptField(row.summary)
    if (!summary) continue
    sessions.push({
      sessionId: row.id,
      summary,
      keyThemes: row.keyThemes ?? [],
      endedAt: row.endedAt ?? row.updatedAt ?? row.startedAt ?? null,
    })
  }

  return sessions.sort(
    (first, second) => (toDate(first.endedAt)?.getTime() ?? 0) - (toDate(second.endedAt)?.getTime() ?? 0),
  )
}

async function readStoredGuideMemory(
  db: Database,
  userId: string,
  personaId: string,
): Promise<GuideMemorySnapshot | null> {
  const row = await db.query.guideMemories.findFirst({
    where: and(eq(guideMemories.userId, userId), eq(guideMemories.persona, personaId)),
  })
  if (!row) return null

  const persona = getPersona(personaId)
  return {
    personaId,
    personaName: persona.name,
    summary: (await decryptField(row.summary)) ?? '',
    latestSessionSummary: await decryptField(row.latestSessionSummary),
    latestSessionId: row.latestSessionId ?? null,
    latestSessionEndedAt: toDate(row.latestSessionEndedAt as never),
    keyThemes: cleanThemes(row.keyThemes),
    sessionCount: row.sessionCount ?? 0,
    updatedAt: toDate(row.updatedAt as never),
  }
}

async function writeGuideMemory(db: Database, userId: string, snapshot: GuideMemorySnapshot): Promise<GuideMemorySnapshot> {
  const encryptedSummary = await encryptField(snapshot.summary)
  const encryptedLatest = await encryptField(snapshot.latestSessionSummary)
  const now = new Date()
  const values = {
    id: `${userId}:${snapshot.personaId}`,
    userId,
    persona: snapshot.personaId,
    summary: encryptedSummary,
    latestSessionSummary: encryptedLatest,
    latestSessionId: snapshot.latestSessionId,
    latestSessionEndedAt: snapshot.latestSessionEndedAt,
    keyThemes: snapshot.keyThemes,
    sessionCount: snapshot.sessionCount,
    updatedAt: now,
  }

  await db
    .insert(guideMemories)
    .values(values)
    .onConflictDoUpdate({
      target: [guideMemories.userId, guideMemories.persona],
      set: {
        summary: encryptedSummary,
        latestSessionSummary: encryptedLatest,
        latestSessionId: snapshot.latestSessionId,
        latestSessionEndedAt: snapshot.latestSessionEndedAt,
        keyThemes: snapshot.keyThemes,
        sessionCount: snapshot.sessionCount,
        updatedAt: now,
      },
    })

  return { ...snapshot, updatedAt: now }
}

export async function getOrBuildGuideMemory(
  db: Database,
  userId: string,
  personaIdInput: string | null | undefined,
): Promise<GuideMemorySnapshot> {
  const personaId = normaliseGuidePersonaId(personaIdInput)
  const stored = await readStoredGuideMemory(db, userId, personaId)
  if (stored?.summary) return stored

  const sessions = await getSummarisedSessions(db, userId, personaId)
  if (sessions.length === 0) return stored ?? emptyGuideMemorySnapshot(personaId)

  const latest = sessions[sessions.length - 1]
  const snapshot: GuideMemorySnapshot = {
    ...emptyGuideMemorySnapshot(personaId),
    summary: buildGuideMemoryFromSessions(sessions),
    latestSessionSummary: latest.summary,
    latestSessionId: latest.sessionId,
    latestSessionEndedAt: toDate(latest.endedAt),
    keyThemes: cleanThemes(latest.keyThemes),
    sessionCount: sessions.length,
  }
  return writeGuideMemory(db, userId, snapshot).catch(() => snapshot)
}

export async function updateGuideMemoryFromSession(
  db: Database,
  input: {
    userId: string
    personaId?: string | null
    sessionId: string
    sessionSummary: string
    keyThemes?: string[] | null
    endedAt?: Date | string | null
  },
): Promise<GuideMemorySnapshot | null> {
  const sessionSummary = String(input.sessionSummary ?? '').trim()
  if (!sessionSummary) return null

  const personaId = normaliseGuidePersonaId(input.personaId)
  const stored = await readStoredGuideMemory(db, input.userId, personaId)
  const base =
    stored ??
    (() => {
      const empty = emptyGuideMemorySnapshot(personaId)
      return empty
    })()

  let existingSummary = base.summary
  let sessionCount = base.sessionCount
  if (!stored) {
    const previousSessions = await getSummarisedSessions(db, input.userId, personaId, { excludeSessionId: input.sessionId })
    existingSummary = buildGuideMemoryFromSessions(previousSessions)
    sessionCount = previousSessions.length
  }
  if (!hasSessionBlock(existingSummary, input.sessionId)) sessionCount += 1

  const snapshot: GuideMemorySnapshot = {
    ...base,
    summary: expandGuideMemory({
      existingSummary,
      sessionId: input.sessionId,
      sessionSummary,
      keyThemes: input.keyThemes,
      endedAt: input.endedAt,
    }),
    latestSessionSummary: sessionSummary,
    latestSessionId: input.sessionId,
    latestSessionEndedAt: toDate(input.endedAt) ?? new Date(),
    keyThemes: cleanThemes(input.keyThemes),
    sessionCount,
  }

  return writeGuideMemory(db, input.userId, snapshot)
}

export async function rebuildGuideMemory(
  db: Database,
  userId: string,
  personaIdInput: string | null | undefined,
): Promise<GuideMemorySnapshot> {
  const personaId = normaliseGuidePersonaId(personaIdInput)
  const sessions = await getSummarisedSessions(db, userId, personaId)
  if (sessions.length === 0) {
    await db
      .delete(guideMemories)
      .where(and(eq(guideMemories.userId, userId), eq(guideMemories.persona, personaId)))
    return emptyGuideMemorySnapshot(personaId)
  }

  const latest = sessions[sessions.length - 1]
  return writeGuideMemory(db, userId, {
    ...emptyGuideMemorySnapshot(personaId),
    summary: buildGuideMemoryFromSessions(sessions),
    latestSessionSummary: latest.summary,
    latestSessionId: latest.sessionId,
    latestSessionEndedAt: toDate(latest.endedAt),
    keyThemes: cleanThemes(latest.keyThemes),
    sessionCount: sessions.length,
  })
}

function formatDateTime(value: Date | string | null | undefined): string {
  const date = toDate(value)
  if (!date) return 'Not saved yet'
  return date.toISOString().replace('T', ' ').slice(0, 16)
}

export function formatGuideMemoryMarkdown(snapshot: GuideMemorySnapshot): string {
  const themes = cleanThemes(snapshot.keyThemes)
  return [
    `# ${snapshot.personaName} Guide memory`,
    '',
    `Updated: ${formatDateTime(snapshot.updatedAt)}`,
    `Sessions remembered: ${snapshot.sessionCount}`,
    `Latest session ended: ${formatDateTime(snapshot.latestSessionEndedAt)}`,
    themes.length > 0 ? `Latest themes: ${themes.join(', ')}` : 'Latest themes: none saved',
    '',
    '## Latest session',
    '',
    snapshot.latestSessionSummary || 'No latest session saved yet.',
    '',
    '## Memory notes',
    '',
    stripGuideMemoryMarkers(snapshot.summary) || 'No memory saved yet.',
    '',
  ].join('\n')
}

function stripMarkdownForDocument(markdown: string): string {
  return String(markdown ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripGuideMemoryMarkers(summary: string): string {
  return String(summary ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n').trim()
}

function asciiForPdf(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, '')
    .replace(/\t/g, '  ')
}

function wrapText(value: string, width: number): string[] {
  const lines: string[] = []
  for (const rawLine of value.split(/\r?\n/)) {
    const words = rawLine.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of words) {
      if (!line) {
        line = word
      } else if (line.length + word.length + 1 <= width) {
        line += ` ${word}`
      } else {
        lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

export function buildGuideMemoryPdf(markdown: string): Uint8Array {
  const text = asciiForPdf(stripMarkdownForDocument(markdown))
  const wrapped = wrapText(text || 'No memory saved yet.', PDF_LINE_WIDTH)
  const chunks: string[][] = []
  for (let index = 0; index < wrapped.length; index += PDF_PAGE_LINE_COUNT) {
    chunks.push(wrapped.slice(index, index + PDF_PAGE_LINE_COUNT))
  }

  const objects: string[] = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  const pageIds: number[] = []
  for (const lines of chunks.length > 0 ? chunks : [['No memory saved yet.']]) {
    const content = [
      'BT',
      '/F1 11 Tf',
      '14 TL',
      '50 742 Td',
      ...lines.map((line, index) => `${index === 0 ? '' : 'T* '}${line ? `(${escapePdfText(line)}) Tj` : '() Tj'}`),
      'ET',
    ].join('\n')
    const pageId = objects.length + 1
    const contentId = pageId + 1
    pageIds.push(pageId)
    objects.push(
      `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 3 0 R >> >> /MediaBox [0 0 612 792] /Contents ${contentId} 0 R >>`,
      `<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`,
    )
  }

  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }
  const xrefOffset = byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return new TextEncoder().encode(pdf)
}

function xmlEscape(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
}

function buildDocumentXml(markdown: string): string {
  const lines = stripMarkdownForDocument(markdown).split(/\r?\n/)
  const paragraphs = (lines.length > 0 ? lines : ['No memory saved yet.'])
    .map((line) => {
      const text = xmlEscape(line || ' ')
      return `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[index] = value >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function uint16(value: number): Uint8Array {
  const out = new Uint8Array(2)
  new DataView(out.buffer).setUint16(0, value, true)
  return out
}

function uint32(value: number): Uint8Array {
  const out = new Uint8Array(4)
  new DataView(out.buffer).setUint32(0, value >>> 0, true)
  return out
}

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function zipStore(files: Array<{ name: string; data: string }>): Uint8Array {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const name = bytes(file.name)
    const data = bytes(file.data)
    const crc = crc32(data)
    const localHeader = concat([
      uint32(0x04034b50),
      uint16(20),
      uint16(0x0800),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(data.length),
      uint32(data.length),
      uint16(name.length),
      uint16(0),
      name,
    ])
    localParts.push(localHeader, data)

    centralParts.push(
      concat([
        uint32(0x02014b50),
        uint16(20),
        uint16(20),
        uint16(0x0800),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(crc),
        uint32(data.length),
        uint32(data.length),
        uint16(name.length),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(0),
        uint32(offset),
        name,
      ]),
    )
    offset += localHeader.length + data.length
  }

  const centralStart = offset
  const central = concat(centralParts)
  const end = concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(central.length),
    uint32(centralStart),
    uint16(0),
  ])

  return concat([...localParts, central, end])
}

export function buildGuideMemoryDocx(markdown: string): Uint8Array {
  return zipStore([
    {
      name: '[Content_Types].xml',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    },
    {
      name: '_rels/.rels',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    },
    { name: 'word/document.xml', data: buildDocumentXml(markdown) },
  ])
}
