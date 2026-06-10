'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

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

  const summary = `${initial.goal_calories} kcal · ${initial.goal_protein_g}P · ${initial.goal_carbs_g}C · ${initial.goal_fat_g}F · ${initial.goal_fiber_g}Fi`

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between transition-opacity hover:opacity-70"
        aria-expanded={open}
      >
        <span className="eyebrow">Daily targets</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.5}
        />
      </button>

      {!open && <p className="num mt-3 text-[15px] text-foreground">{summary}</p>}

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
            <label key={f.key} className="flex items-center justify-between gap-4">
              <span className="text-[13px] text-muted-foreground">{f.label}</span>
              <span className="flex items-center gap-2">
                <input
                  name={f.key}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  defaultValue={initial[f.key]}
                  className="num field w-20 text-right text-[15px]"
                />
                <span className="w-8 text-[11px] text-muted-foreground">{f.unit}</span>
              </span>
            </label>
          ))}
          <div className="mt-2 flex gap-2">
            <button type="submit" disabled={saving} className="h-7 rounded-full bg-primary px-3 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-70 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-7 rounded-full px-3 text-[11px] font-medium text-muted-foreground transition-opacity hover:opacity-70"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
