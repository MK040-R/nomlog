import 'server-only'
import { Type } from '@google/genai'
import { z } from 'zod'
import { generateStructured } from './generate'

const AnswerSchema = z.object({ answer: z.string().min(1).max(2000) })

const responseSchema = {
  type: Type.OBJECT,
  properties: { answer: { type: Type.STRING } },
  required: ['answer'],
}

export type AskExchange = { q: string; a: string }

export type AskContext = {
  goals: { calories: number; protein: number; carbs: number; fat: number; fiber: number }
  consumed: { calories: number; protein: number; carbs: number; fat: number; fiber: number }
  mealNames: string[]
  hourIst: number
  /** Last 7 IST days, oldest first: "2026-06-05: 1430 kcal" or 0 when empty. */
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
- Today so far (it is ${ctx.hourIst}:00 IST): ${ctx.consumed.calories} kcal, ${ctx.consumed.protein}g protein, ${ctx.consumed.carbs}g carbs, ${ctx.consumed.fat}g fat, ${ctx.consumed.fiber}g fiber — eaten: ${eaten}
- Last 7 days: ${ctx.weekLines.join('; ')}
- Recent weights: ${ctx.weightLines.length ? ctx.weightLines.join('; ') : 'none logged'}
${convo}
They now ask: "${ctx.question}"

Answer in under 120 words, grounded in the data above. General Indian food and nutrition knowledge is fine; claims about THEIR log must come only from the data. If the question is unrelated to food, nutrition, weight or their log, say so warmly in one sentence and steer back. Plain text only — no markdown headings.`
}

/** One grounded coach answer. Rolling context comes from the caller (max ~3 exchanges). */
export async function askCoach(ctx: AskContext): Promise<string> {
  const { answer } = await generateStructured({
    prompt: buildPrompt(ctx),
    responseSchema,
    schema: AnswerSchema,
    temperature: 0.6,
  })
  return answer.trim()
}
