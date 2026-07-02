'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

// The week in one warm paragraph, generated once per local week (server caches).
// Renders nothing while loading or when unavailable.
export function WeeklyRecap() {
  const [recap, setRecap] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/recap')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.recap) setRecap(data.recap)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Quiet shimmer while the recap loads so it doesn't pop in; still renders
  // nothing when no recap is available.
  if (loading && !recap) {
    return (
      <p className="mt-4 flex items-start gap-2">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.5} />
        <span className="mt-1 h-3 w-56 animate-pulse rounded-full bg-muted" />
      </p>
    )
  }
  if (!recap) return null

  return (
    <div className="chunk animate-pop mt-4 !bg-mustard p-3">
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink/70">
        <Sparkles className="h-3 w-3" strokeWidth={2.6} /> Recap
      </span>
      <p className="mt-0.5 text-[13px] font-bold leading-snug text-ink">{recap}</p>
    </div>
  )
}
