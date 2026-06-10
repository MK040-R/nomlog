import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/dal'
import { parseMeal, GeminiBusyError } from '@/lib/gemini/parse'

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
    const parsed = await parseMeal(text.data)
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
