import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  // Native (iOS) requests carry the user's Supabase access token in the
  // Authorization header rather than cookies. Forwarding it as the client's
  // global Authorization header makes PostgREST/RLS queries run as that user.
  const authHeader = (await headers()).get('Authorization')
  const bearer = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader : undefined

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(bearer ? { global: { headers: { Authorization: bearer } } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Server Components cannot write cookies; middleware handles token refresh.
          }
        },
      },
    }
  )
}
