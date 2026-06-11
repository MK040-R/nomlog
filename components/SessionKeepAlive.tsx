'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// When the PWA wakes from background, proactively refresh the auth session
// so API calls don't hit a stale token (belt-and-braces with the 401 reload
// in fetchJson). getSession() refreshes an expired token and rewrites the
// cookies via @supabase/ssr.
export function SessionKeepAlive() {
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        createClient().auth.getSession()
      }
    }
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])

  return null
}
