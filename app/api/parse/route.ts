import { NextResponse } from 'next/server'

// Gemini calls can retry across models — give Vercel room beyond the default 10s.
export const maxDuration = 60
import { z } from 'zod'
import { verifySession } from '@/lib/dal'
import { parseMeal } from '@/lib/gemini/parse'
import { GeminiBusyError } from '@/lib/gemini/generate'
import { hourNow } from '@/lib/nutrition'
import { getUserTz } from '@/lib/tz-server'

export async function POST(request: Request) {
  const user = await verifySession()
  if (!user) {
    return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const text = z.string().trim().min(1).max(1000).safeParse(body?.text)
  if (!text.success) {
    return NextResponse.json({ error: 'Tell me what you ate.' }, { status: 400 })
  }

  try {
    const parsed = await parseMeal(text.data, hourNow(await getUserTz()))
    if (parsed.items.length === 0) {
      return NextResponse.json(
        { error: "That didn't sound like food. Try something like 'two rotis and dal'." },
        { status: 422 }
      )
    }
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('parseMeal failed:', err)
    if (err instanceof GeminiBusyError) {
      return NextResponse.json(
        { error: 'The food AI is busy right now. Give it a few seconds and tap Log it again.' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: "Couldn't read that. Try rephrasing what you ate." },
      { status: 502 }
    )
  }
}
