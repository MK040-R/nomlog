import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { DailyTargets } from '@/components/DailyTargets'
import { LogWeightSheet } from '@/components/LogWeightSheet'
import { WeightChart } from '@/components/WeightChart'
import { AccountActions } from '@/components/AccountActions'
import { computeStats, weeklyWeightSeries, bmiInfo } from '@/lib/stats'
import { DEFAULT_GOALS } from '@/lib/nutrition'
import { getUserTz } from '@/lib/tz-server'

export default async function ProfilePage() {
  const user = await verifySession()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const [{ data: profile }, { data: meals }, { data: weights }] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('meal_logs').select('logged_at, total_calories'),
    supabase.from('weight_logs').select('logged_on, weight_kg').order('logged_on', { ascending: true }),
  ])

  const goalCalories = profile?.goal_calories ?? DEFAULT_GOALS.goal_calories
  const stats = computeStats(meals ?? [], goalCalories, await getUserTz())

  const weightRows = weights ?? []
  const series = weeklyWeightSeries(weightRows)
  const currentWeight =
    weightRows.length > 0 ? Number(weightRows[weightRows.length - 1].weight_kg) : profile?.weight_kg ?? null
  const heightCm = profile?.height_cm ?? null
  const bmi = bmiInfo(currentWeight, heightCm)

  let delta: { value: number; weeks: number } | null = null
  if (series.length >= 2) {
    delta = {
      value: Math.round((series[series.length - 1].weight - series[0].weight) * 10) / 10,
      weeks: series.length - 1,
    }
  }

  const name = profile?.name?.trim() || ''
  const displayName = name || firstName(user.email)
  const initial = (displayName[0] || '?').toUpperCase()

  const str = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v))
  const targets = {
    goal_calories: str(profile?.goal_calories ?? DEFAULT_GOALS.goal_calories),
    goal_protein_g: str(profile?.goal_protein_g ?? DEFAULT_GOALS.goal_protein_g),
    goal_carbs_g: str(profile?.goal_carbs_g ?? DEFAULT_GOALS.goal_carbs_g),
    goal_fat_g: str(profile?.goal_fat_g ?? DEFAULT_GOALS.goal_fat_g),
    goal_fiber_g: str(profile?.goal_fiber_g ?? DEFAULT_GOALS.goal_fiber_g),
  }

  async function saveTargets(formData: FormData) {
    'use server'
    const u = await verifySession()
    if (!u) redirect('/login')
    // Only write fields with a usable positive number. An emptied or garbage
    // field keeps its previous value instead of silently nulling the goal.
    const patch: Record<string, number> = {}
    for (const k of ['goal_calories', 'goal_protein_g', 'goal_carbs_g', 'goal_fat_g', 'goal_fiber_g']) {
      const v = Number(formData.get(k))
      if (Number.isFinite(v) && v >= 1) patch[k] = v
    }
    if (Object.keys(patch).length > 0) {
      const sb = await createClient()
      await sb.from('user_profiles').upsert({ id: u.id, ...patch } as never)
    }
    revalidatePath('/dashboard')
    revalidatePath('/profile')
  }

  return (
    <main className="mx-auto w-full max-w-[420px] px-6 pb-20 pt-8">
      {/* Top bar */}
      <div className="mb-10 flex items-center justify-between">
        <span className="font-display text-sm font-medium lowercase tracking-tight text-foreground">nomlog</span>
        <span className="eyebrow">Profile</span>
      </div>

      {/* Identity */}
      <section className="flex items-center gap-4">
        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft font-display text-lg text-primary">
            {initial}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-[var(--color-success)]" />
        </div>
        <div>
          <h1 className="font-display text-[22px] font-medium leading-tight text-foreground">{displayName}</h1>
          <p className="text-[13px] text-muted-foreground">{user.email}</p>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-8 flex items-start justify-between">
        <Stat value={`${stats.daysLogged}`} label="Days" />
        <Stat value={`${stats.streak}`} label="Streak" accent />
        <Stat value={`${stats.onGoalPct}%`} label="On goal" />
      </section>

      <div className="divider my-7" />

      {/* Body */}
      <section>
        <div className="flex items-center justify-between">
          <span className="eyebrow">Body</span>
          <LogWeightSheet
            currentWeight={currentWeight}
            name={name}
            age={str(profile?.age)}
            heightCm={str(profile?.height_cm)}
          />
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div className="flex items-baseline gap-2">
            <span className="num text-[38px] font-medium leading-none text-foreground">
              {currentWeight !== null ? currentWeight.toFixed(1) : '—'}
            </span>
            <span className="text-[13px] text-muted-foreground">kg</span>
          </div>
          {delta && (
            <span
              className="num text-[13px]"
              style={{ color: delta.value <= 0 ? 'var(--color-success)' : 'var(--color-destructive)' }}
            >
              {delta.value > 0 ? '+' : ''}
              {delta.value.toFixed(1)} kg · {delta.weeks} wk
            </span>
          )}
        </div>

        <div className="mt-4">
          {series.length >= 2 ? (
            <WeightChart data={series.map((s) => ({ label: s.label, weight: s.weight }))} />
          ) : (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              Log your weight over a few weeks to see your trend.
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-6 text-[13px]">
          <span className="text-muted-foreground">
            Height{' '}
            <span className="num font-medium text-foreground">{heightCm !== null ? `${heightCm} cm` : '—'}</span>
          </span>
          <span className="text-muted-foreground">
            BMI{' '}
            {bmi ? (
              <>
                <span className="num font-medium text-foreground">{bmi.bmi}</span>{' '}
                <span style={{ color: bmi.color }}>{bmi.label}</span>
              </>
            ) : (
              <span className="text-muted-foreground/70">add height</span>
            )}
          </span>
        </div>
      </section>

      <div className="divider my-7" />

      {/* Daily targets */}
      <DailyTargets initial={targets} action={saveTargets} />

      <div className="divider my-7" />

      {/* Account */}
      <AccountActions />
    </main>
  )
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className={`num text-[22px] font-medium leading-none ${accent ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </span>
      <span className="eyebrow mt-2">{label}</span>
    </div>
  )
}

function firstName(email?: string) {
  if (!email) return 'there'
  const name = email.split('@')[0].replace(/[._0-9]/g, ' ').trim().split(' ')[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}
