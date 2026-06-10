import { redirect } from 'next/navigation'

// Root route is just a doorway: logged-in users go to the dashboard,
// everyone else goes to login. The proxy middleware handles the logged-in case;
// this covers the logged-out case.
export default function Home() {
  redirect('/login')
}
