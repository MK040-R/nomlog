import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingFlow } from '@/components/OnboardingFlow'

// Pre-auth onboarding (splash → value → nudge → start → sign-in).
// Logged-in visitors never see it; they go straight to the dashboard.
export default async function WelcomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return <OnboardingFlow />
}
