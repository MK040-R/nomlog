import 'server-only'
import { GoogleGenAI } from '@google/genai'

// Lazy singleton. We must NOT throw or instantiate at module load: route
// modules are evaluated during `next build`, where the key may be absent.
// The check runs on first real use (a request) instead, so the build never
// depends on GEMINI_API_KEY being present.
let client: GoogleGenAI | null = null

export function getAI(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      'GEMINI_API_KEY environment variable is not set (server-side only, no NEXT_PUBLIC_ prefix).'
    )
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }
  return client
}
