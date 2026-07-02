import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Provider } from '@supabase/supabase-js'

// Initiates OAuth for the chosen provider (google by default, apple if requested).
// Apple requires Apple to be configured as a Supabase provider; until then it
// errors back to the sign-in screen, which shows the inline "try again" state.
export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null)
  const requested = formData?.get('provider')
  const provider: Provider = requested === 'apple' ? 'apple' : 'google'

  const supabase = await createClient()

  // Prefer the configured site URL; fall back to the origin the request
  // actually arrived on so sign-in works on localhost, previews, and prod
  // without depending on the env var being set at build time.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
    },
  })

  if (error || !data.url) {
    redirect('/login?error=1')
  }

  redirect(data.url)
}
