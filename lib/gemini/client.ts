import 'server-only'

type GeminiClient = {
  models: {
    generateContent: (request: {
      model: string
      contents: string
      config: {
        responseMimeType: 'application/json'
        responseSchema: object
        temperature: number
      }
    }) => Promise<{ text?: string | null }>
  }
}

type GoogleGenAIConstructor = new (options: { apiKey: string }) => GeminiClient

let client: GeminiClient | null = null

// Lazy singleton. We must NOT throw or instantiate at module load: route
// modules are evaluated during `next build`, where the key may be absent.
export async function getAI(): Promise<GeminiClient> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set (server-side only, no NEXT_PUBLIC_ prefix).')
  }
  if (!client) {
    const packageName: string = '@google/genai'
    const { GoogleGenAI } = (await import(packageName)) as { GoogleGenAI: GoogleGenAIConstructor }
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }
  return client
}
