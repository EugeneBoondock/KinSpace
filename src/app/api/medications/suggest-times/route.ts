import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSessionUserId } from '@/server/http/auth'
import { rateLimit } from '@/server/http/rate-limit'
import {
  normalizeReminderTimes,
  suggestMedicationReminderTimesFallback,
  type ReminderTimeSuggestion,
} from '@/lib/medication-reminders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

type RequestBody = {
  medication?: string
  dose?: string
  frequency?: string
  timingHint?: string
}

type AiSuggestion = {
  times?: string[]
  note?: string
}

let client: OpenAI | null = null

function getClient() {
  if (client) return client
  if (!process.env.OPENAI_API_KEY) return null
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

function fallbackSuggestion(body: RequestBody): ReminderTimeSuggestion {
  return suggestMedicationReminderTimesFallback({
    frequency: body.frequency,
    timingHint: body.timingHint,
  })
}

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId(request)
  if (!userId) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 })

  const limited = await rateLimit(`med-time-suggest:${userId}`, 10, 60)
  if (!limited.allowed) return NextResponse.json({ ok: false, error: 'Slow down a moment.' }, { status: 429 })

  const body = (await request.json().catch(() => null)) as RequestBody | null
  if (!body) return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 })

  const medication = (body.medication ?? '').trim().slice(0, 120)
  const dose = (body.dose ?? '').trim().slice(0, 80)
  const frequency = (body.frequency ?? '').trim().slice(0, 120)
  const timingHint = (body.timingHint ?? '').trim().slice(0, 240)
  const fallback = fallbackSuggestion({ medication, dose, frequency, timingHint })
  const openai = getClient()

  if (!openai) {
    return NextResponse.json({ ok: true, source: 'fallback', ...fallback })
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content:
            'You suggest editable browser reminder times for KinSpace. Do not give medical advice. Do not tell the user to start, stop, change dose, or change clinical timing. Use only the user-provided frequency, food, morning, evening, bedtime, or routine hints. If timing depends on a prescription label or clinician instructions, say to follow those. Return JSON only: {"times":["HH:MM"],"note":"short note"}.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            medication,
            dose,
            frequency,
            timingHint,
            fallbackTimes: fallback.times,
          }),
        },
      ],
    })

    const text = completion.choices[0]?.message?.content?.trim()
    const parsed = text ? (JSON.parse(text) as AiSuggestion) : null
    const times = normalizeReminderTimes(parsed?.times ?? [])

    if (times.length === 0) {
      return NextResponse.json({ ok: true, source: 'fallback', ...fallback })
    }

    return NextResponse.json({
      ok: true,
      source: 'ai',
      times: times.slice(0, 6),
      note:
        parsed?.note?.trim().slice(0, 240) ||
        'Use these as editable reminders. Follow your prescription label if it says something different.',
    })
  } catch (error) {
    console.error('Medication time suggestion failed:', error)
    return NextResponse.json({ ok: true, source: 'fallback', ...fallback })
  }
}
