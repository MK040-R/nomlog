import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  lastNDays,
  dayRange,
  ymdOf,
  weekdayShort,
  todayYmd,
  shiftYmd,
  DEFAULT_GOALS,
} from '@/lib/nutrition'
import { getUserTz } from '@/lib/tz-server'
import type { FoodItem } from '@/types/app.types'
import { WeeklyRecap } from '@/components/WeeklyRecap'
import { WeightCaloriesChart, type WeekPoint } from '@/components/WeightCaloriesChart'

type DayTotals = { cal: number; p: number; c: number; f: number; fib: number; count: number }

/** Shift a YYYY-MM by n months. */
function shiftMonth(ym: string, n: number) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const user = await verifySession()
  if (!user) redirect('/login')

  const { month: monthParam } = await searchParams
  const tz = await getUserTz()
  const supabase = await createClient()
  const days = lastNDays(tz, 7)
  const { startIso } = dayRange(tz, days[0])
  const { endIso } = dayRange(tz, days[6])

  // Month view: defaults to the current month in the user's zone, never navigates past it.
  const curMonth = todayYmd(tz).slice(0, 7)
  const month =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam) && monthParam <= curMonth ? monthParam : curMonth
  const [mYear, mMon] = month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(mYear, mMon, 0)).getUTCDate()
  const monthStartIso = dayRange(tz, `${month}-01`).startIso
  const monthEndIso = dayRange(tz, `${month}-${String(daysInMonth).padStart(2, '0')}`).endIso

  const sixWeeksAgoIso = dayRange(tz, shiftYmd(todayYmd(tz), -42)).startIso
  const [{ data: meals }, { data: profile }, { data: monthMeals }, { data: weights }, { data: recentForWeeks }] = await Promise.all([
    supabase
      .from('meal_logs')
      .select('*')
      .gte('logged_at', startIso)
      .lt('logged_at', endIso)
      .order('logged_at', { ascending: true }),
    supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase
      .from('meal_logs')
      .select('logged_at, total_calories')
      .gte('logged_at', monthStartIso)
      .lt('logged_at', monthEndIso),
    supabase.from('weight_logs').select('logged_on, weight_kg').gte('logged_on', shiftYmd(todayYmd(tz), -42)),
    supabase.from('meal_logs').select('logged_at, total_calories').gte('logged_at', sixWeeksAgoIso),
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
    const d = ymdOf(tz, m.logged_at)
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

  const today = todayYmd(tz)

  // Best / toughest logged day this week (distance from the calorie goal)
  let bestDay: { d: string; cal: number } | null = null
  let toughDay: { d: string; cal: number } | null = null
  if (loggedDays.length >= 2) {
    const sortedByDist = [...loggedDays].sort(
      (a, b) => Math.abs(byDay[a].cal - goalCals) - Math.abs(byDay[b].cal - goalCals)
    )
    bestDay = { d: sortedByDist[0], cal: byDay[sortedByDist[0]].cal }
    const worst = sortedByDist[sortedByDist.length - 1]
    if (worst !== sortedByDist[0]) toughDay = { d: worst, cal: byDay[worst].cal }
  }

  // Macro split: % of calories from protein/carbs/fat, actual vs target
  const pCal = avgP * 4
  const cCal = avgC * 4
  const fCal = avgF * 9
  const macroCal = pCal + cCal + fCal
  const goalMacroCal = goals.protein * 4 + goals.carbs * 4 + goals.fat * 9
  const split =
    macroCal > 0
      ? {
          p: Math.round((pCal / macroCal) * 100),
          c: Math.round((cCal / macroCal) * 100),
          f: Math.round((fCal / macroCal) * 100),
          gp: Math.round(((goals.protein * 4) / goalMacroCal) * 100),
          gc: Math.round(((goals.carbs * 4) / goalMacroCal) * 100),
          gf: Math.round(((goals.fat * 9) / goalMacroCal) * 100),
        }
      : null

  // Weekly weight vs avg intake (last 6 weeks, Monday-keyed)
  const weekKey = (ymd: string) => {
    const dow = (new Date(ymd + 'T00:00:00Z').getUTCDay() + 6) % 7
    return shiftYmd(ymd, -dow)
  }
  const kcalByWeek = new Map<string, { sum: number; days: Set<string> }>()
  for (const m of recentForWeeks ?? []) {
    const d = ymdOf(tz, m.logged_at)
    const wk = weekKey(d)
    const cur = kcalByWeek.get(wk) ?? { sum: 0, days: new Set<string>() }
    cur.sum += m.total_calories
    cur.days.add(d)
    kcalByWeek.set(wk, cur)
  }
  const weightByWeek = new Map<string, number>()
  for (const w of [...(weights ?? [])].sort((a, b) => a.logged_on.localeCompare(b.logged_on))) {
    weightByWeek.set(weekKey(w.logged_on), Number(w.weight_kg))
  }
  const allWeeks = [...new Set([...kcalByWeek.keys(), ...weightByWeek.keys()])].sort().slice(-6)
  const weekPoints: WeekPoint[] = allWeeks.map((wk, i) => {
    const k = kcalByWeek.get(wk)
    return {
      label: `W${i + 1}`,
      weight: weightByWeek.get(wk) ?? null,
      avgKcal: k ? Math.round(k.sum / k.days.size) : null,
    }
  })
  const showWeightChart = weekPoints.filter((p) => p.weight !== null).length >= 2

  // Month calendar: calories per local day
  const calByDay: Record<string, number> = {}
  for (const m of monthMeals ?? []) {
    const d = ymdOf(tz, m.logged_at)
    calByDay[d] = (calByDay[d] ?? 0) + m.total_calories
  }
  const firstDow = (new Date(month + '-01T00:00:00Z').getUTCDay() + 6) % 7 // Monday = 0
  const monthLabel = new Date(month + '-01T00:00:00Z').toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const prevMonthHref = `/analytics?month=${shiftMonth(month, -1)}`
  const nextMonth = shiftMonth(month, 1)
  const nextMonthHref = nextMonth <= curMonth ? `/analytics?month=${nextMonth}` : null

  return (
    <main className="mx-auto w-full max-w-[420px] px-6 pb-20 pt-8">
      {/* Top bar */}
      <div className="mb-10 flex items-center justify-between">
        <span className="font-display text-sm font-medium lowercase tracking-tight text-foreground">nomlog</span>
        <span className="eyebrow">Insights</span>
      </div>

      <h1 className="font-display text-[22px] font-medium leading-tight text-foreground">How it&apos;s adding up</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">Last 7 days</p>
      <WeeklyRecap />

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
                // The whole column is the tap target — bars alone are too thin.
                return (
                  <Link
                    key={d}
                    href={`/dashboard?date=${d}`}
                    aria-label={`Open ${d}`}
                    className="flex flex-1 flex-col items-center justify-end gap-1.5 transition-opacity active:opacity-60"
                    style={{ height: chartH }}
                  >
                    {t.cal > 0 && <span className="num text-[9px] text-muted-foreground">{t.cal}</span>}
                    <div
                      className="w-full rounded-t-sm"
                      style={{
                        height: Math.max(h, t.cal > 0 ? 3 : 0),
                        backgroundColor: over ? 'var(--color-destructive)' : 'var(--color-primary)',
                        opacity: isToday ? 1 : 0.5,
                      }}
                    />
                  </Link>
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

          {(bestDay || toughDay) && (
            <>
              <div className="divider my-7" />
              <section className="flex flex-col gap-1.5">
                {bestDay && (
                  <p className="text-[13px] text-muted-foreground">
                    Closest to goal: <span className="font-medium text-foreground">{weekdayShort(bestDay.d)}</span>{' '}
                    <span className="num">({bestDay.cal} kcal)</span>
                  </p>
                )}
                {toughDay && (
                  <p className="text-[13px] text-muted-foreground">
                    Furthest from goal: <span className="font-medium text-foreground">{weekdayShort(toughDay.d)}</span>{' '}
                    <span className="num">({toughDay.cal} kcal)</span>
                  </p>
                )}
              </section>
            </>
          )}

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

          {split && (
            <>
              <div className="divider my-7" />
              <section>
                <span className="eyebrow">Where calories come from</span>
                <div className="mt-4 flex items-center gap-6">
                  <Donut p={split.p} c={split.c} f={split.f} />
                  <div className="flex flex-col gap-2 text-[13px]">
                    <SplitRow color="var(--color-primary)" label="Protein" pct={split.p} goal={split.gp} />
                    <SplitRow color="var(--color-warning)" label="Carbs" pct={split.c} goal={split.gc} />
                    <SplitRow color="var(--color-accent)" label="Fat" pct={split.f} goal={split.gf} />
                  </div>
                </div>
              </section>
            </>
          )}

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
          {showWeightChart && (
            <>
              <div className="divider my-7" />
              <section>
                <div className="flex items-baseline justify-between">
                  <span className="eyebrow">Weight vs intake</span>
                  <span className="text-[10px] text-muted-foreground">bars kcal/day · line kg</span>
                </div>
                <div className="mt-3">
                  <WeightCaloriesChart data={weekPoints} />
                </div>
              </section>
            </>
          )}
        </>
      )}

      <div className="divider my-7" />

      {/* Monthly calendar — red over goal, green near goal, yellow well under */}
      <section>
        <div className="flex items-center justify-between">
          <span className="eyebrow">By month</span>
          <div className="flex items-center gap-3">
            <Link
              href={prevMonthHref}
              aria-label="Previous month"
              className="text-muted-foreground transition-opacity hover:opacity-70"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            </Link>
            <span className="text-[13px] font-medium text-foreground">{monthLabel}</span>
            {nextMonthHref ? (
              <Link
                href={nextMonthHref}
                aria-label="Next month"
                className="text-muted-foreground transition-opacity hover:opacity-70"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
              </Link>
            ) : (
              <ChevronRight className="h-4 w-4 text-border" strokeWidth={1.5} />
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-y-1">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => (
            <span key={`h${i}`} className="text-center text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              {w}
            </span>
          ))}
          {Array.from({ length: firstDow }).map((_, i) => (
            <span key={`b${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayN = i + 1
            const ymd = `${month}-${String(dayN).padStart(2, '0')}`
            if (ymd > today) {
              return (
                <span key={ymd} className="flex h-10 items-center justify-center text-[11px] text-border">
                  {dayN}
                </span>
              )
            }
            const color = dayMarkerColor(calByDay[ymd], goalCals)
            return (
              <Link
                key={ymd}
                href={`/dashboard?date=${ymd}`}
                aria-label={`Open ${ymd}`}
                className="flex h-10 items-center justify-center transition-opacity active:opacity-60"
              >
                <span
                  className="num flex h-8 w-8 items-center justify-center rounded-full text-[11px]"
                  style={
                    color
                      ? { backgroundColor: color, color: 'var(--color-primary-foreground)', fontWeight: 500 }
                      : { color: 'var(--color-muted-foreground)' }
                  }
                >
                  {dayN}
                </span>
              </Link>
            )
          })}
        </div>

        <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
          <LegendDot color="var(--color-success)" label="near goal" />
          <LegendDot color="var(--color-warning)" label="light day" />
          <LegendDot color="var(--color-destructive)" label="over goal" />
        </div>
      </section>
    </main>
  )
}

/** Marker color for a calendar day: red >110% of goal, green 90-110%, yellow under, none when empty. */
function dayMarkerColor(cal: number | undefined, goal: number) {
  if (!cal) return null
  const r = cal / goal
  if (r > 1.1) return 'var(--color-destructive)'
  if (r >= 0.9) return 'var(--color-success)'
  return 'var(--color-warning)'
}

function Donut({ p, c, f }: { p: number; c: number; f: number }) {
  const R = 34
  const CIRC = 2 * Math.PI * R
  const seg = (pct: number) => (pct / 100) * CIRC
  const pLen = seg(p)
  const cLen = seg(c)
  const fLen = Math.max(0, CIRC - pLen - cLen)
  return (
    <svg width="92" height="92" viewBox="0 0 92 92" role="img" aria-label="Calorie split donut">
      <g transform="rotate(-90 46 46)">
        <circle cx="46" cy="46" r={R} fill="none" stroke="var(--color-primary)" strokeWidth="10" strokeDasharray={`${pLen} ${CIRC - pLen}`} />
        <circle cx="46" cy="46" r={R} fill="none" stroke="var(--color-warning)" strokeWidth="10" strokeDasharray={`${cLen} ${CIRC - cLen}`} strokeDashoffset={-pLen} />
        <circle cx="46" cy="46" r={R} fill="none" stroke="var(--color-accent)" strokeWidth="10" strokeDasharray={`${fLen} ${CIRC - fLen}`} strokeDashoffset={-(pLen + cLen)} />
      </g>
    </svg>
  )
}

function SplitRow({ color, label, pct, goal }: { color: string; label: string; pct: number; goal: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-muted-foreground">{label}</span>
      <span className="num text-foreground">{pct}%</span>
      <span className="text-[11px] text-muted-foreground">goal {goal}%</span>
    </span>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
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
