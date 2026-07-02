import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { DailyTargets } from '@/components/DailyTargets'
import { LogWeightSheet } from '@/components/LogWeightSheet'
import { WeightChart } from '@/components/LazyCharts'
import { AccountActions } from '@/components/AccountActions'
import { WeightHistory } from '@/components/WeightHistory'
import { Download } from 'lucide-react'
import { computeStats, weeklyWeightSeries, bmiInfo } from '@/lib/stats'
import { goalsFor } from '@/lib/nutrition'
import { getUserTz } from '@/lib/tz-server'

export default async function ProfilePage() {
  const user = await verifySession()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const [{ data: profile }, { data: meals }, { data: weights }] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase
      .from('meal_logs')
      .select('logged_at, total_calories')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(2000),
    // Newest-first with a cap so a long history can't blow up the page,
    // then flipped back to the ascending order the charts expect.
    supabase
      .from('weight_logs')
      .select('logged_on, weight_kg')
      .eq('user_id', user.id)
      .order('logged_on', { ascending: false })
      .limit(1000),
  ])
  weights?.reverse()

  const effectiveGoals = goalsFor(profile)
  const stats = computeStats(meals ?? [], effectiveGoals.calories, await getUserTz())

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
    goal_calories: str(effectiveGoals.calories),
    goal_protein_g: str(effectiveGoals.protein),
    goal_carbs_g: str(effectiveGoals.carbs),
    goal_fat_g: str(effectiveGoals.fat),
    goal_fiber_g: str(effectiveGoals.fiber),
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
      <div className="mb-8 flex items-center justify-between">
        <span className="font-display text-[17px] font-black lowercase tracking-tight text-foreground">nomlog</span>
        <span className="text-[12px] font-bold text-ink/60">You</span>
      </div>

      {/* Identity */}
      <section className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-ink bg-mustard font-display text-[24px] font-black text-ink">
          {initial}
        </div>
        <div>
          <h1 className="font-display text-[22px] font-black leading-tight tracking-tight text-foreground">{displayName}</h1>
          <p className="text-[12px] text-muted-foreground">{user.email}</p>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-6 grid grid-cols-3 gap-2">
        <Stat value={`${stats.daysLogged}`} label="Days" />
        <Stat value={`${stats.streak}`} label="Streak" accent />
        <Stat value={`${stats.onGoalPct}%`} label="On goal" />
      </section>

      {/* Body */}
      <section className="chunk mt-6 p-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink/50">Body</span>
          <LogWeightSheet
            currentWeight={currentWeight}
            name={name}
            age={str(profile?.age)}
            heightCm={str(profile?.height_cm)}
            goalWeight={str(profile?.goal_weight_kg)}
          />
        </div>

        <div className="mt-3 flex items-end justify-between">
          <div className="flex items-baseline gap-2">
            <span className="num font-display text-[32px] font-black leading-none text-foreground">
              {currentWeight !== null ? currentWeight.toFixed(1) : '—'}
            </span>
            <span className="text-[13px] font-semibold text-muted-foreground">kg</span>
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

        {profile?.goal_weight_kg && currentWeight !== null && (
          <p className="mt-2 text-[13px] text-muted-foreground">
            {Math.abs(currentWeight - Number(profile.goal_weight_kg)) <= 0.3 ? (
              <span style={{ color: 'var(--color-success)' }}>At your goal weight ✓</span>
            ) : (
              <>
                <span className="num font-medium text-foreground">
                  {Math.abs(Math.round((currentWeight - Number(profile.goal_weight_kg)) * 10) / 10).toFixed(1)} kg
                </span>{' '}
                to your {Number(profile.goal_weight_kg).toFixed(1)} kg goal
              </>
            )}
          </p>
        )}

        <div className="mt-4">
          {series.length >= 2 ? (
            <WeightChart data={series.map((s) => ({ label: s.label, weight: s.weight }))} />
          ) : (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              Log your weight over a few weeks to see your trend.
            </p>
          )}
        </div>

        <WeightHistory entries={[...weightRows].reverse().slice(0, 6).map((w) => ({ logged_on: w.logged_on, weight_kg: Number(w.weight_kg) }))} />

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

      {/* Daily targets */}
      <div className="chunk mt-4 !bg-mustard p-4">
        <DailyTargets initial={targets} action={saveTargets} />
      </div>

      {/* Account */}
      <a
        href="/api/export"
        className="mt-4 flex w-full items-center gap-3 rounded-xl border-2 border-ink bg-white px-3 py-3 text-[12px] font-bold text-foreground transition-transform active:translate-x-px active:translate-y-px"
      >
        <Download className="h-4 w-4" strokeWidth={2.2} /> Export my data (CSV)
      </a>
      <AccountActions />

      <p className="mt-8 text-center text-[10px] text-muted-foreground/60">
        nomlog · build {process.env.NEXT_PUBLIC_BUILD_SHA}
      </p>
    </main>
  )
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border-2 border-ink bg-white p-2.5 text-center">
      <span className={`num font-display block text-[20px] font-black leading-none ${accent ? 'text-tomato' : 'text-foreground'}`}>
        {value}
      </span>
      <span className="mt-1 block text-[9px] font-bold uppercase tracking-wide text-ink/55">{label}</span>
    </div>
  )
}

function firstName(email?: string) {
  if (!email) return 'there'
  const name = email.split('@')[0].replace(/[._0-9]/g, ' ').trim().split(' ')[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}
