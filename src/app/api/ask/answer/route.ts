import { NextRequest, NextResponse } from 'next/server'
import { answerAsk, type AskContext } from '@/lib/ai/ask'
import { getAdminDb, isAdminConfigured } from '@/lib/server/firebase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RequestBody = {
  questionId?: string
  userId?: string | null
  question?: string
  /** When true, we only run the AI + web search and return, without writing to Firestore. */
  dryRun?: boolean
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY is not set' }, { status: 500 })
  }
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Firebase Admin not configured — cannot persist answers' },
      { status: 500 },
    )
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const question = (body.question ?? '').trim()
  if (!question) {
    return NextResponse.json({ ok: false, error: 'question is required' }, { status: 400 })
  }
  if (question.length > 1200) {
    return NextResponse.json({ ok: false, error: 'question too long' }, { status: 400 })
  }

  const db = getAdminDb()

  // Build context: the user's profile (if signed in) + related past questions
  const context: AskContext = {
    conditions: [],
    medications: [],
    age: null,
    relatedQuestions: [],
  }

  if (body.userId) {
    try {
      const profileSnap = await db.collection('profiles').doc(body.userId).get()
      const profile = profileSnap.data()
      if (profile) {
        context.conditions = Array.isArray(profile.conditions) ? (profile.conditions as string[]) : []
        context.medications = Array.isArray(profile.medications)
          ? (profile.medications as string[])
          : []
        context.age = (profile.age as number | undefined) ?? null
      }
    } catch {
      // Non-fatal — just answer without profile context.
    }
  }

  try {
    const relatedSnap = await db
      .collection('ask_questions')
      .where('scope', '==', 'public')
      .limit(50)
      .get()
    const words = question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 8)

    if (words.length > 0) {
      context.relatedQuestions = relatedSnap.docs
        .map((doc) => {
          const data = doc.data()
          const text = `${data.question ?? ''} ${data.body ?? ''}`.toLowerCase()
          const score = words.reduce((total, word) => (text.includes(word) ? total + 1 : total), 0)
          return {
            id: doc.id,
            question: (data.question as string) ?? '',
            created_at: data.created_at,
            score,
          }
        })
        .filter((entry) => entry.score > 0 && entry.id !== body.questionId)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map((entry) => ({ id: entry.id, question: entry.question, created_at: entry.created_at }))
    }
  } catch {
    // No related questions — fine.
  }

  const answer = await answerAsk(question, context)
  if (!answer) {
    return NextResponse.json(
      { ok: false, error: 'Could not synthesize an answer' },
      { status: 502 },
    )
  }

  // Persist onto the question doc so it doesn't need to be regenerated on each view.
  if (body.questionId && !body.dryRun) {
    await db
      .collection('ask_questions')
      .doc(body.questionId)
      .update({
        ai_answer: answer.answer_markdown,
        ai_plain_summary: answer.plain_language_summary,
        ai_red_flags: answer.red_flags,
        ai_self_care: answer.self_care_suggestions,
        ai_see_professional: answer.when_to_see_a_professional,
        tags: answer.tags,
        ai_sources: answer.sources,
        ai_reddit_threads: answer.reddit_threads,
        ai_related_questions: context.relatedQuestions,
        status: 'answered',
        updated_at: new Date(),
      })
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
