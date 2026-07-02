import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Flame, MessageCircleQuestion } from 'lucide-react'
import { CalorieRing } from '@/components/CalorieRing'
import { LogMeal } from '@/components/LogMeal'
import { MealCard } from '@/components/MealCard'
import { DailyTip } from '@/components/DailyTip'
import { WhatFits } from '@/components/WhatFits'
import { WaterTracker } from '@/components/WaterTracker'
import { QuickRelog, type RelogOption, type YesterdayMeal } from '@/components/QuickRelog'
import { MacroPanel } from '@/components/MacroPanel'
import { dayRange, todayYmd, hourNow, shiftYmd, ymdOf, mealSig, mealLabel, goalsFor } from '@/lib/nutrition'
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
        .eq('user_id', user.id)
        .gte('logged_at', startIso)
        .lt('logged_at', endIso)
        .order('logged_at', { ascending: true }),
      supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
      // last 14 days: powers "log again", "same as yesterday" and the recent-items picker
      supabase
        .from('meal_logs')
        .select('food_items, total_calories, meal_type, logged_at')
        .eq('user_id', user.id)
        .gte('logged_at', dayRange(tz, shiftYmd(today, -14)).startIso)
        .order('logged_at', { ascending: false })
        .limit(80),
      supabase.from('favorite_meals').select('sig, label, items').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('water_logs').select('glasses').eq('user_id', user.id).eq('logged_on', ymd).maybeSingle(),
      // distinct logged days for the streak counter
      supabase.from('meal_logs').select('logged_at').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(400),
    ])

  const rows = meals ?? []
  const goals = goalsFor(profile)

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
        <span className="font-display text-[17px] font-black lowercase tracking-tight text-foreground">nomlog</span>
        <div className="flex items-center gap-2">
          <Link
            href={prevHref}
            aria-label="Previous day"
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-white transition-transform active:translate-x-px active:translate-y-px"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
          </Link>
          <span className="text-[12px] font-bold text-foreground">{isToday ? 'Today' : dateLabel}</span>
          {nextHref ? (
            <Link
              href={nextHref}
              aria-label="Next day"
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-white transition-transform active:translate-x-px active:translate-y-px"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
            </Link>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink/20 bg-white text-ink/30">
              <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
            </span>
          )}
        </div>
      </div>

      {/* Greeting */}
      <div className="mt-7 flex items-start justify-between gap-3">
        <h1 className="font-display text-[26px] font-black leading-tight tracking-tight text-foreground">
          {isToday ? `${greeting(hour)}, ${displayName}.` : 'Looking back'}
        </h1>
        {isToday && streak >= 2 && (
          <span className="sticker !bg-mustard shrink-0">
            <Flame className="h-3 w-3" strokeWidth={2.6} />
            <span className="num">{streak}-day streak</span>
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

      {/* Calories — signature ring */}
      <section className="mt-6 flex flex-col items-center">
        <CalorieRing
          pct={pct}
          value={consumed.calories.toLocaleString('en-IN')}
          label={over ? `${Math.abs(remaining).toLocaleString('en-IN')} over goal` : `of ${goals.calories.toLocaleString('en-IN')} kcal`}
          over={over}
        />
        {dayDone && !over && (
          <p className="mt-2 text-[12px] text-muted-foreground">Nicely done today.</p>
        )}
        {over && isToday && (
          <div className="chunk mt-4 w-full !bg-tomato p-3 text-white">
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Over by {Math.abs(remaining)} kcal</div>
            <div className="mt-0.5 text-[13px] font-bold">It&apos;s one day. Tomorrow&apos;s a fresh plate. 🍐</div>
          </div>
        )}
      </section>

      {/* Macros — tappable: shows which foods contributed */}
      <section className="mt-6">
        <MacroPanel
          consumed={{ protein: consumed.protein, carbs: consumed.carbs, fat: consumed.fat, fiber: consumed.fiber }}
          goals={{ protein: goals.protein, carbs: goals.carbs, fat: goals.fat, fiber: goals.fiber }}
          items={dayItems}
        />
      </section>

      {/* Water */}
      <section className="mt-6">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink/50">Water</span>
        <div className="mt-2">
          <WaterTracker initial={water?.glasses ?? 0} date={ymd} />
        </div>
      </section>

      <section className="mt-6">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink/50">
          {isToday ? 'Log a meal' : `Log a meal for ${dateLabel}`}
        </span>
        <div className="mt-3">
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

      {/* Meals */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink/50">
            {isToday ? "Today's meals" : 'Meals'}
          </span>
          <span className="text-[10px] text-ink/40">{rows.length} logged</span>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-2xl border-[3px] border-dashed border-ink/40 p-5 text-center">
            <Image src="/brand/pear-sleeping.png" alt="" width={80} height={80} className="mx-auto h-20 w-20 object-contain opacity-90" />
            <p className="mt-2 text-[12px] text-muted-foreground">
              {isToday ? 'Nothing logged yet. Tell me what you ate above.' : 'Nothing was logged this day.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {mealGroups.map((g, gi) => (
              <div key={g.type} className={gi > 0 ? 'mt-5' : ''}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13px] font-bold text-foreground">
                    <span>{g.emoji}</span> {g.label}
                  </span>
                  <span className="num text-[13px] font-bold text-foreground">
                    {g.entries.reduce((a, m) => a + m.total_calories, 0)} kcal
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {g.entries.map((m) => {
                    const items = (m.food_items as unknown as FoodItem[]) ?? []
                    return (
                      <div key={m.id}>
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
