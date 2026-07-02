import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { dayRange, ymdOf, lastNDays, weekdayShort, goalsFor } from '@/lib/nutrition'
import { getUserTz } from '@/lib/tz-server'

// GET /api/insights → the last 7 local days of calorie/macro totals, the user's
// goals, and averages over the days they actually logged. Computed server-side
// (in the user's timezone) so the client needs no date math and there's no drift.
export async function GET() {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const tz = await getUserTz()
  const days = lastNDays(tz, 7)
  const { startIso } = dayRange(tz, days[0])
  const { endIso } = dayRange(tz, days[6])

  const supabase = await createClient()
  const [{ data: meals }, { data: profile }] = await Promise.all([
    supabase
      .from('meal_logs')
      .select('logged_at, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g')
      .eq('user_id', user.id)
      .gte('logged_at', startIso)
      .lt('logged_at', endIso)
      .limit(500),
    supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
  ])

  const blank = () => ({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })
  const byDay = new Map(days.map((d) => [d, blank()]))
  for (const m of meals ?? []) {
    const bucket = byDay.get(ymdOf(tz, m.logged_at))
    if (!bucket) continue
    bucket.calories += m.total_calories
    bucket.protein += Number(m.total_protein_g)
    bucket.carbs += Number(m.total_carbs_g)
    bucket.fat += Number(m.total_fat_g)
    bucket.fiber += Number(m.total_fiber_g)
  }

  const dayArr = days.map((date) => {
    const t = byDay.get(date)!
    return {
      date,
      label: weekdayShort(date),
      calories: Math.round(t.calories),
      protein: Math.round(t.protein),
      carbs: Math.round(t.carbs),
      fat: Math.round(t.fat),
      fiber: Math.round(t.fiber),
    }
  })

  const logged = dayArr.filter((d) => d.calories > 0)
  const avg = (sel: (d: (typeof dayArr)[number]) => number) =>
    logged.length ? Math.round(logged.reduce((a, d) => a + sel(d), 0) / logged.length) : 0

  return NextResponse.json({
    days: dayArr,
    daysLogged: logged.length,
    goals: (({ calories, protein, carbs, fat, fiber }) => ({
      calories: Number(calories),
      protein: Number(protein),
      carbs: Number(carbs),
      fat: Number(fat),
      fiber: Number(fiber),
    }))(goalsFor(profile)),
    averages: {
      calories: avg((d) => d.calories),
      protein: avg((d) => d.protein),
      carbs: avg((d) => d.carbs),
      fat: avg((d) => d.fat),
      fiber: avg((d) => d.fiber),
    },
  })
}
