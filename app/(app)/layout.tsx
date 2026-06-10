import { verifySession } from '@/lib/dal'
import { redirect } from 'next/navigation'
import { BottomNav } from '@/components/BottomNav'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await verifySession()

  if (!user) {
    redirect('/login')
  }

  return (
    <div
      className="min-h-dvh bg-background"
      style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
    >
      {children}
      <BottomNav />
    </div>
  )
}
