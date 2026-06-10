import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { FoodItem } from '@/types/app.types'
import { istDayRange, DEFAULT_GOALS } from '@/lib/nutrition'

/**
 * Goals, consumed totals and meal names for the current IST day.
 * Shared by the dashboard-adjacent AI routes (tip, what-fits) so they all
 * ground in the same numbers the dashboard shows.
 */
export async function getTodaySummary(supabase: SupabaseClient<Database>, userId: string) {
  const { startIso, endIso, ymd } = istDayRange()

  const [{ data: meals }, { data: profile }] = await Promise.all([
    supabase
      .from('meal_logs')
      .select('meal_type, food_items, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g')
      .gte('logged_at', startIso)
      .lt('logged_at', endIso),
    supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle(),
  ])

  const rows = meals ?? []
  const goals = {
    calories: profile?.goal_calories ?? DEFAULT_GOALS.goal_calories,
    protein: profile?.goal_protein_g ?? DEFAULT_GOALS.goal_protein_g,
    carbs: profile?.goal_carbs_g ?? DEFAULT_GOALS.goal_carbs_g,
    fat: profile?.goal_fat_g ?? DEFAULT_GOALS.goal_fat_g,
    fiber: profile?.goal_fiber_g ?? DEFAULT_GOALS.goal_fiber_g,
  }
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
