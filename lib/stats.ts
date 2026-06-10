import { istYmdOf, istToday, shiftYmd } from './nutrition'

/**
 * Headline profile stats derived from meal history.
 * - daysLogged: distinct IST days with at least one meal
 * - streak: consecutive days (ending today, or yesterday if today is empty) with a log
 * - onGoalPct: share of logged days whose calories were at or under the goal
 */
export function computeStats(
  meals: { logged_at: string; total_calories: number }[],
  goalCalories: number
) {
  const byDay = new Map<string, number>()
  for (const m of meals) {
    const d = istYmdOf(m.logged_at)
    byDay.set(d, (byDay.get(d) ?? 0) + m.total_calories)
  }

  const daysLogged = byDay.size

  let streak = 0
  let cursor = istToday()
  if (!byDay.has(cursor)) cursor = shiftYmd(cursor, -1) // today not logged yet — don't break the streak
  while (byDay.has(cursor)) {
    streak++
    cursor = shiftYmd(cursor, -1)
  }

  let under = 0
  for (const cals of byDay.values()) if (cals <= goalCalories) under++
  const onGoalPct = daysLogged ? Math.round((under / daysLogged) * 100) : 0

  return { daysLogged, streak, onGoalPct }
}

/**
 * Group weight entries into up to 7 recent weekly points (latest reading per week),
 * labelled W1..Wn oldest→newest, for the trend chart.
 */
export function weeklyWeightSeries(logs: { logged_on: string; weight_kg: number }[]) {
  if (!logs.length) return [] as { label: string; weight: number; date: string }[]

  const sorted = [...logs].sort((a, b) => a.logged_on.localeCompare(b.logged_on))
  const byWeek = new Map<string, { date: string; weight: number }>()

  for (const l of sorted) {
    const d = new Date(l.logged_on + 'T00:00:00Z')
    const dow = (d.getUTCDay() + 6) % 7 // Monday = 0
    const monday = new Date(d)
    monday.setUTCDate(d.getUTCDate() - dow)
    const key = monday.toISOString().slice(0, 10)
    // sorted ascending, so the last write per week keeps the latest reading
    byWeek.set(key, { date: l.logged_on, weight: Number(l.weight_kg) })
  }

  const weeks = [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-7)
  return weeks.map(([, v], i) => ({ label: `W${i + 1}`, weight: v.weight, date: v.date }))
}

export function bmiInfo(weightKg: number | null, heightCm: number | null) {
  if (!weightKg || !heightCm) return null
  const m = heightCm / 100
  const bmi = weightKg / (m * m)
  if (!Number.isFinite(bmi) || bmi <= 0) return null
  let label = 'Normal'
  let color = '#469A3D'
  if (bmi < 18.5) {
    label = 'Underweight'
    color = '#6E2F5C'
  } else if (bmi < 25) {
    label = 'Normal'
    color = '#469A3D'
  } else if (bmi < 30) {
    label = 'Overweight'
    color = '#C98300'
  } else {
    label = 'Obese'
    color = '#C98300'
  }
  return { bmi: Math.round(bmi * 10) / 10, label, color }
}
