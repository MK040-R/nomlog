import 'server-only'
import { Type } from '@google/genai'
import { z } from 'zod'
import { getAI } from './client'

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

export const ParsedMealSchema = z.object({
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  confidence: z.enum(['high', 'medium', 'low']),
  items: z.array(FoodItemSchema).min(1),
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
- Use typical Indian home-cooked portions and recipes unless the user says otherwise.
- If quantity is vague, assume a normal single serving.
- meal_type: infer from the food and that it's currently hour ${hourIst}:00 IST. Breakfast items + morning → breakfast; light items between meals → snack; otherwise lunch/dinner by time.
- confidence: "high" if portions were specific, "medium" if you estimated portions, "low" if the input was very vague.
- Numbers only — no ranges, no units inside the numeric fields.

User said: "${text}"`
}

// Thrown when every model attempt failed because Gemini was overloaded (503).
// Lets the API route tell the user "busy, try again" instead of "rephrase".
export class GeminiBusyError extends Error {
  constructor() {
    super('Gemini is overloaded')
    this.name = 'GeminiBusyError'
  }
}

// Tried in order. flash-lite is primary: on the free tier it has more headroom
// and lower latency, and our estimates are rough-and-correctable so the slight
// quality drop doesn't matter. Full flash is the fallback when lite is busy.
// (gemini-2.0-flash is quota-exhausted on this key, so it's left out.)
const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash']

function isOverloaded(err: unknown) {
  const s = String(err)
  return (
    s.includes('503') ||
    s.includes('UNAVAILABLE') ||
    s.includes('overloaded') ||
    s.includes('high demand') ||
    s.includes('429') ||
    s.includes('RESOURCE_EXHAUSTED')
  )
}

/**
 * Parse a free-text meal description into structured items + nutrition.
 * Rotates across models on failure; throws GeminiBusyError if all were overloaded.
 */
export async function parseMeal(text: string): Promise<ParsedMeal> {
  const prompt = buildPrompt(text)
  let lastError: unknown
  let everSucceededCall = false

  for (let attempt = 0; attempt < MODELS.length; attempt++) {
    try {
      const res = await getAI().models.generateContent({
        model: MODELS[attempt],
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.2,
        },
      })
      everSucceededCall = true
      const json = JSON.parse(res.text ?? '{}')
      return ParsedMealSchema.parse(json)
    } catch (err) {
      lastError = err
      // If the call itself returned JSON but it failed validation, a different
      // model won't help much — but a quick retry is cheap. Back off briefly.
      if (attempt < MODELS.length - 1) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
    }
  }

  // Every attempt failed. If they were all "overloaded" (and we never got a
  // usable response), surface a busy error so the user knows to just retry.
  if (!everSucceededCall && isOverloaded(lastError)) throw new GeminiBusyError()
  throw new Error(`Gemini parse failed: ${String(lastError)}`)
}
