import { eq, and, sql } from 'drizzle-orm'
import type { Ctx } from './_shared'
import {
  requireActor,
  getProfileSummary,
  getProfileSummaries,
  sortByNewest,
} from './_shared'
import { askQuestions, askAnswers, askAnswerVotes } from '@/server/db/schema'

type AskSource = { index: number; title: string; url: string; domain: string }
type RedditThread = { title: string; url: string; subreddit: string; snippet: string }

/** Create a community/AI Ask question. Actor derived from ctx (the passed userId is ignored for auth). */
export async function createAskQuestion(
  ctx: Ctx,
  _userId: string,
  data: {
    question: string
    body?: string
    scope?: 'public' | 'group'
    group_id?: string | null
    is_anonymous?: boolean
    related_conditions?: string[]
  },
) {
  const actor = requireActor(ctx)
  const id = crypto.randomUUID()
  await ctx.db.insert(askQuestions).values({
    id,
    userId: actor,
    question: data.question,
    body: data.body ?? '',
    scope: data.scope ?? 'public',
    groupId: data.group_id ?? null,
    isAnonymous: Boolean(data.is_anonymous),
    relatedConditions: data.related_conditions ?? [],
    tags: [],
    aiAnswer: null,
    aiPlainSummary: null,
    aiRedFlags: [],
    aiSelfCare: [],
    aiSeeProfessional: [],
    aiSources: [],
    aiRedditThreads: [],
    answersCount: 0,
    upvotes: 0,
    status: 'pending-answer',
  })
  return { id }
}

/** Attach the AI-synthesised answer payload to an existing question. */
export async function attachAskAiAnswer(
  ctx: Ctx,
  questionId: string,
  payload: {
    answer_markdown: string
    plain_language_summary?: string
    red_flags?: string[]
    self_care?: string[]
    see_professional?: string[]
    tags?: string[]
    sources?: AskSource[]
    reddit_threads?: RedditThread[]
  },
) {
  const userId = requireActor(ctx)
  const question = await ctx.db.query.askQuestions.findFirst({ where: eq(askQuestions.id, questionId) })
  if (!question || question.userId !== userId) throw new Error('Not authorized')
  await ctx.db
    .update(askQuestions)
    .set({
      aiAnswer: payload.answer_markdown,
      aiPlainSummary: payload.plain_language_summary ?? null,
      aiRedFlags: payload.red_flags ?? [],
      aiSelfCare: payload.self_care ?? [],
      aiSeeProfessional: payload.see_professional ?? [],
      tags: payload.tags ?? [],
      aiSources: payload.sources ?? [],
      aiRedditThreads: payload.reddit_threads ?? [],
      status: 'answered',
      updatedAt: new Date(),
    })
    .where(eq(askQuestions.id, questionId))
}

/** List Ask questions with hydrated author profiles, then filter/sort/slice in memory like the original. */
export async function getAskQuestions(
  ctx: Ctx,
  options?: {
    limit?: number
    tag?: string
    search?: string
    groupId?: string | null
  },
) {
  const rows = await ctx.db.query.askQuestions.findMany()
  const summaries = await getProfileSummaries(
    ctx.db,
    rows.filter((row) => !row.isAnonymous).map((row) => row.userId),
  )
  const items = rows.map((row) => ({
    ...row,
    profile: row.isAnonymous ? null : summaries.get(row.userId) ?? null,
  }))

  const tag = options?.tag
  const search = options?.search?.toLowerCase().trim()
  const groupId = options?.groupId

  return sortByNewest(
    items.filter((item) => {
      if (groupId && item.groupId !== groupId) return false
      if (!groupId && item.scope === 'group') return false // don't show group-scoped in public feed
      if (tag) {
        const tags = item.tags ?? []
        if (!tags.includes(tag)) return false
      }
      if (search) {
        const haystack = `${item.question ?? ''} ${item.body ?? ''}`.toLowerCase()
        if (!haystack.includes(search)) return false
      }
      return true
    }),
  ).slice(0, options?.limit ?? 30)
}

/** Fetch a single Ask question with its author profile (null when anonymous). */
export async function getAskQuestion(ctx: Ctx, questionId: string) {
  const row = await ctx.db.query.askQuestions.findFirst({
    where: eq(askQuestions.id, questionId),
  })
  if (!row) return null
  const profile = row.isAnonymous ? null : await getProfileSummary(ctx.db, row.userId)
  return { ...row, profile }
}

/** Naive similarity: match on shared significant words in the question. */
export async function findRelatedAskQuestions(
  ctx: Ctx,
  query: string,
  excludeIds: string[] = [],
  limit = 4,
) {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 8)
  if (words.length === 0) return []

  const rows = await ctx.db.query.askQuestions.findMany()
  const scored = rows
    .map((row) => {
      const text = `${row.question ?? ''} ${row.body ?? ''}`.toLowerCase()
      const score = words.reduce((total, word) => (text.includes(word) ? total + 1 : total), 0)
      return { row, score }
    })
    .filter((entry) => entry.score > 0 && !excludeIds.includes(entry.row.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return scored.map((entry) => ({
    id: entry.row.id,
    question: entry.row.question,
    createdAt: entry.row.createdAt,
  }))
}

/** Add a human answer to a question and bump its answers_count. Actor derived from ctx. */
export async function addAskAnswer(
  ctx: Ctx,
  questionId: string,
  _userId: string,
  content: string,
  isAnonymous = false,
) {
  const actor = requireActor(ctx)
  const id = crypto.randomUUID()
  await ctx.db.insert(askAnswers).values({
    id,
    questionId,
    userId: actor,
    content,
    isAnonymous,
    upvotes: 0,
    isAi: false,
  })

  await ctx.db
    .update(askQuestions)
    .set({
      answersCount: sql`${askQuestions.answersCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(askQuestions.id, questionId))

  return { id }
}

/** List answers for a question, hydrate authors, then order by upvotes desc and cap. */
export async function getAskAnswers(ctx: Ctx, questionId: string, limit = 40) {
  const rows = await ctx.db.query.askAnswers.findMany({
    where: eq(askAnswers.questionId, questionId),
  })
  const summaries = await getProfileSummaries(
    ctx.db,
    rows.filter((row) => !row.isAnonymous).map((row) => row.userId),
  )
  const items = rows.map((row) => ({
    ...row,
    profile:
      row.isAnonymous || !row.userId ? null : summaries.get(row.userId) ?? null,
  }))
  return items
    .sort((first, second) => (second.upvotes ?? 0) - (first.upvotes ?? 0))
    .slice(0, limit)
}

/** Toggle an upvote on an answer (one vote per user) and keep the counter in sync. Actor derived from ctx. */
export async function upvoteAskAnswer(ctx: Ctx, _userId: string, answerId: string) {
  const actor = requireActor(ctx)
  const existing = await ctx.db.query.askAnswerVotes.findFirst({
    where: and(eq(askAnswerVotes.answerId, answerId), eq(askAnswerVotes.userId, actor)),
  })
  if (existing) {
    await ctx.db.delete(askAnswerVotes).where(eq(askAnswerVotes.id, existing.id))
    await ctx.db
      .update(askAnswers)
      .set({ upvotes: sql`${askAnswers.upvotes} - 1` })
      .where(eq(askAnswers.id, answerId))
    return { voted: false }
  }
  await ctx.db.insert(askAnswerVotes).values({
    id: crypto.randomUUID(),
    answerId,
    userId: actor,
  })
  await ctx.db
    .update(askAnswers)
    .set({ upvotes: sql`${askAnswers.upvotes} + 1` })
    .where(eq(askAnswers.id, answerId))
  return { voted: true }
}
