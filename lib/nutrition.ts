import type { FoodItem } from '@/types/app.types'

/**
 * Sum a list of food items into meal totals.
 * Totals are the single source of truth — always derived from items, never trusted from the client.
 */
export function sumItems(items: FoodItem[]) {
  return items.reduce(
    (acc, it) => ({
      total_calories: acc.total_calories + Math.round(it.calories_kcal || 0),
      total_protein_g: round1(acc.total_protein_g + (it.protein_g || 0)),
      total_carbs_g: round1(acc.total_carbs_g + (it.carbs_g || 0)),
      total_fat_g: round1(acc.total_fat_g + (it.fat_g || 0)),
      total_fiber_g: round1(acc.total_fiber_g + (it.fiber_g || 0)),
    }),
    { total_calories: 0, total_protein_g: 0, total_carbs_g: 0, total_fat_g: 0, total_fiber_g: 0 }
  )
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

// The household is in India — log days run on IST (UTC+5:30, no DST).
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/**
 * Given an optional YYYY-MM-DD (interpreted in IST), return that day's
 * UTC start/end instants for querying logged_at, plus the resolved date string.
 * Defaults to "today" in IST.
 */
export function istDayRange(dateStr?: string) {
  const nowIst = new Date(Date.now() + IST_OFFSET_MS)
  const ymd = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : nowIst.toISOString().slice(0, 10)
  const startUtc = new Date(new Date(ymd + 'T00:00:00Z').getTime() - IST_OFFSET_MS)
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000)
  return { ymd, startIso: startUtc.toISOString(), endIso: endUtc.toISOString() }
}

/** "Today" as YYYY-MM-DD in IST. */
export function istToday() {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** Default goals when the user hasn't set their own yet. */
export const DEFAULT_GOALS = {
  goal_calories: 2000,
  goal_protein_g: 90,
  goal_carbs_g: 250,
  goal_fat_g: 65,
  goal_fiber_g: 30,
}
