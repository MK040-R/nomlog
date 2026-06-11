import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { FoodItemSchema } from '@/lib/gemini/parse'
import { sumItems, dayRange, TYPICAL_MEAL_HOUR } from '@/lib/nutrition'
import { getUserTz } from '@/lib/tz-server'

const PatchSchema = z.object({
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  items: z.array(FoodItemSchema).min(1),
  // optional move to another past day (YYYY-MM-DD, user's zone)
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

// PATCH /api/meals/:id  → edit a meal. Totals recomputed server-side from items.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'That meal looks incomplete.' }, { status: 400 })
  }

  const totals = sumItems(parsed.data.items)

  // Moving the meal to another day: timestamp it at that day's typical hour.
  let loggedAt: string | undefined
  if (parsed.data.date) {
    const tz = await getUserTz()
    const { ymd, startIso } = dayRange(tz, parsed.data.date)
    if (ymd > dayRange(tz).ymd) {
      return NextResponse.json({ error: "Can't move meals into the future." }, { status: 400 })
    }
    loggedAt = new Date(new Date(startIso).getTime() + TYPICAL_MEAL_HOUR[parsed.data.meal_type] * 3600_000).toISOString()
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('meal_logs')
    .update({
      meal_type: parsed.data.meal_type,
      food_items: parsed.data.items,
      edited: true,
      ...(loggedAt ? { logged_at: loggedAt } : {}),
      ...totals,
    })
    .eq('id', id)

  if (error) {
    console.error('meals PATCH failed:', error)
    return NextResponse.json({ error: 'Could not update that meal.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/meals/:id  → remove one of the user's meals (RLS scopes it to them).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase.from('meal_logs').delete().eq('id', id)

  if (error) {
    console.error('meals DELETE failed:', error)
    return NextResponse.json({ error: 'Could not delete that meal.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
