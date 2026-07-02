import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

/**
 * Verify the current user's session. Returns the User object or null.
 * Use this in every Server Component and Route Handler that needs auth.
 * Never call supabase.auth.getUser() directly — always go through verifySession().
 *
 * Two auth paths are supported:
 * - Web: the session lives in cookies (the SSR default).
 * - Native (iOS app): the Supabase access token arrives in the
 *   `Authorization: Bearer <token>` header. We validate it directly, and
 *   createClient() forwards the same header so RLS data queries run as the user.
 */
export const verifySession = cache(async () => {
  const supabase = await createClient()

  const authHeader = (await headers()).get('Authorization')
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return user
})

// Alias for readability in Server Components
export const getCurrentUser = verifySession
