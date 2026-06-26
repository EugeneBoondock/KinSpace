import { inArray } from 'drizzle-orm'
import type { Database } from '@/server/db/client'
import { conditions, profiles, users } from '@/server/db/schema'
import { sendEmail } from '@/server/email'

type ConditionRow = typeof conditions.$inferSelect
type ProfileRow = typeof profiles.$inferSelect
type UserRow = Pick<typeof users.$inferSelect, 'id' | 'email' | 'emailVerified' | 'status'>

export type ResearchArticleEmailInput = {
  slug: string
  title: string
  excerpt?: string | null
  topic?: string | null
  tags?: string[] | null
  plainLanguageSummary?: string | null
  bodyMarkdown?: string | null
}

type SendEmail = typeof sendEmail

type MatchedCondition = {
  slug: string
  name: string
  terms: string[]
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function listStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean)
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean)
    }
  }
  return []
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(normalize).filter(Boolean)))
}

function termsForCondition(row: ConditionRow): MatchedCondition {
  return {
    slug: row.slug,
    name: row.name,
    terms: unique([row.slug.replace(/-/g, ' '), row.name, ...listStrings(row.aliases)]),
  }
}

function containsTerm(haystack: string, term: string): boolean {
  if (!term || term.length < 2) return false
  return ` ${haystack} `.includes(` ${term} `)
}

export function matchArticleConditions(
  article: ResearchArticleEmailInput,
  catalogRows: ConditionRow[],
): MatchedCondition[] {
  const haystack = normalize(
    [
      article.title,
      article.excerpt,
      article.topic,
      article.plainLanguageSummary,
      article.bodyMarkdown,
      ...(article.tags ?? []),
    ]
      .filter(Boolean)
      .join(' '),
  )
  if (!haystack) return []

  const matches = catalogRows
    .map(termsForCondition)
    .filter((condition) => condition.terms.some((term) => containsTerm(haystack, term)))

  return matches.slice(0, 4)
}

export function profileMatchesConditions(profile: ProfileRow, matched: MatchedCondition[]): MatchedCondition[] {
  if (matched.length === 0) return []
  const profileTerms = unique([...listStrings(profile.conditions), ...listStrings(profile.comorbidities)])
  return matched.filter((condition) => condition.terms.some((term) => profileTerms.includes(term)))
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://www.kinspace.co.za').replace(/\/+$/, '')
}

function articleUrl(slug: string): string {
  return `${appUrl()}/research/${encodeURIComponent(slug)}`
}

export function buildConditionArticleEmail(article: ResearchArticleEmailInput, conditionName: string) {
  const url = articleUrl(article.slug)
  const safeTitle = escapeHtml(article.title)
  const safeCondition = escapeHtml(conditionName)
  const safeSummary = escapeHtml(
    article.plainLanguageSummary || article.excerpt || 'A new plain-language research article is ready to read.',
  )
  const html = `
<div style="font-family:ui-sans-serif,system-ui,sans-serif;background:#2A4A42;color:#eedfc8;padding:32px;border-radius:16px;max-width:560px;margin:0 auto">
  <p style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(238,223,200,0.68);margin:0 0 12px">KinSpace research</p>
  <h1 style="font-size:22px;line-height:1.25;margin:0 0 14px">${safeTitle}</h1>
  <p style="line-height:1.6;margin:0 0 14px">This new article matched ${safeCondition} on your KinSpace profile.</p>
  <p style="line-height:1.6;margin:0 0 22px">${safeSummary}</p>
  <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#eedfc8;color:#2A4A42;font-weight:700;padding:12px 22px;border-radius:9999px;text-decoration:none">Read the article</a></p>
  <p style="color:rgba(238,223,200,0.62);font-size:12px;line-height:1.5;margin:0">This is information only, not medical advice. You can turn research email alerts off in Settings.</p>
</div>`
  const text = [
    article.title,
    '',
    `This new KinSpace article matched ${conditionName} on your profile.`,
    article.plainLanguageSummary || article.excerpt || '',
    '',
    `Read it here: ${url}`,
    '',
    'This is information only, not medical advice. You can turn research email alerts off in Settings.',
  ].join('\n')
  return {
    subject: 'New KinSpace article for your health shelf',
    html,
    text,
  }
}

export async function notifyConditionMembersForArticle(
  db: Database,
  article: ResearchArticleEmailInput,
  send: SendEmail = sendEmail,
): Promise<{ matchedConditions: string[]; attempted: number; sent: number; failed: number }> {
  const catalogRows = await db.query.conditions.findMany({ limit: 1000 })
  const matched = matchArticleConditions(article, catalogRows)
  if (matched.length === 0) return { matchedConditions: [], attempted: 0, sent: 0, failed: 0 }

  const profileRows = await db.query.profiles.findMany({ limit: 5000 })
  const candidates = profileRows
    .map((profile) => ({ profile, matched: profileMatchesConditions(profile, matched) }))
    .filter((entry) => entry.profile.notifyResearch !== false && entry.matched.length > 0)
    .slice(0, 500)

  if (candidates.length === 0) {
    return { matchedConditions: matched.map((condition) => condition.name), attempted: 0, sent: 0, failed: 0 }
  }

  const userIds = candidates.map((entry) => entry.profile.userId)
  const userRows = await db.query.users.findMany({ where: inArray(users.id, userIds) }) as UserRow[]
  const usersById = new Map(userRows.map((user) => [user.id, user]))

  let attempted = 0
  let sent = 0
  let failed = 0

  for (const candidate of candidates) {
    const user = usersById.get(candidate.profile.userId)
    if (!user || user.status !== 'active' || !user.emailVerified) continue

    const email = buildConditionArticleEmail(article, candidate.matched[0].name)
    attempted += 1
    const result = await send({ to: user.email, ...email })
    if (result.ok) sent += 1
    else failed += 1
  }

  return {
    matchedConditions: matched.map((condition) => condition.name),
    attempted,
    sent,
    failed,
  }
}
