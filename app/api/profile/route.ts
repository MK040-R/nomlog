import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { goalsFor, macrosForCalories } from '@/lib/nutrition'

// GET /api/profile → the signed-in user's name, daily goals and current weight.
// Goals fall back to DEFAULT_GOALS when unset. Numeric columns are coerced with
// Number() so they arrive as JSON numbers (PostgREST serializes `numeric` as strings).
export async function GET() {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const supabase = await createClient()
  const { data: p } = await supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle()

  const g = goalsFor(p)
  return NextResponse.json({
    name: p?.name ?? null,
    weight_kg: p?.weight_kg != null ? Number(p.weight_kg) : null,
    goal_weight_kg: p?.goal_weight_kg != null ? Number(p.goal_weight_kg) : null,
    goals: {
      calories: Number(g.calories),
      protein: Number(g.protein),
      carbs: Number(g.carbs),
      fat: Number(g.fat),
      fiber: Number(g.fiber),
    },
  })
}

// PATCH /api/profile → update the name and/or daily goals. Only provided fields
// are written. An empty name clears it back to null.
const PatchSchema = z.object({
  name: z.string().trim().max(80).nullable().optional(),
  goal_calories: z.number().min(500).max(10000).optional(),
  goal_protein_g: z.number().min(0).max(500).optional(),
  goal_carbs_g: z.number().min(0).max(1000).optional(),
  goal_fat_g: z.number().min(0).max(500).optional(),
  goal_fiber_g: z.number().min(0).max(200).optional(),
})

export async function PATCH(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Those profile values look off.' }, { status: 400 })
  }

  const patch: Record<string, unknown> = { id: user.id }
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue
    patch[key] = typeof value === 'string' ? (value.trim() || null) : value
  }

  // Macros follow calories: a calorie-only update re-derives any macro the
  // caller didn't set explicitly, so goals never drift out of coherence.
  if (parsed.data.goal_calories !== undefined) {
    const derived = macrosForCalories(parsed.data.goal_calories)
    if (parsed.data.goal_protein_g === undefined) patch.goal_protein_g = derived.protein
    if (parsed.data.goal_carbs_g === undefined) patch.goal_carbs_g = derived.carbs
    if (parsed.data.goal_fat_g === undefined) patch.goal_fat_g = derived.fat
    if (parsed.data.goal_fiber_g === undefined) patch.goal_fiber_g = derived.fiber
  }

  const supabase = await createClient()
  const { error } = await supabase.from('user_profiles').upsert(patch as never)
  if (error) {
    console.error('profile PATCH failed:', error)
    return NextResponse.json({ error: 'Could not save your profile.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
