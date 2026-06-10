import 'server-only'
import { Type } from '@google/genai'
import { z } from 'zod'
import { generateStructured } from './generate'

// Zod schema — validates whatever Gemini returns before we trust it.
export const FoodItemSchema = z.object({
  name: z.string().min(1),
  portion: z.string().min(1),
  calories_kcal: z.number().min(0),
  protein_g: z.number().min(0),
  carbs_g: z.number().min(0),
  fat_g: z.number().min(0),
  fiber_g: z.number().min(0),
})

// items may be empty: that is the model's way of saying "no food in this input".
// Callers must handle the empty case — never invent nutrition for non-food text.
export const ParsedMealSchema = z.object({
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  confidence: z.enum(['high', 'medium', 'low']),
  items: z.array(FoodItemSchema),
})

export type ParsedMeal = z.infer<typeof ParsedMealSchema>

// Gemini's own schema format (mirrors the Zod schema above).
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    meal_type: { type: Type.STRING, enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
    confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          portion: { type: Type.STRING },
          calories_kcal: { type: Type.NUMBER },
          protein_g: { type: Type.NUMBER },
          carbs_g: { type: Type.NUMBER },
          fat_g: { type: Type.NUMBER },
          fiber_g: { type: Type.NUMBER },
        },
        required: ['name', 'portion', 'calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'],
        propertyOrdering: ['name', 'portion', 'calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'],
      },
    },
  },
  required: ['meal_type', 'confidence', 'items'],
}

function buildPrompt(text: string) {
  const hourIst = new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCHours()
  return `You estimate nutrition for an Indian household food log. The user said what they ate, casually and often in Indian-English with local dish names (e.g. "two rotis with dal and a bowl of curd", "masala dosa", "filter coffee", "paneer butter masala with naan").

Break it into individual food items. For each item give:
- name: the dish/food, title-cased and clean (e.g. "Masala Dosa", "Toor Dal", "Curd")
- portion: a human portion estimate (e.g. "2 pieces", "1 bowl (150g)", "1 cup")
- calories_kcal, protein_g, carbs_g, fat_g, fiber_g: realistic estimates for that portion

Rules:
- FIRST classify the input, in this order:
  (a) It names specific food or drink → parse those items.
  (b) It says the user ate/drank something but gives no detail ("ate some food", "had lunch outside", "khana khaya") → eating DID happen: estimate one typical Indian meal for that time of day, confidence "low".
  (c) It says food was NOT eaten ("kuch nahi khaya", "skipped lunch") → return an empty items array.
  (d) It contains no eating at all — gibberish, random words, names, greetings, endearments, questions, test input (e.g. "subha pyar", "hello hello", "asdf", "what is the weather") → return an empty items array. NEVER invent a dish or assign nutrition to words that are not food.
- If the input mixes food and non-food words, include only the food items and ignore the rest.
- Plain water or other zero-calorie drinks ARE consumed drinks: include them as items with 0 values, not an empty array.
- Use typical Indian home-cooked portions and recipes unless the user says otherwise.
- If quantity is vague, assume a normal single serving.
- meal_type: infer from the food and that it's currently hour ${hourIst}:00 IST. Breakfast items + morning → breakfast; light items between meals → snack; otherwise lunch/dinner by time.
- confidence: "high" if portions were specific, "medium" if you estimated portions, "low" if the input was very vague.
- Numbers only — no ranges, no units inside the numeric fields.

User said: "${text}"`
}

/**
 * Parse a free-text meal description into structured items + nutrition.
 * Uses the shared model fallback chain; throws GeminiBusyError if overloaded.
 */
export async function parseMeal(text: string): Promise<ParsedMeal> {
  return generateStructured({
    prompt: buildPrompt(text),
    responseSchema,
    schema: ParsedMealSchema,
    temperature: 0.2,
  })
}
