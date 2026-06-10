import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { FoodItemSchema } from '@/lib/gemini/parse'
import { sumItems, istDayRange } from '@/lib/nutrition'

// GET /api/meals?date=YYYY-MM-DD  → meals logged on that IST day (default: today)
export async function GET(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const date = new URL(request.url).searchParams.get('date') ?? undefined
  const { startIso, endIso, ymd } = istDayRange(date)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meal_logs')
    .select('*')
    .gte('logged_at', startIso)
    .lt('logged_at', endIso)
    .order('logged_at', { ascending: true })

  if (error) {
    console.error('meals GET failed:', error)
    return NextResponse.json({ error: 'Could not load meals.' }, { status: 500 })
  }

  return NextResponse.json({ date: ymd, meals: data })
}

// POST /api/meals  → save a new meal. Totals are computed server-side from items.
const SaveMealSchema = z.object({
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  raw_input: z.string().max(1000).optional(),
  input_source: z.enum(['voice', 'text']).default('text'),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  edited: z.boolean().optional(),
  items: z.array(FoodItemSchema).min(1),
})

export async function POST(request: Request) {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = SaveMealSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'That meal looks incomplete.' }, { status: 400 })
  }

  const { items, ...rest } = parsed.data
  const totals = sumItems(items)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meal_logs')
    .insert({
      user_id: user.id,
      meal_type: rest.meal_type,
      raw_input: rest.raw_input ?? null,
      input_source: rest.input_source,
      confidence: rest.confidence ?? null,
      edited: rest.edited ?? false,
      food_items: items,
      ...totals,
    })
    .select()
    .single()

  if (error) {
    console.error('meals POST failed:', error)
    return NextResponse.json({ error: 'Could not save that meal.' }, { status: 500 })
  }

  return NextResponse.json({ meal: data }, { status: 201 })
}
