'use client'

import { useState } from 'react'
import { Sparkles, ArrowUp } from 'lucide-react'

type Exchange = { q: string; a: string }

const CHIPS = [
  'What can I eat now?',
  "How's my week going?",
  'Suggest a light dinner',
  'How do I hit my protein goal?',
]

// Ask surface (ASK-01..08): free-text + prompt chips, answers as cards
// (newest first), rolling window of the last 3 exchanges sent back for
// follow-ups. State is in-memory only — leaving the tab starts fresh.
export function AskCoach() {
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function ask(q: string) {
    const clean = q.trim()
    if (!clean || pending !== null) return
    setPending(clean)
    setError(null)
    setQuestion('')
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // oldest-first, capped to the last 3 — older turns drop off (ASK-05)
        body: JSON.stringify({ question: clean, history: exchanges.slice(0, 3).reverse() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not answer that.')
      setExchanges((prev) => [{ q: clean, a: data.answer }, ...prev])
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
        <div className="mt-2 flex justify-end">
          <button
            onClick={() => ask(question)}
            disabled={pending !== null || !question.trim()}
            aria-label="Ask"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Prompt chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
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

      {error && <p className="mt-3 text-[13px] text-destructive">{error}</p>}

      {/* Pending card */}
      {pending !== null && (
        <div className="mt-6">
          <AnswerCard q={pending} a={null} />
        </div>
      )}

      {/* Answer cards, newest first */}
      {exchanges.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          {exchanges.map((e, i) => (
            <AnswerCard key={exchanges.length - i} q={e.q} a={e.a} faded={i > 0} />
          ))}
        </div>
      )}
    </div>
  )
}

function AnswerCard({ q, a, faded }: { q: string; a: string | null; faded?: boolean }) {
  return (
    <div className={`rounded-3xl border border-border bg-card p-5 ${faded ? 'opacity-70' : ''}`}>
      <p className="flex items-start gap-1.5 text-[12px] font-medium text-muted-foreground">
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" strokeWidth={1.5} />
        {q}
      </p>
      {a === null ? (
        <p className="mt-3 text-[14px] text-muted-foreground">Thinking…</p>
      ) : (
        <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-foreground">{a}</p>
      )}
    </div>
  )
}
