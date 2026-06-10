import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogMeal } from '@/components/LogMeal'
import { DeleteMealButton } from '@/components/DeleteMealButton'
import { istDayRange, istToday, shiftYmd, DEFAULT_GOALS } from '@/lib/nutrition'
import type { FoodItem, MealType } from '@/types/app.types'

const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: '🍳',
  lunch: '🍛',
  dinner: '🌙',
  snack: '🍌',
}

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
  const displayName = profile?.name?.trim() || firstName(user.email)
  const dateLabel = new Date(ymd + 'T00:00:00Z').toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
  const prevHref = `/dashboard?date=${shiftYmd(ymd, -1)}`
  const nextDay = shiftYmd(ymd, 1)
  const nextHref = nextDay > istToday() ? null : `/dashboard?date=${nextDay}`

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="nom-eyebrow text-text-muted">{isToday ? 'Today' : dateLabel}</p>
          <h1 className="font-display text-2xl font-bold text-text-strong">
            {isToday ? `${greeting()}, ${displayName} 👋` : 'Looking back'}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={prevHref}
            aria-label="Previous day"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border-default bg-surface-card text-text-body transition active:scale-95"
          >
            ‹
          </Link>
          {nextHref ? (
            <Link
              href={nextHref}
              aria-label="Next day"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border-default bg-surface-card text-text-body transition active:scale-95"
            >
              ›
            </Link>
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle text-text-subtle">›</span>
          )}
        </div>
      </header>

      {/* Calorie hero */}
      <section
        className="flex items-center gap-6 overflow-hidden rounded-[28px] p-6 text-[#FFFBF5]"
        style={{
          background: 'linear-gradient(140deg, var(--color-plum-700) 0%, var(--color-plum-800) 100%)',
          boxShadow: '0 14px 32px rgba(42, 15, 38, 0.28)',
        }}
      >
        <CalorieRing consumed={consumed.calories} goal={goals.calories} />
        <div className="flex flex-col">
          <span className="nom-eyebrow text-[#FFFBF5]/55">
            {remaining >= 0 ? 'Remaining' : 'Over by'}
          </span>
          <span className="nom-data text-4xl font-bold leading-none">
            {Math.abs(remaining)}
          </span>
          <span className="mt-1.5 text-sm text-[#FFFBF5]/70">
            {consumed.calories} of {goals.calories} kcal
          </span>
        </div>
      </section>

      {/* Macros */}
      <section className="grid grid-cols-4 gap-2">
        <MacroTile label="Protein" value={consumed.protein} goal={goals.protein} color="var(--color-macro-protein)" />
        <MacroTile label="Carbs" value={consumed.carbs} goal={goals.carbs} color="var(--color-macro-carbs)" />
        <MacroTile label="Fat" value={consumed.fat} goal={goals.fat} color="var(--color-macro-fat)" />
        <MacroTile label="Fiber" value={consumed.fiber} goal={goals.fiber} color="var(--color-macro-fiber)" />
      </section>

      {/* Log a meal (only on today) */}
      {isToday && <LogMeal />}

      {/* Meals */}
      <section className="flex flex-col gap-3">
        <h2 className="nom-eyebrow text-text-muted">{isToday ? "Today's meals" : 'Meals'}</h2>
        {rows.length === 0 ? (
          <p className="rounded-card border border-dashed border-border-default bg-surface-card px-4 py-8 text-center text-sm text-text-muted">
            {isToday ? 'Nothing logged yet. Tell me what you ate above. ☝️' : 'Nothing was logged this day.'}
          </p>
        ) : (
          rows.map((m) => {
            const foods = (m.food_items as unknown as FoodItem[]) ?? []
            return (
              <div key={m.id} className="rounded-card border border-border-subtle bg-surface-card p-4 shadow-card transition hover:-translate-y-0.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold capitalize text-text-strong">
                    <span className="text-base">{MEAL_EMOJI[m.meal_type]}</span> {m.meal_type}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="nom-data text-sm font-bold text-primary">{m.total_calories} kcal</span>
                    <DeleteMealButton id={m.id} />
                  </div>
                </div>
                <ul className="flex flex-col gap-0.5">
                  {foods.map((f, i) => (
                    <li key={i} className="flex justify-between text-sm text-text-body">
                      <span>{f.name} <span className="text-text-subtle">· {f.portion}</span></span>
                      <span className="nom-data text-text-muted">{Math.round(f.calories_kcal)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })
        )}
      </section>
    </main>
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

function MacroTile({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = Math.min(100, Math.round((value / goal) * 100)) || 0
  return (
    <div className="flex flex-col items-center rounded-input border border-border-subtle bg-surface-card p-2 shadow-card">
      <span className="nom-data text-base font-bold text-text-strong">{Math.round(value)}</span>
      <span className="nom-eyebrow mt-0.5 text-[9px] text-text-muted">{label}</span>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const size = 116
  const stroke = 11
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(1, goal > 0 ? consumed / goal : 0)
  const over = consumed > goal
  const dash = circ * pct
  // On the plum hero, tomato reads "on track"; mustard flags going over (both pop on plum).
  const color = over ? 'var(--color-mustard-500)' : 'var(--color-tomato-500)'

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="nom-data text-2xl font-bold text-[#FFFBF5]">{consumed}</span>
        <span className="text-[10px] uppercase tracking-wider text-[#FFFBF5]/55">kcal</span>
      </div>
    </div>
  )
}
