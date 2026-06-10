import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { generateDailyTip } from '@/lib/gemini/tip'
import { GeminiBusyError } from '@/lib/gemini/generate'
import { getTodaySummary } from '@/lib/today'
import { istHourNow } from '@/lib/nutrition'

// GET /api/tip → today's tip, generated at most once per IST day and cached.
export async function GET() {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const supabase = await createClient()
  const { ymd, goals, consumed, mealNames } = await getTodaySummary(supabase, user.id)

  const { data: cached } = await supabase
    .from('daily_tips')
    .select('tip')
    .eq('tip_date', ymd)
    .maybeSingle()
  if (cached) return NextResponse.json({ tip: cached.tip, cached: true })

  try {
    const tip = await generateDailyTip({ goals, consumed, mealNames, hourIst: istHourNow() })

    // Cache it. On a same-morning race the unique index keeps one row; losing
    // the race is fine — we still return the tip we generated.
    const { error } = await supabase
      .from('daily_tips')
      .upsert({ user_id: user.id, tip_date: ymd, tip }, { onConflict: 'user_id,tip_date', ignoreDuplicates: true })
    if (error) console.error('tip cache write failed:', error)

    return NextResponse.json({ tip, cached: false })
  } catch (err) {
    console.error('tip generation failed:', err)
    const status = err instanceof GeminiBusyError ? 503 : 502
    return NextResponse.json({ error: 'No tip right now.' }, { status })
  }
}
