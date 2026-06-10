import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { LogMeal } from '@/components/LogMeal'
import { MealCard } from '@/components/MealCard'
import { istDayRange, istToday, shiftYmd, DEFAULT_GOALS } from '@/lib/nutrition'
import type { FoodItem } from '@/types/app.types'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const user = await verifySession()
  if (!user) redirect('/login')

  const { date: dateParam } = await searchParams
  const supabase = await createClient()
  const { startIso, endIso, ymd } = istDayRange(dateParam)
  if (ymd > istToday()) redirect('/dashboard')
  const isToday = ymd === istToday()

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
  const nextHref = nextDay > istToday() ? null : `/dashboard?date=${nextDay}`

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
      <h1 className="mt-8 font-display text-[22px] font-medium leading-tight text-foreground">
        {isToday ? `${greeting()}, ${displayName}` : 'Looking back'}
      </h1>

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
      </section>

      <div className="divider my-7" />

      {/* Macros */}
      <section className="flex items-start justify-between">
        <Macro label="Protein" value={consumed.protein} goal={goals.protein} />
        <Macro label="Carbs" value={consumed.carbs} goal={goals.carbs} />
        <Macro label="Fat" value={consumed.fat} goal={goals.fat} />
        <Macro label="Fiber" value={consumed.fiber} goal={goals.fiber} />
      </section>

      {isToday && (
        <>
          <div className="divider my-7" />
          <section>
            <span className="eyebrow">Log a meal</span>
            <div className="mt-4">
              <LogMeal />
            </div>
          </section>
        </>
      )}

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
            {rows.map((m, idx) => (
              <div key={m.id} className={idx > 0 ? 'mt-4 border-t border-border/60 pt-4' : ''}>
                <MealCard
                  meal={{
                    id: m.id,
                    meal_type: m.meal_type,
                    total_calories: m.total_calories,
                    food_items: (m.food_items as unknown as FoodItem[]) ?? [],
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function Macro({ label, value, goal }: { label: string; value: number; goal: number }) {
  const pct = Math.min(100, Math.round((value / goal) * 100)) || 0
  return (
    <div className="flex w-[22%] flex-col">
      <span className="num text-[20px] font-medium leading-none text-foreground">
        {Math.round(value)}
        <span className="text-[12px] font-normal text-muted-foreground">g</span>
      </span>
      <span className="eyebrow mt-1.5">{label}</span>
      <div className="mt-2 h-px w-full bg-muted">
        <div className="h-full bg-foreground/30" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function greeting() {
  const h = new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function firstName(email?: string) {
  if (!email) return 'there'
  const name = email.split('@')[0].replace(/[._0-9]/g, ' ').trim().split(' ')[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}
