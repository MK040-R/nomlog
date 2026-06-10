import Link from 'next/link'

export default function AuthCodeErrorPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-display text-xl font-medium text-foreground">Sign-in failed</h1>
        <p className="text-[13px] text-muted-foreground">Something went wrong during Google sign-in.</p>
        <Link href="/login" className="mt-2 text-[13px] font-medium text-primary transition-opacity hover:opacity-70">
          Try again
        </Link>
      </div>
    </main>
  )
}
