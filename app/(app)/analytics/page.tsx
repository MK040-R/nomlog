import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  lastNDays,
  istDayRange,
  istYmdOf,
  weekdayShort,
  istToday,
  DEFAULT_GOALS,
} from '@/lib/nutrition'
import type { FoodItem } from '@/types/app.types'

type DayTotals = { cal: number; p: number; c: number; f: number; fib: number; count: number }

export default async function AnalyticsPage() {
  const user = await verifySession()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const days = lastNDays(7)
  const { startIso } = istDayRange(days[0])
  const { endIso } = istDayRange(days[6])

  const [{ data: meals }, { data: profile }] = await Promise.all([
    supabase
      .from('meal_logs')
      .select('*')
      .gte('logged_at', startIso)
      .lt('logged_at', endIso)
      .order('logged_at', { ascending: true }),
    supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
  ])

  const rows = meals ?? []
  const goalCals = profile?.goal_calories ?? DEFAULT_GOALS.goal_calories
  const goals = {
    protein: profile?.goal_protein_g ?? DEFAULT_GOALS.goal_protein_g,
    carbs: profile?.goal_carbs_g ?? DEFAULT_GOALS.goal_carbs_g,
    fat: profile?.goal_fat_g ?? DEFAULT_GOALS.goal_fat_g,
    fiber: profile?.goal_fiber_g ?? DEFAULT_GOALS.goal_fiber_g,
  }

  const byDay: Record<string, DayTotals> = {}
  for (const d of days) byDay[d] = { cal: 0, p: 0, c: 0, f: 0, fib: 0, count: 0 }
  for (const m of rows) {
    const d = istYmdOf(m.logged_at)
    if (!byDay[d]) continue
    byDay[d].cal += m.total_calories
    byDay[d].p += Number(m.total_protein_g)
    byDay[d].c += Number(m.total_carbs_g)
    byDay[d].f += Number(m.total_fat_g)
    byDay[d].fib += Number(m.total_fiber_g)
    byDay[d].count += 1
  }

  const loggedDays = days.filter((d) => byDay[d].count > 0)
  const avg = (sel: (t: DayTotals) => number) =>
    loggedDays.length ? Math.round(loggedDays.reduce((s, d) => s + sel(byDay[d]), 0) / loggedDays.length) : 0

  const avgCal = avg((t) => t.cal)
  const avgP = avg((t) => t.p)
  const avgC = avg((t) => t.c)
  const avgF = avg((t) => t.f)
  const avgFib = avg((t) => t.fib)

  // consecutive logged days ending today
  let streak = 0
  for (let i = days.length - 1; i >= 0; i--) {
    if (byDay[days[i]].count > 0) streak++
    else break
  }

  // most-eaten foods this week
  const foodCount: Record<string, number> = {}
  for (const m of rows) {
    const foods = (m.food_items as unknown as FoodItem[]) ?? []
    for (const f of foods) {
      const name = f.name.trim()
      if (name) foodCount[name] = (foodCount[name] ?? 0) + 1
    }
  }
  const topFoods = Object.entries(foodCount).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const chartH = 120
  const scale = Math.max(goalCals, ...days.map((d) => byDay[d].cal), 1)
  const goalY = Math.round((goalCals / scale) * chartH)

  const today = istToday()

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
      <header>
        <p className="nom-eyebrow text-text-muted">Last 7 days</p>
        <h1 className="font-display text-2xl font-bold text-text-strong">How it&apos;s adding up</h1>
      </header>

      {loggedDays.length === 0 ? (
        <p className="rounded-card border border-dashed border-border-default bg-surface-card px-4 py-10 text-center text-sm text-text-muted">
          No meals logged this week yet. Once you start logging, your trends show up here. 📈
        </p>
      ) : (
        <>
          {/* Calorie bar chart */}
          <section className="rounded-card border border-border-subtle bg-surface-card p-5 shadow-card">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="nom-eyebrow text-text-muted">Calories / day</span>
              <span className="text-xs text-text-muted">goal {goalCals}</span>
            </div>
            <div className="relative flex items-end justify-between gap-2" style={{ height: chartH }}>
              {/* goal line */}
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border-strong"
                style={{ bottom: goalY }}
              />
              {days.map((d) => {
                const t = byDay[d]
                const h = Math.round((t.cal / scale) * chartH)
                const over = t.cal > goalCals
                const isToday = d === today
                return (
                  <div key={d} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: chartH }}>
                    {t.cal > 0 && <span className="nom-data text-[9px] text-text-muted">{t.cal}</span>}
                    <div
                      className="w-full rounded-t-md"
                      style={{
                        height: Math.max(h, t.cal > 0 ? 4 : 0),
                        backgroundColor: over ? 'var(--color-danger)' : 'var(--color-primary)',
                        opacity: isToday ? 1 : 0.85,
                      }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="mt-1.5 flex justify-between gap-2">
              {days.map((d) => (
                <span key={d} className="flex-1 text-center text-[10px] text-text-muted">
                  {weekdayShort(d).slice(0, 1)}
                </span>
              ))}
            </div>
          </section>

          {/* Headline stats */}
          <section className="grid grid-cols-3 gap-2">
            <Stat label="Avg / day" value={`${avgCal}`} unit="kcal" />
            <Stat label="Days logged" value={`${loggedDays.length}`} unit="of 7" />
            <Stat label="Streak" value={`${streak}`} unit={streak === 1 ? 'day' : 'days'} />
          </section>

          {/* Avg macros */}
          <section className="rounded-card border border-border-subtle bg-surface-card p-5 shadow-card">
            <span className="nom-eyebrow text-text-muted">Average macros / day</span>
            <div className="mt-3 flex flex-col gap-3">
              <MacroRow label="Protein" value={avgP} goal={goals.protein} color="var(--color-macro-protein)" />
              <MacroRow label="Carbs" value={avgC} goal={goals.carbs} color="var(--color-macro-carbs)" />
              <MacroRow label="Fat" value={avgF} goal={goals.fat} color="var(--color-macro-fat)" />
              <MacroRow label="Fiber" value={avgFib} goal={goals.fiber} color="var(--color-macro-fiber)" />
            </div>
          </section>

          {/* Most eaten */}
          {topFoods.length > 0 && (
            <section className="rounded-card border border-border-subtle bg-surface-card p-5 shadow-card">
              <span className="nom-eyebrow text-text-muted">Most eaten this week</span>
              <ul className="mt-3 flex flex-col gap-2">
                {topFoods.map(([name, count]) => (
                  <li key={name} className="flex items-center justify-between text-sm text-text-body">
                    <span>{name}</span>
                    <span className="nom-data text-text-muted">×{count}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex flex-col items-center rounded-input border border-border-subtle bg-surface-card p-3 shadow-card">
      <span className="nom-data text-xl font-bold text-text-strong">{value}</span>
      <span className="text-[10px] text-text-muted">{unit}</span>
      <span className="nom-eyebrow mt-1 text-[9px] text-text-muted">{label}</span>
    </div>
  )
}

function MacroRow({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = Math.min(100, Math.round((value / goal) * 100)) || 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-text-body">{label}</span>
        <span className="nom-data text-text-muted">{value} / {goal} g</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}
