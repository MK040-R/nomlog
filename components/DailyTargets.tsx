'use client'

import { useState } from 'react'

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
        className="flex w-full items-center justify-between"
        aria-expanded={open}
      >
        <span className="nom-eyebrow text-text-muted">Daily targets</span>
        <span className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>

      {!open && <p className="nom-data mt-3 text-base text-text-body">{summary}</p>}

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
              <span className="text-sm font-medium text-text-body">{f.label}</span>
              <span className="flex items-center gap-2">
                <input
                  name={f.key}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  defaultValue={initial[f.key]}
                  className="nom-data w-24 rounded-input border border-border-default bg-surface-page px-3 py-2 text-right text-sm text-text-strong outline-none focus:border-primary"
                />
                <span className="w-8 text-xs text-text-muted">{f.unit}</span>
              </span>
            </label>
          ))}
          <button type="submit" disabled={saving} className="google-signin-btn mt-1 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save targets'}
          </button>
        </form>
      )}
    </div>
  )
}
