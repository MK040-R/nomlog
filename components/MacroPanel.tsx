'use client'

import { useState } from 'react'
import type { FoodItem } from '@/types/app.types'

type Totals = { protein: number; carbs: number; fat: number; fiber: number }

const MACROS = [
  { key: 'protein', label: 'Protein', field: 'protein_g', color: 'var(--color-tomato)' },
  { key: 'carbs', label: 'Carbs', field: 'carbs_g', color: 'var(--color-mustard)' },
  { key: 'fat', label: 'Fat', field: 'fat_g', color: 'var(--color-pickle)' },
  { key: 'fiber', label: 'Fiber', field: 'fiber_g', color: 'var(--color-peach)' },
] as const

type MacroKey = (typeof MACROS)[number]['key']

// The four macro columns, tappable: opens a breakdown of which foods
// contributed to that macro today, biggest first.
export function MacroPanel({ consumed, goals, items }: { consumed: Totals; goals: Totals; items: FoodItem[] }) {
  const [open, setOpen] = useState<MacroKey | null>(null)

  const active = MACROS.find((m) => m.key === open)

  // Aggregate same-named foods (e.g. Roti logged twice) for the breakdown.
  const contributors = (() => {
    if (!active) return []
    const byName = new Map<string, { name: string; grams: number }>()
    for (const it of items) {
      const grams = Number(it[active.field]) || 0
      if (grams <= 0) continue
      const key = it.name.trim().toLowerCase()
      const cur = byName.get(key)
      if (cur) cur.grams += grams
      else byName.set(key, { name: it.name.trim(), grams })
    }
    return [...byName.values()].sort((a, b) => b.grams - a.grams).slice(0, 8)
  })()

  const activeTotal = active ? consumed[active.key] : 0

  return (
    <div>
      <div className="flex items-start gap-2">
        {MACROS.map((m) => {
          const value = consumed[m.key]
          const goal = goals[m.key]
          const pct = Math.min(100, Math.round((value / goal) * 100)) || 0
          const selected = open === m.key
          return (
            <button
              key={m.key}
              onClick={() => setOpen(selected ? null : m.key)}
              aria-expanded={selected}
              aria-label={`${m.label}: see which foods contributed`}
              className="flex flex-1 flex-col text-left transition-transform active:scale-95"
            >
              <span
                className="text-[9px] font-bold uppercase leading-none"
                style={{ color: selected ? 'var(--color-tomato)' : 'color-mix(in oklab, var(--color-ink) 70%, transparent)' }}
              >
                {m.label}
              </span>
              <span className="num mt-0.5 text-[10px] font-semibold leading-tight text-ink/60">
                {Math.round(value)}/{goal}g
              </span>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full border-[1.5px] border-ink bg-white">
                <div className="h-full" style={{ width: `${pct}%`, backgroundColor: m.color }} />
              </div>
            </button>
          )
        })}
      </div>

      {active && (
        <div className="animate-pop mt-3 rounded-2xl border-2 border-ink bg-white px-4 py-3">
          {contributors.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Nothing logged with {active.label.toLowerCase()} yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {contributors.map((c) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">{c.name}</span>
                  <div className="h-2 w-16 shrink-0 overflow-hidden rounded-full border border-ink/30 bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.round((c.grams / Math.max(activeTotal, 1)) * 100))}%`,
                        backgroundColor: active.color,
                      }}
                    />
                  </div>
                  <span className="num w-12 shrink-0 text-right text-[13px] text-muted-foreground">
                    {c.grams < 10 ? c.grams.toFixed(1) : Math.round(c.grams)}g
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
