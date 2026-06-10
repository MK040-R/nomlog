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
    <div className="min-h-dvh bg-surface-page pb-20">
      {children}
      <BottomNav />
    </div>
  )
}
