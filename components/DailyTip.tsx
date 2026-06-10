'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

// One warm sentence about today, generated once per day (server caches it).
// Renders nothing while loading or if unavailable — the dashboard must never
// look broken because a tip didn't arrive.
export function DailyTip() {
  const [tip, setTip] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/tip')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.tip) setTip(data.tip)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!tip) return null

  return (
    <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.5} />
      <span>{tip}</span>
    </p>
  )
}
