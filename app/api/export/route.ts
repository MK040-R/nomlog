import { NextResponse } from 'next/server'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import { ymdOf } from '@/lib/nutrition'
import { getUserTz } from '@/lib/tz-server'
import type { FoodItem } from '@/types/app.types'

// GET /api/export → all meal logs as CSV, one row per food item.
export async function GET() {
  const user = await verifySession()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })

  const tz = await getUserTz()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meal_logs')
    .select('logged_at, meal_type, food_items, total_calories, raw_input')
    .order('logged_at', { ascending: true })

  if (error) {
    console.error('export failed:', error)
    return NextResponse.json({ error: 'Could not export.' }, { status: 500 })
  }

  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = ['date,meal_type,item,portion,calories_kcal,protein_g,carbs_g,fat_g,fiber_g,meal_total_kcal,raw_input']
  for (const m of data ?? []) {
    const date = ymdOf(tz, m.logged_at)
    for (const it of (m.food_items as unknown as FoodItem[]) ?? []) {
      lines.push(
        [
          date,
          m.meal_type,
          esc(it.name),
          esc(it.portion),
          it.calories_kcal,
          it.protein_g,
          it.carbs_g,
          it.fat_g,
          it.fiber_g,
          m.total_calories,
          esc(m.raw_input ?? ''),
        ].join(',')
      )
    }
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="nomlog-export.csv"',
    },
  })
}
