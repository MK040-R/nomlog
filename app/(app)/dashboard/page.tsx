import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Flame, MessageCircleQuestion } from 'lucide-react'
import { LogMeal } from '@/components/LogMeal'
import { MealCard } from '@/components/MealCard'
import { DailyTip } from '@/components/DailyTip'
import { WhatFits } from '@/components/WhatFits'
import { WaterTracker } from '@/components/WaterTracker'
import { QuickRelog, type RelogOption, type YesterdayMeal } from '@/components/QuickRelog'
import { MacroPanel } from '@/components/MacroPanel'
import { dayRange, todayYmd, hourNow, shiftYmd, ymdOf, mealSig, mealLabel, DEFAULT_GOALS } from '@/lib/nutrition'
import { getUserTz } from '@/lib/tz-server'
import type { FoodItem, MealType } from '@/types/app.types'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const user = await verifySession()
  if (!user) redirect('/login')

  const { date: dateParam } = await searchParams
  const tz = await getUserTz()
  const supabase = await createClient()
  const { startIso, endIso, ymd } = dayRange(tz, dateParam)
  const today = todayYmd(tz)
  if (ymd > today) redirect('/dashboard')
  const isToday = ymd === today

  const [{ data: meals }, { data: profile }, { data: recentMeals }, { data: favorites }, { data: water }, { data: streakRows }] =
    await Promise.all([
      supabase
        .from('meal_logs')
        .select('*')
        .gte('logged_at', startIso)
        .lt('logged_at', endIso)
        .order('logged_at', { ascending: true }),
      supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
      // last 14 days: powers "log again", "same as yesterday" and the recent-items picker
      supabase
        .from('meal_logs')
        .select('food_items, total_calories, meal_type, logged_at')
        .gte('logged_at', dayRange(tz, shiftYmd(today, -14)).startIso)
        .order('logged_at', { ascending: false })
        .limit(80),
      supabase.from('favorite_meals').select('sig, label, items').order('created_at', { ascending: false }),
      supabase.from('water_logs').select('glasses').eq('logged_on', ymd).maybeSingle(),
      // distinct logged days for the streak counter
      supabase.from('meal_logs').select('logged_at').order('logged_at', { ascending: false }).limit(400),
    ])

  const rows = meals ?? []
  const goals = {
    calories: profile?.goal_calories ?? DEFAULT_GOALS.goal_calories,
    protein: profile?.goal_protein_g ?? DEFAULT_GOALS.goal_protein_g,
    carbs: profile?.goal_carbs_g ?? DEFAULT_GOALS.goal_carbs_g,
    fat: profile?.goal_fat_g ?? DEFAULT_GOALS.goal_fat_g,
    fiber: profile?.goal_fiber_g ?? DEFAULT_GOALS.goal_fiber_g,
  }

  const consumed = rows.reduce(
    (a, m) => ({
      calories: a.calories + m.total_calories,
      protein: a.protein + Number(m.total_protein_g),
      carbs: a.carbs + Number(m.total_carbs_g),
      fat: a.fat + Number(m.total_fat_g),
      fiber: a.fiber + Number(m.total_fiber_g),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  )

  // Streak: consecutive logged days ending today (or yesterday if today is empty yet)
  const loggedDays = new Set((streakRows ?? []).map((m) => ymdOf(tz, m.logged_at)))
  let streak = 0
  let cursor = loggedDays.has(today) ? today : shiftYmd(today, -1)
  while (loggedDays.has(cursor)) {
    streak++
    cursor = shiftYmd(cursor, -1)
  }

  // Quick-log chips: favorites first, then meals repeated 2+ times in 14 days
  const favSigs = new Set((favorites ?? []).map((f) => f.sig))
  const favOptions: RelogOption[] = (favorites ?? []).slice(0, 4).map((f) => {
    const items = (f.items as unknown as FoodItem[]) ?? []
    return { label: f.label, kcal: Math.round(items.reduce((a, it) => a + (it.calories_kcal || 0), 0)), items, favorite: true }
  })
  const bySig = new Map<string, { count: number; option: RelogOption }>()
  for (const m of recentMeals ?? []) {
    const items = ((m.food_items as unknown as FoodItem[]) ?? []).filter((it) => it?.name)
    if (items.length === 0) continue
    const sig = mealSig(items)
    if (favSigs.has(sig)) continue
    const found = bySig.get(sig)
    if (found) found.count++
    else bySig.set(sig, { count: 1, option: { label: mealLabel(items), kcal: m.total_calories, items } })
  }
  const repeatOptions = [...bySig.values()]
    .filter((e) => e.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.max(0, 4 - favOptions.length))
    .map((e) => e.option)
  const relogOptions = [...favOptions, ...repeatOptions]

  // "Same as yesterday": yesterday's meals grouped by type, skipping types already logged today
  const yesterdayYmd = shiftYmd(today, -1)
  const typesToday = new Set(rows.map((m) => m.meal_type))
  const yesterdayByType = new Map<MealType, { items: FoodItem[]; kcal: number }>()
  for (const m of recentMeals ?? []) {
    if (ymdOf(tz, m.logged_at) !== yesterdayYmd) continue
    const t = m.meal_type as MealType
    if (typesToday.has(t)) continue
    const items = ((m.food_items as unknown as FoodItem[]) ?? []).filter((it) => it?.name)
    if (items.length === 0) continue
    const cur = yesterdayByType.get(t) ?? { items: [], kcal: 0 }
    cur.items.push(...items)
    cur.kcal += m.total_calories
    yesterdayByType.set(t, cur)
  }
  const yesterdayMeals: YesterdayMeal[] = [...yesterdayByType.entries()].map(([meal_type, v]) => ({
    meal_type,
    label: `yesterday's ${meal_type}`,
    kcal: v.kcal,
    items: v.items,
  }))

  // Recent individual items for the add-by-hand picker, deduped by name
  const seenNames = new Set<string>()
  const recentItems: FoodItem[] = []
  for (const m of recentMeals ?? []) {
    for (const it of (m.food_items as unknown as FoodItem[]) ?? []) {
      const key = it?.name?.trim().toLowerCase()
      if (!key || seenNames.has(key)) continue
      seenNames.add(key)
      recentItems.push(it)
      if (recentItems.length >= 6) break
    }
    if (recentItems.length >= 6) break
  }

  const dayItems = rows.flatMap((m) => ((m.food_items as unknown as FoodItem[]) ?? []))

  // Fixed meal sections: every entry of a type lives under one header.
  const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner']
  const MEAL_META: Record<MealType, { emoji: string; label: string }> = {
    breakfast: { emoji: '🍳', label: 'Breakfast' },
    lunch: { emoji: '🍛', label: 'Lunch' },
    snack: { emoji: '🍌', label: 'Snacks' },
    dinner: { emoji: '🌙', label: 'Dinner' },
  }
  const mealGroups = MEAL_ORDER.map((type) => ({
    type,
    ...MEAL_META[type],
    entries: rows.filter((m) => m.meal_type === type),
  })).filter((g) => g.entries.length > 0)

  const remaining = goals.calories - consumed.calories
  const pct = Math.min(100, Math.round((consumed.calories / goals.calories) * 100)) || 0
  const over = consumed.calories > goals.calories
  const displayName = profile?.name?.trim() || firstName(user.email)
  const dateLabel = new Date(ymd + 'T00:00:00Z').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  const prevHref = `/dashboard?date=${shiftYmd(ymd, -1)}`
  const nextDay = shiftYmd(ymd, 1)
  const nextHref = nextDay > today ? null : `/dashboard?date=${nextDay}`
  const hour = hourNow(tz)
  const dayDone = isToday && hour >= 20 && consumed.calories > 0

  return (
    <main className="mx-auto w-full max-w-[420px] px-6 pb-20 pt-8">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-medium lowercase tracking-tight text-foreground">nomlog</span>
        <div className="flex items-center gap-3">
          <Link href={prevHref} aria-label="Previous day" className="text-muted-foreground transition-opacity hover:opacity-70">
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </Link>
          <span className="eyebrow">{isToday ? 'Today' : dateLabel}</span>
          {nextHref ? (
            <Link href={nextHref} aria-label="Next day" className="text-muted-foreground transition-opacity hover:opacity-70">
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            </Link>
          ) : (
            <ChevronRight className="h-4 w-4 text-border" strokeWidth={1.5} />
          )}
        </div>
      </div>

      {/* Greeting */}
      <div className="mt-8 flex items-start justify-between gap-3">
        <h1 className="font-display text-[22px] font-medium leading-tight text-foreground">
          {isToday ? `${greeting(hour)}, ${displayName}` : 'Looking back'}
        </h1>
        {isToday && streak >= 2 && (
          <span className="flex shrink-0 items-center gap-1 pt-1 text-[12px] text-muted-foreground">
            <Flame className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: 'var(--color-primary)' }} />
            <span className="num">{streak} days</span>
          </span>
        )}
      </div>
      {isToday && <DailyTip />}
      {!isToday && (
        <Link
          href={`/ask?about=${ymd}`}
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-primary transition-opacity hover:opacity-70"
        >
          <MessageCircleQuestion className="h-3.5 w-3.5" strokeWidth={1.5} /> Ask the coach about this day
        </Link>
      )}

      <div className="divider my-7" />

      {/* Calories */}
      <section>
        <span className="eyebrow">Calories</span>
        <div className="mt-3 flex items-end justify-between">
          <div className="flex items-baseline gap-2">
            <span className="num text-[38px] font-medium leading-none text-foreground">{consumed.calories}</span>
            <span className="text-[13px] text-muted-foreground">/ {goals.calories} kcal</span>
          </div>
          <span
            className="num text-[13px]"
            style={{ color: over ? 'var(--color-destructive)' : 'var(--color-success)' }}
          >
            {over ? `${Math.abs(remaining)} over` : `${remaining} left`}
          </span>
        </div>
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, backgroundColor: over ? 'var(--color-destructive)' : 'var(--color-primary)' }}
          />
        </div>
        {dayDone && (
          <p className="mt-3 text-[13px] text-muted-foreground">
            That&apos;s {consumed.calories} of {goals.calories} kcal today{over ? '.' : ' — nicely done.'}
          </p>
        )}
      </section>

      <div className="divider my-7" />

      {/* Macros — tappable: shows which foods contributed */}
      <section>
        <MacroPanel
          consumed={{ protein: consumed.protein, carbs: consumed.carbs, fat: consumed.fat, fiber: consumed.fiber }}
          goals={{ protein: goals.protein, carbs: goals.carbs, fat: goals.fat, fiber: goals.fiber }}
          items={dayItems}
        />
      </section>

      <div className="divider my-7" />

      {/* Water */}
      <section>
        <span className="eyebrow">Water</span>
        <div className="mt-3">
          <WaterTracker initial={water?.glasses ?? 0} date={ymd} />
        </div>
      </section>

      <div className="divider my-7" />
      <section>
        <span className="eyebrow">{isToday ? 'Log a meal' : `Log a meal for ${dateLabel}`}</span>
        <div className="mt-4">
          <LogMeal date={isToday ? undefined : ymd} recentItems={recentItems} />
        </div>
        {isToday && (
          <div className="mt-4">
            <QuickRelog options={relogOptions} yesterday={yesterdayMeals} />
          </div>
        )}
        {isToday && (
          <div className="mt-4">
            <WhatFits />
          </div>
        )}
      </section>

      <div className="divider my-7" />

      {/* Meals */}
      <section>
        <span className="eyebrow">{isToday ? "Today's meals" : 'Meals'}</span>
        {rows.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted-foreground">
            {isToday ? 'Nothing logged yet. Tell me what you ate above.' : 'Nothing was logged this day.'}
          </p>
        ) : (
          <div className="mt-4 flex flex-col">
            {mealGroups.map((g, gi) => (
              <div key={g.type} className={gi > 0 ? 'mt-5 border-t border-border/60 pt-5' : ''}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                    <span>{g.emoji}</span> {g.label}
                  </span>
                  <span className="num text-[13px] font-medium text-foreground">
                    {g.entries.reduce((a, m) => a + m.total_calories, 0)} kcal
                  </span>
                </div>
                <div className="flex flex-col">
                  {g.entries.map((m, idx) => {
                    const items = (m.food_items as unknown as FoodItem[]) ?? []
                    return (
                      <div key={m.id} className={idx > 0 ? 'mt-3 border-t border-border/30 pt-3' : ''}>
                        <MealCard
                          meal={{
                            id: m.id,
                            meal_type: m.meal_type,
                            total_calories: m.total_calories,
                            food_items: items,
                          }}
                          date={ymd}
                          todayYmd={today}
                          favorited={favSigs.has(mealSig(items))}
                          grouped
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}


function greeting(h: number) {
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function firstName(email?: string) {
  if (!email) return 'there'
  const name = email.split('@')[0].replace(/[._0-9]/g, ' ').trim().split(' ')[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}
