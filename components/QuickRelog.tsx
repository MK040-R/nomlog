'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, Star } from 'lucide-react'
import type { FoodItem, MealType } from '@/types/app.types'
import { fetchJson } from '@/lib/fetchJson'
import { mealTypeForHour } from '@/lib/nutrition'

export type RelogOption = { label: string; kcal: number; items: FoodItem[]; favorite?: boolean }
export type YesterdayMeal = { meal_type: MealType; label: string; kcal: number; items: FoodItem[] }

// One-tap logging shortcuts (QLOG-01 + favorites + copy-yesterday).
// No AI calls — items are copied verbatim from previous logs.
export function QuickRelog({ options, yesterday }: { options: RelogOption[]; yesterday: YesterdayMeal[] }) {
  const router = useRouter()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [doneKey, setDoneKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (options.length === 0 && yesterday.length === 0) return null

  async function log(key: string, items: FoodItem[], mealType: MealType, label: string) {
    setBusyKey(key)
    setError(null)
    try {
      await fetchJson('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_type: mealType,
          raw_input: `Logged again: ${label}`,
          input_source: 'text',
          confidence: 'high',
          items,
        }),
      })
      setDoneKey(key)
      router.refresh()
      setTimeout(() => setDoneKey(null), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log that.')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div>
      {options.length > 0 && (
        <>
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <RotateCcw className="h-3 w-3" strokeWidth={1.5} /> Log again
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {options.map((o, i) => {
              const key = `r${i}`
              return (
                <button
                  key={key}
                  onClick={() => log(key, o.items, mealTypeForHour(new Date().getHours()), o.label)}
                  disabled={busyKey !== null}
                  className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12px] text-foreground transition-opacity hover:opacity-70 disabled:opacity-40"
                >
                  {doneKey === key ? (
                    <span style={{ color: 'var(--color-success)' }}>Logged ✓</span>
                  ) : (
                    <>
                      {o.favorite && (
                        <Star className="h-3 w-3" strokeWidth={1.5} style={{ color: 'var(--color-primary)' }} fill="var(--color-primary)" />
                      )}
                      {busyKey === key ? '…' : o.label} <span className="num text-muted-foreground">· {o.kcal}</span>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {yesterday.length > 0 && (
        <>
          <span className="mt-3 block text-[11px] font-medium text-muted-foreground">Same as yesterday</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {yesterday.map((y) => {
              const key = `y${y.meal_type}`
              return (
                <button
                  key={key}
                  onClick={() => log(key, y.items, y.meal_type, y.label)}
                  disabled={busyKey !== null}
                  className="rounded-full border border-border px-3 py-1.5 text-[12px] capitalize text-foreground transition-opacity hover:opacity-70 disabled:opacity-40"
                >
                  {doneKey === key ? (
                    <span style={{ color: 'var(--color-success)' }}>Logged ✓</span>
                  ) : (
                    <>
                      {busyKey === key ? '…' : y.meal_type} <span className="num text-muted-foreground">· {y.kcal}</span>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {error && <p className="mt-2 text-[13px] text-destructive">{error}</p>}
    </div>
  )
}
