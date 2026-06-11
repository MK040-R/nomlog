'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, X } from 'lucide-react'
import { fetchJson } from '@/lib/fetchJson'

type Entry = { logged_on: string; weight_kg: number }

// Recent weight entries with delete — fixing a wrong entry is re-logging
// that date from the sheet (one row per day, upsert).
export function WeightHistory({ entries }: { entries: Entry[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (entries.length === 0) return null

  async function remove(logged_on: string) {
    setBusy(logged_on)
    setError(null)
    try {
      await fetchJson('/api/weight', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logged_on }),
      })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-opacity hover:opacity-70"
      >
        History
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={1.5} />
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-1.5">
          {entries.map((e) => (
            <div key={e.logged_on} className="flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground">
                {new Date(e.logged_on + 'T00:00:00Z').toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'UTC',
                })}
              </span>
              <span className="flex items-center gap-3">
                <span className="num text-foreground">{Number(e.weight_kg).toFixed(1)} kg</span>
                <button
                  onClick={() => remove(e.logged_on)}
                  disabled={busy !== null}
                  aria-label={`Delete weight for ${e.logged_on}`}
                  className="text-muted-foreground transition-opacity hover:opacity-70 disabled:opacity-40"
                >
                  <X className="h-3 w-3" strokeWidth={1.5} />
                </button>
              </span>
            </div>
          ))}
          {error && <p className="text-[12px] text-destructive">{error}</p>}
        </div>
      )}
    </div>
  )
}
