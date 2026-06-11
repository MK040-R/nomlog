'use client'

import { useState } from 'react'
import { fetchJson } from '@/lib/fetchJson'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

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
      await fetchJson('/api/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weight_kg: w,
          name: nm.trim() || null,
          age: ag.trim() ? Number(ag) : null,
          height_cm: ht.trim() ? Number(ht) : null,
        }),
      })
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
        className="flex items-center gap-1 text-[11px] font-medium text-primary transition-opacity hover:opacity-70"
      >
        <Plus className="h-3 w-3" strokeWidth={2.5} /> Log
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[oklch(0.24_0.025_40_/_0.35)] backdrop-blur-sm"
          />
          <div className="relative w-full max-w-[420px] rounded-t-3xl bg-card px-6 pb-8 pt-5">
            <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-border" />
            <span className="eyebrow">Log today&apos;s weight</span>

            <div className="mt-4 flex items-end gap-2">
              <input
                autoFocus
                type="number"
                inputMode="decimal"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0.0"
                className="num field flex-1 text-[38px] font-medium text-foreground"
              />
              <span className="pb-2 text-[15px] text-muted-foreground">kg</span>
            </div>

            <button
              onClick={() => setShowDetails((s) => !s)}
              className="mt-4 text-[11px] font-medium text-muted-foreground transition-opacity hover:opacity-70"
            >
              {showDetails ? 'Hide other details' : 'Edit name, age & height'}
            </button>

            {showDetails && (
              <div className="mt-4 flex flex-col gap-4">
                <label className="flex items-center justify-between gap-4">
                  <span className="text-[13px] text-muted-foreground">Name</span>
                  <input value={nm} onChange={(e) => setNm(e.target.value)} className="field w-40 text-right" />
                </label>
                <label className="flex items-center justify-between gap-4">
                  <span className="text-[13px] text-muted-foreground">Age</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={ag}
                    onChange={(e) => setAg(e.target.value)}
                    className="num field w-20 text-right text-[15px]"
                  />
                </label>
                <label className="flex items-center justify-between gap-4">
                  <span className="text-[13px] text-muted-foreground">Height (cm)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={ht}
                    onChange={(e) => setHt(e.target.value)}
                    className="num field w-20 text-right text-[15px]"
                  />
                </label>
              </div>
            )}

            {error && <p className="mt-3 text-[13px] text-destructive">{error}</p>}

            <div className="mt-6 flex gap-3">
              <button onClick={() => setOpen(false)} className="btn-ghost flex-1">
                Cancel
              </button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
