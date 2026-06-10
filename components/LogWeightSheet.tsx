'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  currentWeight: number | null
  name: string
  age: string
  heightCm: string
}

export function LogWeightSheet({ currentWeight, name, age, heightCm }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [weight, setWeight] = useState(currentWeight ? String(currentWeight) : '')
  const [nm, setNm] = useState(name)
  const [ag, setAg] = useState(age)
  const [ht, setHt] = useState(heightCm)

  async function save() {
    const w = Number(weight)
    if (!w || w < 20 || w > 400) {
      setError('Enter a weight between 20 and 400 kg.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weight_kg: w,
          name: nm.trim() || null,
          age: ag.trim() ? Number(ag) : null,
          height_cm: ht.trim() ? Number(ht) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save.')
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-sm font-semibold text-primary transition active:scale-95"
      >
        <span className="text-base leading-none">+</span> Log
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[rgba(42,15,38,0.35)] backdrop-blur-sm"
          />
          <div className="relative w-full max-w-[390px] rounded-t-[28px] bg-surface-card p-6 pb-8 shadow-card">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-border-default" />
            <h2 className="font-display text-xl font-bold text-text-strong">Log today&apos;s weight</h2>

            <div className="mt-5 flex items-end gap-2">
              <input
                autoFocus
                type="number"
                inputMode="decimal"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0.0"
                className="nom-data w-full border-b-2 border-border-default bg-transparent pb-2 text-4xl font-bold text-text-strong outline-none focus:border-primary"
              />
              <span className="pb-2 text-lg text-text-muted">kg</span>
            </div>

            <button
              onClick={() => setShowDetails((s) => !s)}
              className="mt-4 text-xs font-medium text-text-muted hover:text-primary"
            >
              {showDetails ? 'Hide other details' : 'Edit name, age & height'}
            </button>

            {showDetails && (
              <div className="mt-3 flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-text-muted">Name</span>
                  <input
                    value={nm}
                    onChange={(e) => setNm(e.target.value)}
                    className="rounded-input border border-border-default bg-surface-page px-3 py-2 text-sm text-text-strong outline-none focus:border-primary"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-text-muted">Age</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={ag}
                      onChange={(e) => setAg(e.target.value)}
                      className="nom-data rounded-input border border-border-default bg-surface-page px-3 py-2 text-sm text-text-strong outline-none focus:border-primary"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-text-muted">Height (cm)</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={ht}
                      onChange={(e) => setHt(e.target.value)}
                      className="nom-data rounded-input border border-border-default bg-surface-page px-3 py-2 text-sm text-text-strong outline-none focus:border-primary"
                    />
                  </label>
                </div>
              </div>
            )}

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-button border border-border-default bg-surface-card py-3 text-sm font-semibold text-text-body transition active:scale-[0.97]"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="google-signin-btn flex-1 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
