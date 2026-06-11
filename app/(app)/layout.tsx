import { verifySession } from '@/lib/dal'
import { redirect } from 'next/navigation'
import { BottomNav } from '@/components/BottomNav'
import { TimezoneSync } from '@/components/TimezoneSync'
import { OnlineBanner } from '@/components/OnlineBanner'
import { SessionKeepAlive } from '@/components/SessionKeepAlive'
import { PullToRefresh } from '@/components/PullToRefresh'

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
      <TimezoneSync />
      <SessionKeepAlive />
      <OnlineBanner />
      <PullToRefresh />
      {children}
      <BottomNav />
    </div>
  )
}
