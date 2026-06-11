'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

// Fixed banner while the device is offline — saves fail fast with a clear
// reason instead of cryptic fetch errors.
export function OnlineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    setOffline(!navigator.onLine)
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 py-2 text-[12px] font-medium"
      style={{
        backgroundColor: 'var(--color-warning)',
        color: 'var(--color-primary-foreground)',
        paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
      }}
    >
      <WifiOff className="h-3.5 w-3.5" strokeWidth={2} /> You&apos;re offline — changes won&apos;t save
    </div>
  )
}
