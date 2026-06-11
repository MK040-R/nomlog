import 'server-only'
import { Type } from '@google/genai'
import { z } from 'zod'
import { generateStructured } from './generate'
import { FoodItemSchema } from './parse'

// Each suggestion is a loggable FoodItem plus a one-line reason it fits.
const SuggestionSchema = FoodItemSchema.extend({ reason: z.string().min(1).max(120) })
const WhatFitsSchema = z.object({ suggestions: z.array(SuggestionSchema).min(1).max(3) })

export type FitSuggestion = z.infer<typeof SuggestionSchema>

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    suggestions: {
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
          reason: { type: Type.STRING },
        },
        required: ['name', 'portion', 'calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'reason'],
        propertyOrdering: ['name', 'portion', 'calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'reason'],
      },
    },
  },
  required: ['suggestions'],
}

export type FitContext = {
  remaining: { calories: number; protein: number; carbs: number; fat: number; fiber: number }
  mealNames: string[]
  hourLocal: number
}

function buildPrompt(ctx: FitContext) {
  const eaten = ctx.mealNames.length ? `Already eaten today: ${ctx.mealNames.join(', ')}.` : ''
  return `You suggest what to eat next for an Indian household food log.

Remaining for today: ${ctx.remaining.calories} kcal, ${ctx.remaining.protein}g protein, ${ctx.remaining.carbs}g carbs, ${ctx.remaining.fat}g fat, ${ctx.remaining.fiber}g fiber.
${eaten}
It is currently ${ctx.hourLocal}:00 in their local time.

Suggest 2-3 specific Indian dishes or snacks (home-cooked or common) that fit the remaining budget and suit this time of day. Prefer filling gaps — e.g. if protein remaining is high, lean protein-rich. Vary from what they already ate.

For each suggestion give:
- name: the dish, title-cased (e.g. "Moong Dal Chilla", "Sprouts Chaat")
- portion: a realistic single serving (e.g. "2 pieces", "1 bowl (150g)")
- calories_kcal, protein_g, carbs_g, fat_g, fiber_g: realistic estimates for that portion
- reason: one short phrase on why it fits (under 10 words, e.g. "fills your protein gap, light on calories")

Rules:
- Every suggestion's calories must fit within the remaining kcal. If remaining kcal is under 150 (or negative), suggest only very light options like buttermilk, cucumber, or green tea.
- Numbers only — no ranges, no units inside numeric fields.`
}

/** 2-3 dishes that fit the remaining budget. On-demand only — one call per tap. */
export async function suggestWhatFits(ctx: FitContext): Promise<FitSuggestion[]> {
  const { suggestions } = await generateStructured({
    prompt: buildPrompt(ctx),
    responseSchema,
    schema: WhatFitsSchema,
    temperature: 0.7,
  })
  return suggestions
}
