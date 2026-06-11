import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { FoodItemSchema } from '@/lib/gemini/parse'
import { mealSig, mealLabel } from '@/lib/nutrition'

// POST /api/favorites → star a meal (items copied verbatim, keyed by signature)
const StarSchema = z.object({ items: z.array(FoodItemSchema).min(1) })

export async function POST(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = StarSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Nothing to favorite.' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase.from('favorite_meals').upsert(
    {
      user_id: user.id,
      sig: mealSig(parsed.data.items),
      label: mealLabel(parsed.data.items),
      items: parsed.data.items,
    },
    { onConflict: 'user_id,sig' }
  )
  if (error) {
    console.error('favorite POST failed:', error)
    return NextResponse.json({ error: 'Could not save the favorite.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true }, { status: 201 })
}

// DELETE /api/favorites → un-star by signature
const UnstarSchema = z.object({ sig: z.string().min(1).max(2000) })

export async function DELETE(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = UnstarSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Nothing to remove.' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase.from('favorite_meals').delete().eq('sig', parsed.data.sig)
  if (error) {
    console.error('favorite DELETE failed:', error)
    return NextResponse.json({ error: 'Could not remove the favorite.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
