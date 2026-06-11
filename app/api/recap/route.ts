import { NextResponse } from 'next/server'

// Gemini calls can retry across models — give Vercel room beyond the default 10s.
export const maxDuration = 60
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { generateWeeklyRecap } from '@/lib/gemini/recap'
import { GeminiBusyError } from '@/lib/gemini/generate'
import { dayRange, ymdOf, todayYmd, shiftYmd, lastNDays, DEFAULT_GOALS } from '@/lib/nutrition'
import { getUserTz } from '@/lib/tz-server'

// GET /api/recap → a paragraph on the past 7 days, generated at most once per
// local week (keyed on that week's Monday in the user's zone) and cached.
export async function GET() {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const tz = await getUserTz()
  const today = todayYmd(tz)
  const weekStart = shiftYmd(today, -((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7))

  const supabase = await createClient()
  const { data: cached } = await supabase
    .from('weekly_recaps')
    .select('recap')
    .eq('week_start', weekStart)
    .maybeSingle()
  if (cached) return NextResponse.json({ recap: cached.recap, cached: true })

  const days = lastNDays(tz, 7)
  const { startIso } = dayRange(tz, days[0])
  const { endIso } = dayRange(tz, days[6])
  const [{ data: meals }, { data: profile }, { data: weights }] = await Promise.all([
    supabase
      .from('meal_logs')
      .select('logged_at, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, food_items')
      .gte('logged_at', startIso)
      .lt('logged_at', endIso),
    supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('weight_logs').select('logged_on, weight_kg').order('logged_on', { ascending: false }).limit(5),
  ])

  const rows = meals ?? []
  // A recap of an empty week would just be filler — skip quietly.
  if (rows.length === 0) return NextResponse.json({ recap: null })

  const goalCalories = profile?.goal_calories ?? DEFAULT_GOALS.goal_calories
  const macroGoals = {
    protein: profile?.goal_protein_g ?? DEFAULT_GOALS.goal_protein_g,
    carbs: profile?.goal_carbs_g ?? DEFAULT_GOALS.goal_carbs_g,
    fat: profile?.goal_fat_g ?? DEFAULT_GOALS.goal_fat_g,
    fiber: profile?.goal_fiber_g ?? DEFAULT_GOALS.goal_fiber_g,
  }

  const byDay: Record<string, { cal: number; p: number; c: number; f: number; fib: number }> = {}
  const foodCount: Record<string, number> = {}
  for (const m of rows) {
    const d = ymdOf(tz, m.logged_at)
    byDay[d] ??= { cal: 0, p: 0, c: 0, f: 0, fib: 0 }
    byDay[d].cal += m.total_calories
    byDay[d].p += Number(m.total_protein_g)
    byDay[d].c += Number(m.total_carbs_g)
    byDay[d].f += Number(m.total_fat_g)
    byDay[d].fib += Number(m.total_fiber_g)
    for (const f of (m.food_items as { name?: string }[]) ?? []) {
      if (f?.name) foodCount[f.name] = (foodCount[f.name] ?? 0) + 1
    }
  }

  const logged = Object.values(byDay)
  const daysLogged = logged.length
  const avg = (sel: (t: (typeof logged)[number]) => number) =>
    Math.round(logged.reduce((s, t) => s + sel(t), 0) / daysLogged)
  const avgCalories = avg((t) => t.cal)
  const onGoalDays = logged.filter((t) => t.cal <= goalCalories).length

  let streak = 0
  for (let i = days.length - 1; i >= 0; i--) {
    if (byDay[days[i]]) streak++
    else break
  }

  const macroAvgs = {
    protein: avg((t) => t.p),
    carbs: avg((t) => t.c),
    fat: avg((t) => t.f),
    fiber: avg((t) => t.fib),
  }
  const weakest = (Object.keys(macroAvgs) as (keyof typeof macroAvgs)[]).reduce((worst, k) =>
    macroAvgs[k] / macroGoals[k] < macroAvgs[worst] / macroGoals[worst] ? k : worst
  )
  const weakestMacro = `${weakest} (${macroAvgs[weakest]}g avg of ${macroGoals[weakest]}g goal)`
  const topFoods = Object.entries(foodCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name)

  const w = weights ?? []
  const weightNote =
    w.length >= 2
      ? `${Number(w[w.length - 1].weight_kg).toFixed(1)} → ${Number(w[0].weight_kg).toFixed(1)} kg between ${w[w.length - 1].logged_on} and ${w[0].logged_on}`
      : null

  try {
    const recap = await generateWeeklyRecap({
      daysLogged,
      avgCalories,
      goalCalories,
      onGoalDays,
      streak,
      weakestMacro,
      topFoods,
      weightNote,
    })

    const { error } = await supabase
      .from('weekly_recaps')
      .upsert({ user_id: user.id, week_start: weekStart, recap }, { onConflict: 'user_id,week_start', ignoreDuplicates: true })
    if (error) console.error('recap cache write failed:', error)

    return NextResponse.json({ recap, cached: false })
  } catch (err) {
    console.error('recap generation failed:', err)
    const status = err instanceof GeminiBusyError ? 503 : 502
    return NextResponse.json({ error: 'No recap right now.' }, { status })
  }
}
