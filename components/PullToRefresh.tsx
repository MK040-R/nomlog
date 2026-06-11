'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'

const THRESHOLD = 80

// Standalone PWAs don't get Safari's pull-to-refresh — provide our own:
// pull down from the top of the page to re-fetch server data.
export function PullToRefresh() {
  const router = useRouter()
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)

  useEffect(() => {
    // Only needed when running as a home-screen app
    if (!window.matchMedia('(display-mode: standalone)').matches) return

    const onStart = (e: TouchEvent) => {
      if (window.scrollY <= 0) startY.current = e.touches[0].clientY
    }
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      if (dy > 0 && window.scrollY <= 0) setPull(Math.min(dy / 2, THRESHOLD + 20))
    }
    const onEnd = () => {
      if (startY.current === null) return
      setPull((p) => {
        if (p >= THRESHOLD) {
          setRefreshing(true)
          router.refresh()
          setTimeout(() => {
            setRefreshing(false)
          }, 800)
        }
        return 0
      })
      startY.current = null
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [router])

  if (pull === 0 && !refreshing) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center"
      style={{ top: `calc(env(safe-area-inset-top) + ${refreshing ? 12 : Math.max(0, pull - 40)}px)` }}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card shadow-sm">
        <RotateCcw
          className={`h-3.5 w-3.5 text-primary ${refreshing ? 'animate-spin' : ''}`}
          strokeWidth={1.5}
          style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)` }}
        />
      </span>
    </div>
  )
}
