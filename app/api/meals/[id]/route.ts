import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { FoodItemSchema } from '@/lib/gemini/parse'
import { sumItems } from '@/lib/nutrition'

const PatchSchema = z.object({
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  items: z.array(FoodItemSchema).min(1),
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
  const supabase = await createClient()
  const { error } = await supabase
    .from('meal_logs')
    .update({
      meal_type: parsed.data.meal_type,
      food_items: parsed.data.items,
      edited: true,
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
