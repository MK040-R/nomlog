import 'server-only'
import { GoogleGenAI } from '@google/genai'

if (!process.env.GEMINI_API_KEY) {
  throw new Error(
    'GEMINI_API_KEY environment variable is not set. ' +
    'Add it to .env.local (no NEXT_PUBLIC_ prefix).'
  )
}

// Module-level singleton. Instantiated once per server process.
// Route Handlers and server actions import `ai` from this file — never from client modules.
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
