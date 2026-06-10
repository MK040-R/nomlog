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
    <main className="mx-auto w-full max-w-[420px] px-6 pb-20 pt-8">
      {/* Top bar */}
      <div className="mb-10 flex items-center justify-between">
        <span className="font-display text-sm font-medium lowercase tracking-tight text-foreground">nomlog</span>
        <span className="eyebrow">Insights</span>
      </div>

      <h1 className="font-display text-[22px] font-medium leading-tight text-foreground">How it&apos;s adding up</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">Last 7 days</p>

      {loggedDays.length === 0 ? (
        <p className="mt-8 text-[13px] text-muted-foreground">
          No meals logged this week yet. Once you start logging, your trends show up here.
        </p>
      ) : (
        <>
          <div className="divider my-7" />

          {/* Calorie bar chart */}
          <section>
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Calories / day</span>
              <span className="num text-[11px] text-muted-foreground">goal {goalCals}</span>
            </div>
            <div className="relative mt-4 flex items-end justify-between gap-2" style={{ height: chartH }}>
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border"
                style={{ bottom: goalY }}
              />
              {days.map((d) => {
                const t = byDay[d]
                const h = Math.round((t.cal / scale) * chartH)
                const over = t.cal > goalCals
                const isToday = d === today
                return (
                  <div key={d} className="flex flex-1 flex-col items-center justify-end gap-1.5" style={{ height: chartH }}>
                    {t.cal > 0 && <span className="num text-[9px] text-muted-foreground">{t.cal}</span>}
                    <div
                      className="w-full rounded-t-sm"
                      style={{
                        height: Math.max(h, t.cal > 0 ? 3 : 0),
                        backgroundColor: over ? 'var(--color-destructive)' : 'var(--color-primary)',
                        opacity: isToday ? 1 : 0.5,
                      }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex justify-between gap-2">
              {days.map((d) => (
                <span key={d} className="flex-1 text-center text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  {weekdayShort(d).slice(0, 1)}
                </span>
              ))}
            </div>
          </section>

          <div className="divider my-7" />

          {/* Headline stats */}
          <section className="flex items-start justify-between">
            <Stat label="Avg / day" value={`${avgCal}`} />
            <Stat label="Days logged" value={`${loggedDays.length}`} accent />
            <Stat label="Streak" value={`${streak}`} />
          </section>

          <div className="divider my-7" />

          {/* Avg macros */}
          <section>
            <span className="eyebrow">Average macros / day</span>
            <div className="mt-4 flex flex-col gap-3">
              <MacroRow label="Protein" value={avgP} goal={goals.protein} />
              <MacroRow label="Carbs" value={avgC} goal={goals.carbs} />
              <MacroRow label="Fat" value={avgF} goal={goals.fat} />
              <MacroRow label="Fiber" value={avgFib} goal={goals.fiber} />
            </div>
          </section>

          {/* Most eaten */}
          {topFoods.length > 0 && (
            <>
              <div className="divider my-7" />
              <section>
                <span className="eyebrow">Most eaten this week</span>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {topFoods.map(([name, count]) => (
                    <li key={name} className="flex items-center justify-between text-[13px] text-foreground">
                      <span>{name}</span>
                      <span className="num text-muted-foreground">×{count}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </>
      )}
    </main>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className={`num text-[22px] font-medium leading-none ${accent ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </span>
      <span className="eyebrow mt-2">{label}</span>
    </div>
  )
}

function MacroRow({ label, value, goal }: { label: string; value: number; goal: number }) {
  const pct = Math.min(100, Math.round((value / goal) * 100)) || 0
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[13px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="num text-foreground">{value} <span className="text-muted-foreground">/ {goal} g</span></span>
      </div>
      <div className="h-px w-full bg-muted">
        <div className="h-full bg-foreground/30" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
