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
  const stats = computeStats(meals ?? [], goalCalories)

  const weightRows = weights ?? []
  const series = weeklyWeightSeries(weightRows)
  const currentWeight =
    weightRows.length > 0 ? Number(weightRows[weightRows.length - 1].weight_kg) : profile?.weight_kg ?? null
  const heightCm = profile?.height_cm ?? null
  const bmi = bmiInfo(currentWeight, heightCm)

  // weight delta over the charted window
  let delta: { value: number; weeks: number } | null = null
  if (series.length >= 2) {
    delta = { value: Math.round((series[series.length - 1].weight - series[0].weight) * 10) / 10, weeks: series.length - 1 }
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
    const num = (k: string) => {
      const raw = formData.get(k)
      if (raw === null || String(raw).trim() === '') return null
      const v = Number(raw)
      return Number.isFinite(v) && v >= 0 ? v : null
    }
    const sb = await createClient()
    await sb.from('user_profiles').upsert({
      id: u.id,
      goal_calories: num('goal_calories'),
      goal_protein_g: num('goal_protein_g'),
      goal_carbs_g: num('goal_carbs_g'),
      goal_fat_g: num('goal_fat_g'),
      goal_fiber_g: num('goal_fiber_g'),
    })
    revalidatePath('/dashboard')
    revalidatePath('/profile')
  }

  return (
    <main className="mx-auto w-full max-w-[390px] px-6 py-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <span className="font-display text-lg font-bold lowercase text-text-strong">nomlog</span>
        <span className="nom-eyebrow text-text-muted">Profile</span>
      </div>

      {/* Identity */}
      <section className="mt-8 flex items-center gap-4">
        <div className="relative">
          <div
            className="flex h-[68px] w-[68px] items-center justify-center rounded-full font-display text-2xl font-bold"
            style={{ backgroundColor: 'var(--color-tomato-100)', color: 'var(--color-tomato-600)' }}
          >
            {initial}
          </div>
          <span
            className="absolute bottom-1 right-1 h-3 w-3 rounded-full border-2"
            style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-surface-page)' }}
          />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight text-text-strong">{displayName}</h1>
          <p className="text-sm text-text-muted">{user.email}</p>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-8 flex items-start justify-between">
        <Stat value={`${stats.daysLogged}`} label="Days" />
        <Stat value={`${stats.streak}`} label="Streak" accent />
        <Stat value={`${stats.onGoalPct}%`} label="On goal" />
      </section>

      <Divider />

      {/* Body */}
      <section>
        <div className="flex items-center justify-between">
          <span className="nom-eyebrow text-text-muted">Body</span>
          <LogWeightSheet
            currentWeight={currentWeight}
            name={name}
            age={str(profile?.age)}
            heightCm={str(profile?.height_cm)}
          />
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div className="flex items-baseline gap-2">
            <span className="nom-data text-5xl font-bold text-text-strong">
              {currentWeight !== null ? currentWeight.toFixed(1) : '—'}
            </span>
            <span className="text-lg text-text-muted">kg</span>
          </div>
          {delta && (
            <span
              className="nom-data text-sm"
              style={{ color: delta.value <= 0 ? 'var(--color-success)' : 'var(--color-text-muted)' }}
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
            <p className="rounded-card border border-dashed border-border-default px-4 py-6 text-center text-sm text-text-muted">
              Log your weight over a few weeks to see your trend. 📉
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-6 text-sm">
          <span className="text-text-muted">
            Height{' '}
            <span className="nom-data font-semibold text-text-strong">
              {heightCm !== null ? `${heightCm} cm` : '—'}
            </span>
          </span>
          <span className="text-text-muted">
            BMI{' '}
            {bmi ? (
              <>
                <span className="nom-data font-semibold text-text-strong">{bmi.bmi}</span>{' '}
                <span className="font-semibold" style={{ color: bmi.color }}>{bmi.label}</span>
              </>
            ) : (
              <span className="text-text-subtle">add height</span>
            )}
          </span>
        </div>
      </section>

      <Divider />

      {/* Daily targets */}
      <DailyTargets initial={targets} action={saveTargets} />

      <Divider />

      {/* Account */}
      <AccountActions />
    </main>
  )
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col">
      <span
        className="font-display text-4xl font-bold leading-none"
        style={{ color: accent ? 'var(--color-primary)' : 'var(--color-text-strong)' }}
      >
        {value}
      </span>
      <span className="nom-eyebrow mt-2 text-text-muted">{label}</span>
    </div>
  )
}

function Divider() {
  return <hr className="my-7 border-0 border-t border-border-subtle" />
}

function firstName(email?: string) {
  if (!email) return 'there'
  const name = email.split('@')[0].replace(/[._0-9]/g, ' ').trim().split(' ')[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}
