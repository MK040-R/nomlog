import Link from 'next/link'

interface LegalPageProps {
  title: string
  updated: string
  children: React.ReactNode
}

// Shared shell for the public Privacy / Terms pages. These are reachable
// without signing in (see PUBLIC_PATHS in lib/supabase/middleware.ts).
export function LegalPage({ title, updated, children }: LegalPageProps) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 text-foreground">
      <Link href="/welcome" className="sticker mb-8 inline-flex">
        ← NomLog
      </Link>
      <h1 className="font-display text-4xl font-black">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
      <div className="divider my-6" />
      <div className="space-y-6 leading-relaxed [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
        {children}
      </div>
    </main>
  )
}
