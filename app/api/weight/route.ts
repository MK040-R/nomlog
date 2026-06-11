import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { todayYmd } from '@/lib/nutrition'
import { getUserTz } from '@/lib/tz-server'

const BodySchema = z.object({
  weight_kg: z.number().min(20).max(400),
  logged_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // optional body details saved alongside
  name: z.string().max(80).nullable().optional(),
  age: z.number().int().min(0).max(130).nullable().optional(),
  height_cm: z.number().min(50).max(260).nullable().optional(),
  goal_weight_kg: z.number().min(20).max(400).nullable().optional(),
})

export async function POST(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid weight.' }, { status: 400 })
  }

  const { weight_kg, name, age, height_cm, goal_weight_kg } = parsed.data
  const date = parsed.data.logged_on ?? todayYmd(await getUserTz())
  const supabase = await createClient()

  // One weight entry per day — upsert.
  const { error: wErr } = await supabase
    .from('weight_logs')
    .upsert({ user_id: user.id, logged_on: date, weight_kg }, { onConflict: 'user_id,logged_on' })
  if (wErr) {
    console.error('weight upsert failed:', wErr)
    return NextResponse.json({ error: 'Could not save your weight.' }, { status: 500 })
  }

  // Keep the profile's current weight (and any edited body details) in sync.
  const profilePatch: Record<string, unknown> = { id: user.id, weight_kg }
  if (name !== undefined) profilePatch.name = name
  if (age !== undefined) profilePatch.age = age
  if (height_cm !== undefined) profilePatch.height_cm = height_cm
  if (goal_weight_kg !== undefined) profilePatch.goal_weight_kg = goal_weight_kg

  const { error: pErr } = await supabase.from('user_profiles').upsert(profilePatch as never)
  if (pErr) {
    console.error('profile sync failed:', pErr)
    return NextResponse.json({ error: 'Saved weight, but could not update details.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}

// DELETE /api/weight → remove one day's entry
const DeleteSchema = z.object({ logged_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })

export async function DELETE(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = DeleteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase.from('weight_logs').delete().eq('logged_on', parsed.data.logged_on)
  if (error) {
    console.error('weight DELETE failed:', error)
    return NextResponse.json({ error: 'Could not delete that entry.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
