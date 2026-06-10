import 'server-only'
import { Type } from '@google/genai'
import { z } from 'zod'
import { generateStructured } from './generate'

const RecapSchema = z.object({ recap: z.string().min(1).max(900) })

const responseSchema = {
  type: Type.OBJECT,
  properties: { recap: { type: Type.STRING } },
  required: ['recap'],
}

export type RecapContext = {
  daysLogged: number
  avgCalories: number
  goalCalories: number
  onGoalDays: number
  streak: number
  /** e.g. "protein (44g avg of 90g goal)" — the macro furthest below goal. */
  weakestMacro: string
  topFoods: string[]
}

function buildPrompt(ctx: RecapContext) {
  return `You write the weekly recap for NomLog, a personal Indian-household food log. Voice: warm, encouraging, a little witty — a friend reviewing the week, never a lecture. No emoji.

Their last 7 days:
- Logged food on ${ctx.daysLogged} of 7 days (current streak: ${ctx.streak} days)
- Average ${ctx.avgCalories} kcal/day against a ${ctx.goalCalories} kcal goal
- At or under their calorie goal on ${ctx.onGoalDays} of the ${ctx.daysLogged} logged days
- Macro furthest below goal: ${ctx.weakestMacro}
- Most eaten: ${ctx.topFoods.length ? ctx.topFoods.join(', ') : 'not much logged'}

Write ONE short paragraph (3-4 sentences, under 80 words): how the week went, the one thing to nudge (the weak macro or logging consistency — pick what matters most), and end encouraging. Ground every claim in the numbers above; never invent foods or numbers.`
}

/** One warm paragraph about the past week. Cached per IST week by the caller. */
export async function generateWeeklyRecap(ctx: RecapContext): Promise<string> {
  const { recap } = await generateStructured({
    prompt: buildPrompt(ctx),
    responseSchema,
    schema: RecapSchema,
    temperature: 0.8,
  })
  return recap.trim()
}
