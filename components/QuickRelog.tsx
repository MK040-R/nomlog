'use client'

import { useState } from 'react'
import { fetchJson } from '@/lib/fetchJson'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'
import type { FoodItem } from '@/types/app.types'
import { mealTypeForHour } from '@/lib/nutrition'

export type RelogOption = { label: string; kcal: number; items: FoodItem[] }

// One-tap re-log of a frequent recent meal (QLOG-01). No AI call — the items
// are copied verbatim from the previous log.
export function QuickRelog({ options }: { options: RelogOption[] }) {
  const router = useRouter()
  const [busyIdx, setBusyIdx] = useState<number | null>(null)
  const [doneIdx, setDoneIdx] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (options.length === 0) return null

  async function relog(opt: RelogOption, idx: number) {
    setBusyIdx(idx)
    setError(null)
    try {
      await fetchJson('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meal_type: mealTypeForHour(new Date().getHours()), // browser local time
          raw_input: `Logged again: ${opt.label}`,
          input_source: 'text',
          confidence: 'high',
          items: opt.items,
        }),
      })
      setDoneIdx(idx)
      router.refresh()
      setTimeout(() => setDoneIdx(null), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log that.')
    } finally {
      setBusyIdx(null)
    }
  }

  return (
    <div>
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <RotateCcw className="h-3 w-3" strokeWidth={1.5} /> Log again
      </span>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o, i) => (
          <button
            key={i}
            onClick={() => relog(o, i)}
            disabled={busyIdx !== null}
            className="rounded-full border border-border px-3 py-1.5 text-[12px] text-foreground transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            {doneIdx === i ? (
              <span style={{ color: 'var(--color-success)' }}>Logged ✓</span>
            ) : (
              <>
                {busyIdx === i ? '…' : o.label} <span className="num text-muted-foreground">· {o.kcal}</span>
              </>
            )}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-[13px] text-destructive">{error}</p>}
    </div>
  )
}
