'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus, Droplet } from 'lucide-react'
import { fetchJson } from '@/lib/fetchJson'

const GOAL = 8

// Tap-counter for glasses of water, one row per day. Optimistic with a
// debounced save so rapid +/+/+ taps cost one request.
export function WaterTracker({ initial, date }: { initial: number; date: string }) {
  const router = useRouter()
  const [glasses, setGlasses] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function set(next: number) {
    const clamped = Math.max(0, Math.min(30, next))
    setGlasses(clamped)
    setError(null)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        await fetchJson('/api/water', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ glasses: clamped, date }),
        })
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save water.')
      }
    }, 600)
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Droplet
          className="h-4 w-4"
          strokeWidth={1.5}
          style={{ color: glasses > 0 ? 'var(--color-primary)' : 'var(--color-muted-foreground)' }}
          fill={glasses >= GOAL ? 'var(--color-primary)' : 'none'}
        />
        <span className="num text-[15px] text-foreground">
          {glasses}
          <span className="text-[12px] text-muted-foreground"> / {GOAL} glasses</span>
        </span>
        {error && <span className="text-[11px] text-destructive">{error}</span>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => set(glasses - 1)}
          disabled={glasses === 0}
          aria-label="One less glass"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground transition-opacity hover:opacity-70 disabled:opacity-30"
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <button
          onClick={() => set(glasses + 1)}
          aria-label="One more glass"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-foreground transition-opacity hover:opacity-70"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
