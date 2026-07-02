import { redirect } from 'next/navigation'

// Root route is a doorway: logged-in users are sent to the dashboard by the
// proxy middleware; everyone else starts at the onboarding flow, which ends at
// sign-in (and skips straight there for returning visitors).
export default function Home() {
  redirect('/welcome')
}
