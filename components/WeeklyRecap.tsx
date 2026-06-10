'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

// The week in one warm paragraph, generated once per IST week (server caches).
// Renders nothing while loading or when unavailable.
export function WeeklyRecap() {
  const [recap, setRecap] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/recap')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.recap) setRecap(data.recap)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!recap) return null

  return (
    <p className="mt-4 flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.5} />
      <span>{recap}</span>
    </p>
  )
}
