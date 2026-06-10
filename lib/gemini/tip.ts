import 'server-only'
import { Type } from '@google/genai'
import { z } from 'zod'
import { generateStructured } from './generate'

const TipSchema = z.object({ tip: z.string().min(1).max(400) })

const responseSchema = {
  type: Type.OBJECT,
  properties: { tip: { type: Type.STRING } },
  required: ['tip'],
}

export type TipContext = {
  goals: { calories: number; protein: number; carbs: number; fat: number; fiber: number }
  consumed: { calories: number; protein: number; carbs: number; fat: number; fiber: number }
  mealNames: string[]
  hourIst: number
}

function buildPrompt(ctx: TipContext) {
  const eaten = ctx.mealNames.length
    ? `So far today they ate: ${ctx.mealNames.join(', ')}.`
    : 'They have not logged anything yet today.'
  return `You write the daily tip for NomLog, a personal Indian-household food log. Voice: warm, witty, a little playful — like a friend who knows food. Never clinical, never naggy, no lecture, no emoji.

The user's daily targets: ${ctx.goals.calories} kcal, ${ctx.goals.protein}g protein, ${ctx.goals.carbs}g carbs, ${ctx.goals.fat}g fat, ${ctx.goals.fiber}g fiber.
Eaten so far today: ${ctx.consumed.calories} kcal, ${ctx.consumed.protein}g protein, ${ctx.consumed.carbs}g carbs, ${ctx.consumed.fat}g fat, ${ctx.consumed.fiber}g fiber.
${eaten}
It is currently ${ctx.hourIst}:00 IST.

Write ONE personalised sentence (under 26 words) reacting to their day so far — a gentle observation or suggestion grounded ONLY in the numbers and foods above. Indian food references welcome. Do not invent foods they didn't log. Do not mention being an AI.`
}

/** One warm sentence about today. Cached per-day by the caller — never call twice a day. */
export async function generateDailyTip(ctx: TipContext): Promise<string> {
  const { tip } = await generateStructured({
    prompt: buildPrompt(ctx),
    responseSchema,
    schema: TipSchema,
    temperature: 0.9,
  })
  return tip.trim()
}
