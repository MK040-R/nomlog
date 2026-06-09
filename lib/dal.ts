import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Verify the current user's session. Returns the User object or null.
 * Use this in every Server Component and Route Handler that needs auth.
 * Never call supabase.auth.getUser() directly — always go through verifySession().
 */
export const verifySession = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return user
})

// Alias for readability in Server Components
export const getCurrentUser = verifySession
