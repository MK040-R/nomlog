import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { SignOutButton } from '@/components/SignOutButton'
import { ProfileForm } from '@/components/ProfileForm'
import { DEFAULT_GOALS } from '@/lib/nutrition'

export default async function ProfilePage() {
  const user = await verifySession()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const str = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v))

  const initial = {
    name: str(profile?.name),
    age: str(profile?.age),
    weight_kg: str(profile?.weight_kg),
    height_cm: str(profile?.height_cm),
    goal_calories: str(profile?.goal_calories ?? DEFAULT_GOALS.goal_calories),
    goal_protein_g: str(profile?.goal_protein_g ?? DEFAULT_GOALS.goal_protein_g),
    goal_carbs_g: str(profile?.goal_carbs_g ?? DEFAULT_GOALS.goal_carbs_g),
    goal_fat_g: str(profile?.goal_fat_g ?? DEFAULT_GOALS.goal_fat_g),
    goal_fiber_g: str(profile?.goal_fiber_g ?? DEFAULT_GOALS.goal_fiber_g),
  }

  async function saveProfile(formData: FormData) {
    'use server'
    const u = await verifySession()
    if (!u) redirect('/login')

    const num = (k: string) => {
      const raw = formData.get(k)
      if (raw === null || String(raw).trim() === '') return null
      const v = Number(raw)
      return Number.isFinite(v) && v >= 0 ? v : null
    }
    const text = (k: string) => {
      const raw = formData.get(k)
      const v = raw === null ? '' : String(raw).trim()
      return v === '' ? null : v
    }

    const sb = await createClient()
    await sb.from('user_profiles').upsert({
      id: u.id,
      name: text('name'),
      age: num('age'),
      weight_kg: num('weight_kg'),
      height_cm: num('height_cm'),
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
          <h1 className="font-display text-2xl font-bold text-text-strong">
            {profile?.name ? profile.name : 'Your profile'}
          </h1>
          <p className="mt-0.5 text-xs text-text-muted">{user.email}</p>
        </div>
        <SignOutButton />
      </header>

      <ProfileForm initial={initial} action={saveProfile} />
    </main>
  )
}
