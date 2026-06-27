import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { answerAsk, buildCrisisAskAnswer, type AskContext } from '@/lib/ai/ask'
import { getDb } from '@/server/db/client'
import { askQuestions, profiles } from '@/server/db/schema'
import { getSessionUserId } from '@/server/http/auth'
import { rateLimit } from '@/server/http/rate-limit'
import { checkAndConsume } from '@/server/billing/repo'
import { getConditionStudy } from '@/server/data/health'
import { getHealthTimeline } from '@/server/data/timeline'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RequestBody = { questionId?: string; question?: string; dryRun?: boolean }

type StructuredSource = NonNullable<AskContext['structuredSources']>[number]

function cleanList(value: unknown, limit = 5): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean))).slice(0, limit)
}

async function buildStructuredSources(db: ReturnType<typeof getDb>, userId: string): Promise<StructuredSource[]> {
  const sources: StructuredSource[] = []
  const ctx = { db, userId }

  try {
    const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) })
    const profileConditions = cleanList(profile?.conditions, 4)
    const profileComorbidities = cleanList(profile?.comorbidities, 4)
    if (profileConditions.length > 0 || profileComorbidities.length > 0) {
      sources.push({
        label: 'Profile health summary',
        source: 'KinSpace profile',
        summary: [
          profileConditions.length > 0 ? `Health conditions and disabilities: ${profileConditions.join(', ')}` : null,
          profileComorbidities.length > 0 ? `Other listed health conditions or disabilities: ${profileComorbidities.join(', ')}` : null,
        ].filter(Boolean).join('. '),
        confidence: 'Self-reported by this member',
      })
    }

    const timeline = await getHealthTimeline(ctx, userId, { limit: 8 })
    if (timeline.stats.total_events > 0) {
      const latest = timeline.events.slice(0, 5).map((event) => `${event.type}: ${event.title}`).join('; ')
      sources.push({
        label: 'Private timeline',
        source: 'KinSpace timeline',
        summary: `${timeline.stats.total_events} recent tracked events. Latest: ${latest}`,
        confidence: 'Private member history',
      })
    }

    for (const condition of profileConditions.slice(0, 2)) {
      const study = await getConditionStudy(ctx, condition)
      if (!study) continue
      const treatments = Array.isArray(study.top_treatments)
        ? study.top_treatments.slice(0, 3).map((item) => String((item as { name?: unknown }).name ?? '').trim()).filter(Boolean)
        : []
      sources.push({
        label: `${String(study.condition?.name ?? condition)} member study`,
        source: 'KinSpace condition reports',
        summary: `${study.report_count} member reports. Top treatments: ${treatments.length > 0 ? treatments.join(', ') : 'not enough data yet'}`,
        confidence: String(study.confidence_label ?? 'Early signal'),
      })
    }
  } catch (error) {
    console.error('Failed to build Ask structured context:', error)
  }

  return sources.slice(0, 8)
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId(request)
  if (!userId) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 })

  const limited = await rateLimit(`ask:${userId}`, 20, 60)
  if (!limited.allowed) return NextResponse.json({ ok: false, error: 'Slow down a moment.' }, { status: 429 })

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 })
  }

  const db = getDb()
  const questionId = (body.questionId ?? '').trim()
  const savedQuestion = questionId
    ? await db.query.askQuestions.findFirst({ where: eq(askQuestions.id, questionId) })
    : null

  if (questionId && !savedQuestion) {
    return NextResponse.json({ ok: false, error: 'Question not found.' }, { status: 404 })
  }
  if (savedQuestion && savedQuestion.userId !== userId) {
    return NextResponse.json({ ok: false, error: 'You can only refresh your own Ask answer.' }, { status: 403 })
  }

  const questionTitle = (savedQuestion?.question ?? body.question ?? '').trim()
  const questionDetails = (savedQuestion?.body ?? '').trim()
  const question = questionDetails ? `${questionTitle}\n\nDetails: ${questionDetails}` : questionTitle
  if (!question) return NextResponse.json({ ok: false, error: 'A question is required.' }, { status: 400 })
  if (question.length > 2000) return NextResponse.json({ ok: false, error: 'Question is too long.' }, { status: 400 })

  const crisisAnswer = buildCrisisAskAnswer(question)
  if (crisisAnswer) {
    if (questionId && !body.dryRun && savedQuestion) {
      await db
        .update(askQuestions)
        .set({
          aiAnswer: crisisAnswer.answer_markdown,
          aiPlainSummary: crisisAnswer.plain_language_summary,
          aiRedFlags: crisisAnswer.red_flags,
          aiSelfCare: crisisAnswer.self_care_suggestions,
          aiSeeProfessional: crisisAnswer.when_to_see_a_professional,
          tags: crisisAnswer.tags,
          aiSources: crisisAnswer.sources,
          aiRedditThreads: crisisAnswer.reddit_threads,
          status: 'answered',
          updatedAt: new Date(),
        })
        .where(eq(askQuestions.id, questionId))
        .catch((error) => console.error('Failed to persist ask crisis answer:', error))
    }

    return NextResponse.json({
      ok: true,
      answer: {
        answer_markdown: crisisAnswer.answer_markdown,
        plain_language_summary: crisisAnswer.plain_language_summary,
        red_flags: crisisAnswer.red_flags,
        self_care_suggestions: crisisAnswer.self_care_suggestions,
        when_to_see_a_professional: crisisAnswer.when_to_see_a_professional,
        tags: crisisAnswer.tags,
        sources: crisisAnswer.sources,
        reddit_threads: crisisAnswer.reddit_threads,
      },
      relatedQuestions: [],
      crisis: true,
    })
  }

  const quota = await checkAndConsume(userId, 'ai_ask')
  if (!quota.allowed) {
    return NextResponse.json(
      { ok: false, error: 'You’ve reached your monthly question limit. Upgrade for more.', upgrade: true },
      { status: 402 },
    )
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: 'AI is not configured.' }, { status: 500 })
  }

  const context: AskContext = {
    relatedQuestions: [],
    structuredSources: await buildStructuredSources(db, userId),
  }

  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 8)
  if (words.length > 0) {
    const all = await db.query.askQuestions.findMany({ where: eq(askQuestions.scope, 'public'), limit: 50 })
    context.relatedQuestions = all
      .map((q) => {
        const text = `${q.question ?? ''} ${q.body ?? ''}`.toLowerCase()
        const score = words.reduce((total, w) => (text.includes(w) ? total + 1 : total), 0)
        return { id: q.id, question: q.question ?? '', created_at: q.createdAt, score }
      })
      .filter((e) => e.score > 0 && e.id !== questionId)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((e) => ({ id: e.id, question: e.question, created_at: e.created_at }))
  }

  const answer = await answerAsk(question, context)
  if (!answer) return NextResponse.json({ ok: false, error: 'Could not synthesize an answer.' }, { status: 502 })

  if (questionId && !body.dryRun && savedQuestion) {
    await db
      .update(askQuestions)
      .set({
        aiAnswer: answer.answer_markdown,
        aiPlainSummary: answer.plain_language_summary,
        aiRedFlags: answer.red_flags,
        aiSelfCare: answer.self_care_suggestions,
        aiSeeProfessional: answer.when_to_see_a_professional,
        tags: answer.tags,
        aiSources: answer.sources,
        aiRedditThreads: answer.reddit_threads,
        status: 'answered',
        updatedAt: new Date(),
      })
      .where(eq(askQuestions.id, questionId))
      .catch((error) => console.error('Failed to persist ask answer:', error))
  }

  return NextResponse.json({
    ok: true,
    answer: {
      answer_markdown: answer.answer_markdown,
      plain_language_summary: answer.plain_language_summary,
      red_flags: answer.red_flags,
      self_care_suggestions: answer.self_care_suggestions,
      when_to_see_a_professional: answer.when_to_see_a_professional,
      tags: answer.tags,
      sources: answer.sources,
      reddit_threads: answer.reddit_threads,
    },
    relatedQuestions: context.relatedQuestions,
  })
}
