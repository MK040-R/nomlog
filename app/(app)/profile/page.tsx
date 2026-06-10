import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { SignOutButton } from '@/components/SignOutButton'
import { DEFAULT_GOALS } from '@/lib/nutrition'

const FIELDS = [
  { key: 'goal_calories', label: 'Daily calories', unit: 'kcal' },
  { key: 'goal_protein_g', label: 'Protein', unit: 'g' },
  { key: 'goal_carbs_g', label: 'Carbs', unit: 'g' },
  { key: 'goal_fat_g', label: 'Fat', unit: 'g' },
  { key: 'goal_fiber_g', label: 'Fiber', unit: 'g' },
] as const

export default async function ProfilePage() {
  const user = await verifySession()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const values: Record<string, number> = {
    goal_calories: profile?.goal_calories ?? DEFAULT_GOALS.goal_calories,
    goal_protein_g: profile?.goal_protein_g ?? DEFAULT_GOALS.goal_protein_g,
    goal_carbs_g: profile?.goal_carbs_g ?? DEFAULT_GOALS.goal_carbs_g,
    goal_fat_g: profile?.goal_fat_g ?? DEFAULT_GOALS.goal_fat_g,
    goal_fiber_g: profile?.goal_fiber_g ?? DEFAULT_GOALS.goal_fiber_g,
  }

  async function saveGoals(formData: FormData) {
    'use server'
    const u = await verifySession()
    if (!u) redirect('/login')

    const num = (k: string) => {
      const v = Number(formData.get(k))
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
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="nom-eyebrow text-text-muted">You</p>
          <h1 className="font-display text-2xl font-bold text-text-strong">Your goals</h1>
        </div>
        <SignOutButton />
      </header>

      <p className="text-sm text-text-muted">
        Signed in as <span className="font-medium text-text-body">{user.email}</span>
      </p>

      <form action={saveGoals} className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface-card p-5 shadow-card">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-text-body">{f.label}</span>
            <span className="flex items-center gap-2">
              <input
                name={f.key}
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={values[f.key]}
                className="nom-data w-24 rounded-input border border-border-default bg-surface-page px-3 py-2 text-right text-sm text-text-strong outline-none focus:border-primary"
              />
              <span className="w-8 text-xs text-text-muted">{f.unit}</span>
            </span>
          </label>
        ))}

        <button type="submit" className="google-signin-btn mt-2">
          Save goals
        </button>
      </form>

      <p className="px-1 text-xs text-text-muted">
        These targets drive the rings and bars on your dashboard and insights.
      </p>
    </main>
  )
}
