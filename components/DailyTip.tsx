'use client'

import { useEffect, useState } from 'react'
import { Sparkles, RotateCcw } from 'lucide-react'
import { fetchJson } from '@/lib/fetchJson'

// One warm sentence about today, generated once per day (server caches).
// The ↻ regenerates it (one extra call). Renders nothing while loading or
// unavailable — the dashboard must never look broken because of a tip.
export function DailyTip() {
  const [tip, setTip] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchJson<{ tip?: string }>('/api/tip')
      .then((data) => {
        if (!cancelled && data?.tip) setTip(data.tip)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function refresh() {
    setRefreshing(true)
    try {
      const data = await fetchJson<{ tip?: string }>('/api/tip?refresh=1')
      if (data?.tip) setTip(data.tip)
    } catch {
      // keep the current tip
    } finally {
      setRefreshing(false)
    }
  }

  if (!tip) return null

  return (
    <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.5} />
      <span className={refreshing ? 'opacity-50' : ''}>{tip}</span>
      <button
        onClick={refresh}
        disabled={refreshing}
        aria-label="New tip"
        className="mt-0.5 shrink-0 text-muted-foreground transition-opacity hover:opacity-70 disabled:opacity-40"
      >
        <RotateCcw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
      </button>
    </p>
  )
}
