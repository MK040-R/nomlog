'use client'

import { useState } from 'react'

type Initial = {
  name: string
  age: string
  weight_kg: string
  height_cm: string
  goal_calories: string
  goal_protein_g: string
  goal_carbs_g: string
  goal_fat_g: string
  goal_fiber_g: string
}

const GOAL_FIELDS = [
  { key: 'goal_calories', label: 'Daily calories', unit: 'kcal' },
  { key: 'goal_protein_g', label: 'Protein', unit: 'g' },
  { key: 'goal_carbs_g', label: 'Carbs', unit: 'g' },
  { key: 'goal_fat_g', label: 'Fat', unit: 'g' },
  { key: 'goal_fiber_g', label: 'Fiber', unit: 'g' },
] as const

function bmiInfo(weightKg: number, heightCm: number) {
  if (!weightKg || !heightCm) return null
  const m = heightCm / 100
  const bmi = weightKg / (m * m)
  if (!Number.isFinite(bmi) || bmi <= 0) return null
  let label = 'Normal'
  let color = 'var(--color-success)'
  if (bmi < 18.5) {
    label = 'Underweight'
    color = 'var(--color-info, #6E2F5C)'
  } else if (bmi < 25) {
    label = 'Normal'
    color = 'var(--color-success)'
  } else if (bmi < 30) {
    label = 'Overweight'
    color = 'var(--color-warning, #C98300)'
  } else {
    label = 'Obese'
    color = 'var(--color-danger)'
  }
  return { bmi: Math.round(bmi * 10) / 10, label, color }
}

export function ProfileForm({
  initial,
  action,
}: {
  initial: Initial
  action: (formData: FormData) => Promise<void>
}) {
  const [weight, setWeight] = useState(initial.weight_kg)
  const [height, setHeight] = useState(initial.height_cm)
  const [saving, setSaving] = useState(false)

  const bmi = bmiInfo(Number(weight), Number(height))

  return (
    <form
      action={async (fd) => {
        setSaving(true)
        try {
          await action(fd)
        } finally {
          setSaving(false)
        }
      }}
      className="flex flex-col gap-5"
    >
      {/* About you */}
      <section className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface-card p-5 shadow-card">
        <span className="nom-eyebrow text-text-muted">About you</span>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text-body">Name</span>
          <input
            name="name"
            type="text"
            defaultValue={initial.name}
            placeholder="What should I call you?"
            className="rounded-input border border-border-default bg-surface-page px-3 py-2 text-sm text-text-strong outline-none placeholder:text-text-subtle focus:border-primary"
          />
        </label>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text-body">Age</span>
            <input
              name="age"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={initial.age}
              className="nom-data rounded-input border border-border-default bg-surface-page px-3 py-2 text-sm text-text-strong outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text-body">Weight</span>
            <div className="flex items-center gap-1">
              <input
                name="weight_kg"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="nom-data w-full rounded-input border border-border-default bg-surface-page px-3 py-2 text-sm text-text-strong outline-none focus:border-primary"
              />
              <span className="text-xs text-text-muted">kg</span>
            </div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text-body">Height</span>
            <div className="flex items-center gap-1">
              <input
                name="height_cm"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="nom-data w-full rounded-input border border-border-default bg-surface-page px-3 py-2 text-sm text-text-strong outline-none focus:border-primary"
              />
              <span className="text-xs text-text-muted">cm</span>
            </div>
          </label>
        </div>

        {/* Live BMI */}
        {bmi ? (
          <div className="mt-1 flex items-center justify-between rounded-input bg-surface-sunken px-4 py-3">
            <span className="text-sm font-medium text-text-body">Your BMI</span>
            <span className="flex items-baseline gap-2">
              <span className="nom-data text-xl font-bold" style={{ color: bmi.color }}>{bmi.bmi}</span>
              <span className="text-xs font-semibold" style={{ color: bmi.color }}>{bmi.label}</span>
            </span>
          </div>
        ) : (
          <p className="text-xs text-text-muted">Add your weight and height to see your BMI.</p>
        )}
      </section>

      {/* Goals */}
      <section className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface-card p-5 shadow-card">
        <span className="nom-eyebrow text-text-muted">Daily goals</span>
        {GOAL_FIELDS.map((f) => (
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
      </section>

      <button type="submit" disabled={saving} className="google-signin-btn disabled:opacity-60">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
