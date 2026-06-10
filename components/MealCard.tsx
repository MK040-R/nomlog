'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X } from 'lucide-react'
import type { FoodItem, MealType } from '@/types/app.types'

const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: '🍳',
  lunch: '🍛',
  dinner: '🌙',
  snack: '🍌',
}
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

const BLANK: FoodItem = {
  name: 'New item',
  portion: '1 serving',
  calories_kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  fiber_g: 0,
}

type Meal = {
  id: string
  meal_type: MealType
  total_calories: number
  food_items: FoodItem[]
}

export function MealCard({ meal }: { meal: Meal }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [mealType, setMealType] = useState<MealType>(meal.meal_type)
  const [items, setItems] = useState<FoodItem[]>(meal.food_items ?? [])

  function startEdit() {
    setMealType(meal.meal_type)
    setItems(meal.food_items ?? [])
    setError(null)
    setEditing(true)
  }

  function updateItem(i: number, field: keyof FoodItem, value: string) {
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== i) return it
        if (field === 'name' || field === 'portion') return { ...it, [field]: value }
        return { ...it, [field]: Number(value) || 0 }
      })
    )
  }

  async function save() {
    if (items.length === 0) {
      setError('Add at least one item, or delete the meal.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/meals/${meal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal_type: mealType, items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not update.')
      setEditing(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Could not update.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      const res = await fetch(`/api/meals/${meal.id}`, { method: 'DELETE' })
      if (res.ok) router.refresh()
      else setBusy(false)
    } catch {
      setBusy(false)
    }
  }

  const total = items.reduce((a, it) => a + (it.calories_kcal || 0), 0)

  // ---- Edit mode ----
  if (editing) {
    return (
      <div>
        <select
          value={mealType}
          onChange={(e) => setMealType(e.target.value as MealType)}
          className="field w-auto pr-6 text-[13px] font-medium capitalize"
        >
          {MEAL_TYPES.map((m) => (
            <option key={m} value={m} className="capitalize">{m}</option>
          ))}
        </select>

        <div className="mt-3 flex flex-col">
          {items.map((it, i) => (
            <div key={i} className={i > 0 ? 'mt-3 border-t border-border/60 pt-3' : ''}>
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={it.name}
                  onChange={(e) => updateItem(i, 'name', e.target.value)}
                  className="flex-1 bg-transparent font-display text-[15px] font-medium text-foreground outline-none"
                />
                <button
                  onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-muted-foreground transition-opacity hover:opacity-70"
                  aria-label="Remove item"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
              <input
                value={it.portion}
                onChange={(e) => updateItem(i, 'portion', e.target.value)}
                className="mb-3 w-full bg-transparent text-[13px] text-muted-foreground outline-none"
              />
              <div className="grid grid-cols-5 gap-3">
                {([
                  ['calories_kcal', 'kcal'],
                  ['protein_g', 'P'],
                  ['carbs_g', 'C'],
                  ['fat_g', 'F'],
                  ['fiber_g', 'Fi'],
                ] as [keyof FoodItem, string][]).map(([field, label]) => (
                  <label key={field} className="flex flex-col">
                    <span className="eyebrow mb-1 text-[9px]">{label}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={it[field] as number}
                      onChange={(e) => updateItem(i, field, e.target.value)}
                      className="num field text-[14px]"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setItems((prev) => [...prev, { ...BLANK }])}
          className="mt-3 text-[11px] font-medium text-muted-foreground transition-opacity hover:opacity-70"
        >
          + add an item by hand
        </button>

        <div className="mt-4 flex items-baseline justify-between">
          <span className="eyebrow">Total</span>
          <span className="num text-[18px] font-medium text-foreground">{Math.round(total)} kcal</span>
        </div>

        {error && <p className="mt-2 text-[13px] text-destructive">{error}</p>}

        <div className="mt-4 flex gap-3">
          <button onClick={() => setEditing(false)} disabled={busy} className="btn-ghost h-9 flex-1 text-[13px]">
            Cancel
          </button>
          <button onClick={save} disabled={busy} className="btn-primary h-9 flex-1 text-[13px]">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  // ---- View mode ----
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-medium capitalize text-foreground">
          <span>{MEAL_EMOJI[meal.meal_type]}</span> {meal.meal_type}
        </span>
        <div className="flex items-center gap-3">
          <span className="num text-[13px] text-foreground">{meal.total_calories} kcal</span>
          <button
            onClick={startEdit}
            disabled={busy}
            className="text-muted-foreground transition-opacity hover:opacity-70"
            aria-label="Edit meal"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className="text-muted-foreground transition-opacity hover:opacity-70 disabled:opacity-40"
            aria-label="Delete meal"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
      <ul className="flex flex-col gap-0.5">
        {(meal.food_items ?? []).map((f, i) => (
          <li key={i} className="flex justify-between text-[13px] text-muted-foreground">
            <span>{f.name} · {f.portion}</span>
            <span className="num">{Math.round(f.calories_kcal)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
