import { verifySession } from '@/lib/dal'
import { redirect } from 'next/navigation'
import { AskCoach } from '@/components/AskCoach'

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ about?: string }>
}) {
  const user = await verifySession()
  if (!user) redirect('/login')

  const { about } = await searchParams
  const initialQuestion =
    about && /^\d{4}-\d{2}-\d{2}$/.test(about) ? `How was my day on ${about}?` : undefined

  return (
    <main className="mx-auto w-full max-w-[420px] px-6 pb-20 pt-8">
      {/* Top bar */}
      <div className="mb-10 flex items-center justify-between">
        <span className="font-display text-sm font-medium lowercase tracking-tight text-foreground">nomlog</span>
        <span className="eyebrow">Ask</span>
      </div>

      <h1 className="font-display text-[22px] font-medium leading-tight text-foreground">Ask the coach</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Answers come from your own log — today, this week, your goals.
      </p>

      <div className="mt-6">
        <AskCoach initialQuestion={initialQuestion} />
      </div>
    </main>
  )
}
