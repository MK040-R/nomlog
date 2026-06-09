// Shared domain types for NomLog.
// FoodItem is the per-item structure stored in meal_logs.food_items (JSONB).
// The totals are stored as dedicated numeric columns, not computed from this array at query time.

export interface FoodItem {
  name: string
  portion: string
  calories_kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type Confidence = 'high' | 'medium' | 'low'
export type InputSource = 'voice' | 'text'
