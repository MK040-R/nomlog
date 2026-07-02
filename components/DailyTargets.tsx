'use client'

import { useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { macrosForCalories } from '@/lib/nutrition'

type Targets = {
  goal_calories: string
  goal_protein_g: string
  goal_carbs_g: string
  goal_fat_g: string
  goal_fiber_g: string
}

const FIELDS = [
  { key: 'goal_calories', label: 'Calories', unit: 'kcal' },
  { key: 'goal_protein_g', label: 'Protein', unit: 'g' },
  { key: 'goal_carbs_g', label: 'Carbs', unit: 'g' },
  { key: 'goal_fat_g', label: 'Fat', unit: 'g' },
  { key: 'goal_fiber_g', label: 'Fiber', unit: 'g' },
] as const

export function DailyTargets({
  initial,
  action,
}: {
  initial: Targets
  action: (formData: FormData) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState<Targets>(initial)
  const [autoFilled, setAutoFilled] = useState(false)

  // Macros follow calories: editing the calorie goal re-derives the four
  // macros on a standard split. Editing a macro directly just sets it.
  function update(key: keyof Targets, raw: string) {
    if (key === 'goal_calories') {
      const cal = Number(raw)
      if (Number.isFinite(cal) && cal >= 500) {
        const m = macrosForCalories(cal)
        setValues({
          goal_calories: raw,
          goal_protein_g: String(m.protein),
          goal_carbs_g: String(m.carbs),
          goal_fat_g: String(m.fat),
          goal_fiber_g: String(m.fiber),
        })
        setAutoFilled(true)
        return
      }
    }
    setValues((v) => ({ ...v, [key]: raw }))
    if (key !== 'goal_calories') setAutoFilled(false)
  }

  const summary = `${initial.goal_calories} kcal · ${initial.goal_protein_g}P · ${initial.goal_carbs_g}C · ${initial.goal_fat_g}F · ${initial.goal_fiber_g}Fi`

  return (
    <div>
      <button
        onClick={() => {
          if (!open) {
            setValues(initial)
            setAutoFilled(false)
          }
          setOpen((o) => !o)
        }}
        className="flex w-full items-center justify-between transition-opacity hover:opacity-70"
        aria-expanded={open}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink/70">Daily targets</span>
        <ChevronDown
          className={`h-4 w-4 text-ink transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2.4}
        />
      </button>

      {!open && <p className="num mt-2 text-[14px] font-bold text-ink">{summary}</p>}

      {open && (
        <form
          action={async (fd) => {
            setSaving(true)
            try {
              await action(fd)
              setOpen(false)
            } finally {
              setSaving(false)
            }
          }}
          className="mt-4 flex flex-col gap-3"
        >
          {FIELDS.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-4 rounded-xl border-2 border-ink bg-white px-3 py-2">
              <span className="text-[12px] font-bold text-ink">{f.label}</span>
              <span className="flex items-center gap-2">
                <input
                  name={f.key}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={values[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  className="num w-20 bg-transparent text-right font-display text-[16px] font-black text-ink outline-none"
                />
                <span className="w-8 text-[11px] font-semibold text-ink/55">{f.unit}</span>
              </span>
            </label>
          ))}
          {autoFilled && (
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink/70">
              <Sparkles className="h-3 w-3" strokeWidth={2.6} />
              Macros re-balanced for {values.goal_calories} kcal — tweak any of them if you like.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="h-8 rounded-full border-2 border-ink bg-tomato px-4 text-[11px] font-bold text-white shadow-[2px_2px_0_0_var(--color-ink)] transition-transform active:translate-x-px active:translate-y-px disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 rounded-full border-2 border-ink bg-white px-4 text-[11px] font-bold text-ink transition-transform active:translate-x-px active:translate-y-px"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
