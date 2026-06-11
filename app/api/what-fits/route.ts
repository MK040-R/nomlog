import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { suggestWhatFits } from '@/lib/gemini/whatFits'
import { GeminiBusyError } from '@/lib/gemini/generate'
import { getTodaySummary } from '@/lib/today'
import { hourNow } from '@/lib/nutrition'
import { getUserTz } from '@/lib/tz-server'

// POST /api/what-fits → 2-3 dishes that fit what's left of today's budget.
// On-demand only: one Gemini call per tap, remaining computed server-side.
export async function POST() {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const tz = await getUserTz()
  const supabase = await createClient()
  const { goals, consumed, mealNames } = await getTodaySummary(supabase, user.id, tz)
  const remaining = {
    calories: goals.calories - consumed.calories,
    protein: Math.max(0, goals.protein - consumed.protein),
    carbs: Math.max(0, goals.carbs - consumed.carbs),
    fat: Math.max(0, goals.fat - consumed.fat),
    fiber: Math.max(0, goals.fiber - consumed.fiber),
  }

  try {
    const suggestions = await suggestWhatFits({ remaining, mealNames, hourLocal: hourNow(tz) })
    return NextResponse.json({ remaining, suggestions })
  } catch (err) {
    console.error('what-fits failed:', err)
    if (err instanceof GeminiBusyError) {
      return NextResponse.json(
        { error: 'The food AI is busy right now. Give it a few seconds and try again.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: "Couldn't think of anything just now. Try again." }, { status: 502 })
  }
}
