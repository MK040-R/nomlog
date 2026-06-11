import { NextResponse } from 'next/server'

// Gemini calls can retry across models — give Vercel room beyond the default 10s.
export const maxDuration = 60
import { z } from 'zod'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { askCoach } from '@/lib/gemini/ask'
import { GeminiBusyError } from '@/lib/gemini/generate'
import { getTodaySummary } from '@/lib/today'
import { dayRange, ymdOf, hourNow, lastNDays } from '@/lib/nutrition'
import { getUserTz } from '@/lib/tz-server'

// POST /api/ask → one grounded coach answer.
// The rolling window lives on the client (ASK-05/06): it sends up to the last
// 3 exchanges back; nothing is persisted server-side.
const ExchangeSchema = z.object({
  q: z.string().trim().min(1).max(500),
  a: z.string().trim().min(1).max(2000),
})
const BodySchema = z.object({
  question: z.string().trim().min(1).max(500),
  history: z.array(ExchangeSchema).max(3).default([]),
})

export async function POST(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ask me something about your food.' }, { status: 400 })
  }

  const tz = await getUserTz()
  const supabase = await createClient()
  const days = lastNDays(tz, 7)
  const { startIso } = dayRange(tz, days[0])
  const { endIso } = dayRange(tz, days[6])

  const [summary, { data: weekMeals }, { data: weights }] = await Promise.all([
    getTodaySummary(supabase, user.id, tz),
    supabase
      .from('meal_logs')
      .select('logged_at, total_calories')
      .gte('logged_at', startIso)
      .lt('logged_at', endIso),
    supabase
      .from('weight_logs')
      .select('logged_on, weight_kg')
      .order('logged_on', { ascending: false })
      .limit(3),
  ])

  const calByDay: Record<string, number> = {}
  for (const m of weekMeals ?? []) {
    const d = ymdOf(tz, m.logged_at)
    calByDay[d] = (calByDay[d] ?? 0) + m.total_calories
  }
  const weekLines = days.map((d) => `${d}: ${calByDay[d] ? `${calByDay[d]} kcal` : 'nothing logged'}`)
  const weightLines = (weights ?? []).map((w) => `${Number(w.weight_kg).toFixed(1)} kg on ${w.logged_on}`)

  try {
    const reply = await askCoach({
      goals: summary.goals,
      consumed: summary.consumed,
      mealNames: summary.mealNames,
      hourLocal: hourNow(tz),
      weekLines,
      weightLines,
      history: parsed.data.history,
      question: parsed.data.question,
    })
    return NextResponse.json(reply)
  } catch (err) {
    console.error('ask failed:', err)
    if (err instanceof GeminiBusyError) {
      return NextResponse.json(
        { error: 'The coach is busy right now. Give it a few seconds and ask again.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: "Couldn't answer that just now. Try again." }, { status: 502 })
  }
}
