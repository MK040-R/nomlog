'use client'

import { useState } from 'react'
import type { FoodItem } from '@/types/app.types'

type Totals = { protein: number; carbs: number; fat: number; fiber: number }

const MACROS = [
  { key: 'protein', label: 'Protein', field: 'protein_g' },
  { key: 'carbs', label: 'Carbs', field: 'carbs_g' },
  { key: 'fat', label: 'Fat', field: 'fat_g' },
  { key: 'fiber', label: 'Fiber', field: 'fiber_g' },
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
      <div className="flex items-start justify-between">
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
              className="flex w-[22%] flex-col text-left transition-opacity active:opacity-60"
            >
              <span className="num text-[20px] font-medium leading-none text-foreground">
                {Math.round(value)}
                <span className="text-[12px] font-normal text-muted-foreground">g</span>
              </span>
              <span className="eyebrow mt-1.5" style={selected ? { color: 'var(--color-primary)' } : undefined}>
                {m.label}
              </span>
              <div className="mt-2 h-px w-full bg-muted">
                <div
                  className="h-full"
                  style={{ width: `${pct}%`, backgroundColor: selected ? 'var(--color-primary)' : 'color-mix(in oklab, var(--color-foreground) 30%, transparent)' }}
                />
              </div>
            </button>
          )
        })}
      </div>

      {active && (
        <div className="mt-4 rounded-2xl bg-muted/50 px-4 py-3">
          {contributors.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Nothing logged with {active.label.toLowerCase()} yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {contributors.map((c) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{c.name}</span>
                  <div className="h-px w-16 shrink-0 bg-border">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(100, Math.round((c.grams / Math.max(activeTotal, 1)) * 100))}%`,
                        backgroundColor: 'var(--color-primary)',
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
