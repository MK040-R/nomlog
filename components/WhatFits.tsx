'use client'

import { useState } from 'react'
import { fetchJson } from '@/lib/fetchJson'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import type { FoodItem } from '@/types/app.types'
import { mealTypeForHour } from '@/lib/nutrition'

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
      const data = await fetchJson<{ suggestions: Suggestion[] }>('/api/what-fits', { method: 'POST' })
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
      await fetchJson('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_type: mealTypeForHour(new Date().getHours()), // browser local time
          raw_input: `Suggested: ${s.name}`,
          input_source: 'text',
          confidence: 'medium',
          items: [item],
        }),
      })
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
        <button
          onClick={fetchSuggestions}
          disabled={loading}
          className="chunk chunk-hover w-full !bg-mustard p-3 text-left disabled:opacity-70"
        >
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink/70">
            <Sparkles className="h-3 w-3" strokeWidth={2.6} /> {loading ? 'Thinking…' : 'What can I eat now?'}
          </span>
          <span className="mt-0.5 block text-[13px] font-bold text-ink">
            {loading ? 'Checking your budget…' : 'Tap for ideas that fit what’s left today'}
          </span>
        </button>
      ) : (
        <div className="chunk flex flex-col !bg-mustard p-3">
          <span className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink/70">
            <Sparkles className="h-3 w-3" strokeWidth={2.6} /> What fits right now
          </span>
          <div className="flex flex-col gap-2">
            {suggestions.map((s, i) => (
              <div key={i} className="rounded-xl border-2 border-ink bg-cream px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-foreground">
                      {s.name} <span className="text-[11px] font-semibold text-ink/55">· {s.portion}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink/65">{s.reason}</p>
                    <p className="num mt-0.5 text-[11px] font-semibold text-ink/55">
                      {Math.round(s.calories_kcal)} kcal · P {Math.round(s.protein_g)} · C {Math.round(s.carbs_g)} · F{' '}
                      {Math.round(s.fat_g)} · Fi {Math.round(s.fiber_g)}
                    </p>
                  </div>
                  {loggedIdx === i ? (
                    <span className="shrink-0 text-[11px] font-bold" style={{ color: 'var(--color-success)' }}>
                      Logged ✓
                    </span>
                  ) : (
                    <button
                      onClick={() => logSuggestion(s, i)}
                      disabled={loggingIdx !== null}
                      className="sticker shrink-0 !text-[11px] transition-transform active:translate-x-px active:translate-y-px disabled:opacity-40"
                    >
                      {loggingIdx === i ? '…' : '+ Log'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={fetchSuggestions}
            disabled={loading}
            className="mt-2 self-start text-[11px] font-bold text-ink/70 underline transition-opacity hover:opacity-70"
          >
            {loading ? 'Thinking…' : 'Suggest something else'}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-[13px] text-destructive">{error}</p>}
    </div>
  )
}
