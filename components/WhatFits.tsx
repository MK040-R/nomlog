'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import type { FoodItem } from '@/types/app.types'
import { mealTypeForIstHour, istHourNow } from '@/lib/nutrition'

type Suggestion = FoodItem & { reason: string }

// "What can I eat now?" — on-demand suggestions that fit the remaining budget.
// One Gemini call per tap; each suggestion can be logged with one more tap.
export function WhatFits() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [loggingIdx, setLoggingIdx] = useState<number | null>(null)
  const [loggedIdx, setLoggedIdx] = useState<number | null>(null)

  async function fetchSuggestions() {
    setLoading(true)
    setError(null)
    setLoggedIdx(null)
    try {
      const res = await fetch('/api/what-fits', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not get suggestions.')
      setSuggestions(data.suggestions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get suggestions.')
    } finally {
      setLoading(false)
    }
  }

  async function logSuggestion(s: Suggestion, idx: number) {
    setLoggingIdx(idx)
    setError(null)
    try {
      const item: FoodItem = {
        name: s.name,
        portion: s.portion,
        calories_kcal: s.calories_kcal,
        protein_g: s.protein_g,
        carbs_g: s.carbs_g,
        fat_g: s.fat_g,
        fiber_g: s.fiber_g,
      }
      const res = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_type: mealTypeForIstHour(istHourNow()),
          raw_input: `Suggested: ${s.name}`,
          input_source: 'text',
          confidence: 'medium',
          items: [item],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not log that.')
      setLoggedIdx(idx)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log that.')
    } finally {
      setLoggingIdx(null)
    }
  }

  return (
    <div>
      {suggestions === null ? (
        <button onClick={fetchSuggestions} disabled={loading} className="btn-ghost w-full text-[13px]">
          <Sparkles className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
          {loading ? 'Thinking…' : 'What can I eat now?'}
        </button>
      ) : (
        <div className="flex flex-col">
          {suggestions.map((s, i) => (
            <div key={i} className={i > 0 ? 'mt-3 border-t border-border/60 pt-3' : ''}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-[15px] font-medium text-foreground">
                    {s.name} <span className="text-[12px] font-normal text-muted-foreground">· {s.portion}</span>
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{s.reason}</p>
                  <p className="num mt-1 text-[12px] text-muted-foreground">
                    {Math.round(s.calories_kcal)} kcal · P {Math.round(s.protein_g)} · C {Math.round(s.carbs_g)} · F{' '}
                    {Math.round(s.fat_g)} · Fi {Math.round(s.fiber_g)}
                  </p>
                </div>
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
            </div>
          ))}
          <button
            onClick={fetchSuggestions}
            disabled={loading}
            className="mt-3 self-start text-[11px] font-medium text-muted-foreground transition-opacity hover:opacity-70"
          >
            {loading ? 'Thinking…' : 'Suggest something else'}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-[13px] text-destructive">{error}</p>}
    </div>
  )
}
