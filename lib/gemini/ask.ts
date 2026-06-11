import 'server-only'
import { Type } from '@google/genai'
import { z } from 'zod'
import { generateStructured } from './generate'
import { FoodItemSchema } from './parse'

const AnswerSchema = z.object({
  answer: z.string().min(1).max(2000),
  // dishes the answer recommends eating, loggable in one tap
  suggestions: z.array(FoodItemSchema).max(3).default([]),
})

const foodItemSchema = {
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
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    answer: { type: Type.STRING },
    suggestions: { type: Type.ARRAY, items: foodItemSchema },
  },
  required: ['answer', 'suggestions'],
}

export type AskExchange = { q: string; a: string }

export type AskContext = {
  goals: { calories: number; protein: number; carbs: number; fat: number; fiber: number }
  consumed: { calories: number; protein: number; carbs: number; fat: number; fiber: number }
  mealNames: string[]
  hourLocal: number
  /** Last 7 local days, oldest first: "2026-06-05: 1430 kcal" or 0 when empty. */
  weekLines: string[]
  /** Up to 3 recent weights, newest first: "78.0 kg on 2026-06-11". */
  weightLines: string[]
  history: AskExchange[]
  question: string
}

function buildPrompt(ctx: AskContext) {
  const eaten = ctx.mealNames.length ? ctx.mealNames.join(', ') : 'nothing yet'
  const convo = ctx.history.length
    ? `\nConversation so far (oldest first):\n${ctx.history.map((e) => `They asked: ${e.q}\nYou answered: ${e.a}`).join('\n')}\n`
    : ''
  return `You are the NomLog coach — a warm, practical nutrition companion for an Indian household food log. Voice: friendly and specific, never clinical, never preachy. No emoji.

THEIR DATA — the ONLY facts you may use about them. Never invent meals, numbers, weights or history beyond this:
- Daily targets: ${ctx.goals.calories} kcal, ${ctx.goals.protein}g protein, ${ctx.goals.carbs}g carbs, ${ctx.goals.fat}g fat, ${ctx.goals.fiber}g fiber
- Today so far (it is ${ctx.hourLocal}:00 their local time): ${ctx.consumed.calories} kcal, ${ctx.consumed.protein}g protein, ${ctx.consumed.carbs}g carbs, ${ctx.consumed.fat}g fat, ${ctx.consumed.fiber}g fiber — eaten: ${eaten}
- Last 7 days: ${ctx.weekLines.join('; ')}
- Recent weights: ${ctx.weightLines.length ? ctx.weightLines.join('; ') : 'none logged'}
${convo}
They now ask: "${ctx.question}"

Answer in under 120 words, grounded in the data above. General Indian food and nutrition knowledge is fine; claims about THEIR log must come only from the data. If the question is unrelated to food, nutrition, weight or their log, say so warmly in one sentence and steer back. Plain text only — no markdown headings.

Also: if your answer recommends specific dishes for them to eat now or at their next meal, list those dishes (max 3) in "suggestions" with a realistic single-serving portion and nutrition estimates, so the app can log one in a single tap. Only dishes you actually recommended in the answer. Otherwise return an empty suggestions array.`
}

export type CoachReply = z.infer<typeof AnswerSchema>

/** One grounded coach answer (+ loggable dish suggestions when relevant). */
export async function askCoach(ctx: AskContext): Promise<CoachReply> {
  const reply = await generateStructured({
    prompt: buildPrompt(ctx),
    responseSchema,
    schema: AnswerSchema,
    temperature: 0.6,
  })
  return { ...reply, answer: reply.answer.trim() }
}
