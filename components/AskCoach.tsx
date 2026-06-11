'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchJson } from '@/lib/fetchJson'
import { useSpeechInput } from '@/lib/useSpeechInput'
import { mealTypeForHour } from '@/lib/nutrition'
import type { FoodItem } from '@/types/app.types'
import { Sparkles, ArrowUp, Mic, Square } from 'lucide-react'

type Exchange = { q: string; a: string; suggestions: FoodItem[] }

// Prompt chips follow the time of day — breakfast ideas in the morning,
// a day debrief at night.
function chipsForHour(h: number): string[] {
  if (h < 11) return ["What's a good breakfast?", 'How do I hit my protein goal?', "How's my week going?", 'What can I eat now?']
  if (h < 16) return ['What can I eat now?', 'Suggest a light lunch', "How's my week going?", 'How do I hit my protein goal?']
  if (h < 19) return ["What's a light snack?", 'What can I eat now?', 'Suggest a dinner', "How's my week going?"]
  return ['Suggest a light dinner', 'How did today go?', "How's my week going?", 'What can I eat now?']
}

// Ask surface (ASK-01..08): free-text + prompt chips, answers as cards
// (newest first), rolling window of the last 3 exchanges sent back for
// follow-ups. State is in-memory only — leaving the tab starts fresh.
export function AskCoach({ initialQuestion }: { initialQuestion?: string }) {
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [question, setQuestion] = useState(initialQuestion ?? '')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const voice = useSpeechInput({ onTranscript: setQuestion })

  async function ask(q: string) {
    const clean = q.trim()
    if (!clean || pending !== null) return
    setPending(clean)
    setError(null)
    setQuestion('')
    try {
      const data = await fetchJson<{ answer: string; suggestions?: FoodItem[] }>('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // oldest-first, capped to the last 3 — older turns drop off (ASK-05)
        body: JSON.stringify({
          question: clean,
          history: exchanges.slice(0, 3).reverse().map(({ q, a }) => ({ q, a })),
        }),
      })
      setExchanges((prev) => [{ q: clean, a: data.answer, suggestions: data.suggestions ?? [] }, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not answer that.')
      setQuestion(clean) // keep their question so they can retry
    } finally {
      setPending(null)
    }
  }

  return (
    <div>
      {/* Input */}
      <div className="rounded-3xl border border-border bg-card p-4 shadow-[0_2px_16px_rgba(120,80,60,0.06)]">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              ask(question)
            }
          }}
          placeholder="Ask anything about your food…"
          rows={2}
          disabled={pending !== null}
          className="w-full resize-none bg-transparent text-[16px] leading-snug text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="mt-2 flex items-center justify-between">
          <button
            onClick={() => (voice.listening ? voice.stop() : voice.start())}
            disabled={pending !== null}
            aria-label={voice.listening ? 'Stop listening' : 'Speak your question'}
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition-opacity hover:opacity-70 disabled:opacity-40 ${
              voice.listening ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground'
            }`}
          >
            {voice.listening ? <Square className="h-3.5 w-3.5" strokeWidth={2} /> : <Mic className="h-4 w-4" strokeWidth={1.5} />}
          </button>
          <button
            onClick={() => ask(question)}
            disabled={pending !== null || !question.trim() || voice.listening}
            aria-label="Ask"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Prompt chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        {chipsForHour(new Date().getHours()).map((c) => (
          <button
            key={c}
            onClick={() => ask(c)}
            disabled={pending !== null}
            className="rounded-full border border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            {c}
          </button>
        ))}
      </div>

      {voice.listening && (
        <p className="mt-2 text-[13px] text-primary">Listening… tap stop when you&apos;re done.</p>
      )}
      {(error || voice.error) && <p className="mt-3 text-[13px] text-destructive">{error || voice.error}</p>}

      {/* Pending card */}
      {pending !== null && (
        <div className="mt-6">
          <AnswerCard q={pending} a={null} suggestions={[]} />
        </div>
      )}

      {/* Answer cards, newest first */}
      {exchanges.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          {exchanges.map((e, i) => (
            <AnswerCard key={exchanges.length - i} q={e.q} a={e.a} suggestions={e.suggestions} faded={i > 0} />
          ))}
        </div>
      )}
    </div>
  )
}

function AnswerCard({
  q,
  a,
  suggestions,
  faded,
}: {
  q: string
  a: string | null
  suggestions: FoodItem[]
  faded?: boolean
}) {
  const router = useRouter()
  const [loggingIdx, setLoggingIdx] = useState<number | null>(null)
  const [loggedIdx, setLoggedIdx] = useState<number | null>(null)
  const [logError, setLogError] = useState<string | null>(null)

  async function logSuggestion(item: FoodItem, idx: number) {
    setLoggingIdx(idx)
    setLogError(null)
    try {
      await fetchJson('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_type: mealTypeForHour(new Date().getHours()),
          raw_input: `Coach suggested: ${item.name}`,
          input_source: 'text',
          confidence: 'medium',
          items: [item],
        }),
      })
      setLoggedIdx(idx)
      router.refresh()
    } catch (err) {
      setLogError(err instanceof Error ? err.message : 'Could not log that.')
    } finally {
      setLoggingIdx(null)
    }
  }

  return (
    <div className={`rounded-3xl border border-border bg-card p-5 ${faded ? 'opacity-70' : ''}`}>
      <p className="flex items-start gap-1.5 text-[12px] font-medium text-muted-foreground">
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" strokeWidth={1.5} />
        {q}
      </p>
      {a === null ? (
        <p className="mt-3 text-[14px] text-muted-foreground">Thinking…</p>
      ) : (
        <>
          <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-foreground">{a}</p>
          {suggestions.length > 0 && (
            <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-3">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 text-[13px] text-foreground">
                    {s.name} <span className="num text-[11px] text-muted-foreground">· {s.portion} · {Math.round(s.calories_kcal)} kcal</span>
                  </span>
                  {loggedIdx === i ? (
                    <span className="shrink-0 text-[11px] font-medium" style={{ color: 'var(--color-success)' }}>
                      Logged ✓
                    </span>
                  ) : (
                    <button
                      onClick={() => logSuggestion(s, i)}
                      disabled={loggingIdx !== null}
                      className="h-7 shrink-0 rounded-full border border-border px-3 text-[11px] font-medium text-primary transition-opacity hover:opacity-70 disabled:opacity-40"
                    >
                      {loggingIdx === i ? '…' : 'Log'}
                    </button>
                  )}
                </div>
              ))}
              {logError && <p className="text-[12px] text-destructive">{logError}</p>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
