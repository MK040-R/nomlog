import { verifySession } from '@/lib/dal'
import { SignOutButton } from '@/components/SignOutButton'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const user = await verifySession()

  if (!user) redirect('/login')

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8">
      <h1
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700,
          fontSize: '24px',
          color: '#1F1620',
        }}
      >
        Dashboard
      </h1>
      <p
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '14px',
          color: '#6F5A4D',
        }}
      >
        Signed in as {user.email}
      </p>
      <SignOutButton />
    </main>
  )
}
