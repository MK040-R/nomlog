'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const COOKIE = 'nomlog_tz'

// Keeps the nomlog_tz cookie in step with the browser's timezone so the
// server renders day boundaries, greetings and meal-type suggestions in the
// user's local time. Refreshes once when the zone actually changes (first
// visit, travel, DST is handled by the zone name itself).
export function TimezoneSync() {
  const router = useRouter()

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!tz) return
    const current = document.cookie
      .split('; ')
      .find((c) => c.startsWith(COOKIE + '='))
      ?.slice(COOKIE.length + 1)
    if (current !== encodeURIComponent(tz)) {
      document.cookie = `${COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=31536000; SameSite=Lax`
      router.refresh()
    }
  }, [router])

  return null
}
