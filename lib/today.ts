import 'server-only'
import type { FoodItem } from '@/types/app.types'
import { dayRange, goalsFor } from '@/lib/nutrition'

type QueryClient = {
  from: (table: string) => any
}

type MealRow = {
  meal_type: string
  food_items: unknown
  total_calories: number
  total_protein_g: number | string
  total_carbs_g: number | string
  total_fat_g: number | string
  total_fiber_g: number | string
}

/**
 * Goals, consumed totals and meal names for the current day in the user's zone.
 * Shared by the dashboard-adjacent AI routes (tip, what-fits) so they all
 * ground in the same numbers the dashboard shows.
 */
export async function getTodaySummary(supabase: QueryClient, userId: string, tz: string) {
  const { startIso, endIso, ymd } = dayRange(tz)

  const [{ data: meals }, { data: profile }] = await Promise.all([
    supabase
      .from('meal_logs')
      .select('meal_type, food_items, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g')
      .eq('user_id', userId)
      .gte('logged_at', startIso)
      .lt('logged_at', endIso),
    supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
  ])

  const rows: MealRow[] = meals ?? []
  const goals = goalsFor(profile)
  const consumed = rows.reduce(
    (a, m) => ({
      calories: a.calories + m.total_calories,
      protein: Math.round(a.protein + Number(m.total_protein_g)),
      carbs: Math.round(a.carbs + Number(m.total_carbs_g)),
      fat: Math.round(a.fat + Number(m.total_fat_g)),
      fiber: Math.round(a.fiber + Number(m.total_fiber_g)),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  )
  const mealNames = rows.flatMap((m) => ((m.food_items as unknown as FoodItem[]) ?? []).map((f) => f.name))

  return { ymd, goals, consumed, mealNames }
}
