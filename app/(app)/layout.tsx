import { verifySession } from '@/lib/dal'
import { redirect } from 'next/navigation'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await verifySession()

  if (!user) {
    redirect('/login')
  }

  return <>{children}</>
}
