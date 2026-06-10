import 'server-only'
import { z } from 'zod'
import { getAI } from './client'

// Thrown when every model attempt failed because Gemini was overloaded (503/429).
// Lets API routes tell the user "busy, try again" instead of "rephrase".
export class GeminiBusyError extends Error {
  constructor() {
    super('Gemini is overloaded')
    this.name = 'GeminiBusyError'
  }
}

// Tried in order. flash-lite is primary: on the free tier it has more headroom
// and lower latency, and our outputs are rough-and-correctable so the slight
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
 * One structured Gemini call with the shared model fallback chain.
 * Validates the JSON response against the given Zod schema before returning.
 * Rotates across models on failure; throws GeminiBusyError if all were overloaded.
 */
export async function generateStructured<T>(opts: {
  prompt: string
  responseSchema: object
  schema: z.ZodType<T>
  temperature?: number
}): Promise<T> {
  let lastError: unknown
  let everSucceededCall = false

  for (let attempt = 0; attempt < MODELS.length; attempt++) {
    try {
      const res = await getAI().models.generateContent({
        model: MODELS[attempt],
        contents: opts.prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: opts.responseSchema,
          temperature: opts.temperature ?? 0.2,
        },
      })
      everSucceededCall = true
      const json = JSON.parse(res.text ?? '{}')
      return opts.schema.parse(json)
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
  throw new Error(`Gemini call failed: ${String(lastError)}`)
}
