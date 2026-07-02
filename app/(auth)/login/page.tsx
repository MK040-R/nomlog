import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  const { error } = await searchParams

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col bg-background px-6 pb-10"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
    >
      <div className="flex flex-1 flex-col justify-center">
        <Image src="/brand/logo-mascot.png" alt="" width={80} height={80} priority className="mb-8 h-20 w-20 object-contain" />
        <h1 className="font-display text-[40px] font-black leading-[1.05] tracking-tight text-foreground">Welcome.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">Sign in to keep your logs synced.</p>

        {error && (
          <p className="mt-5 inline-flex w-fit items-center rounded-full border-[2px] border-destructive px-3 py-1.5 text-[13px] font-medium text-destructive">
            Sign-in cancelled. Try again.
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3">
          {/* Apple */}
          <form action="/auth/sign-in" method="POST">
            <input type="hidden" name="provider" value="apple" />
            <button type="submit" className="auth-btn auth-btn--ink">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M11.18 8.51c.02 2.2 1.93 2.93 1.95 2.94-.02.05-.31 1.05-1.02 2.08-.61.9-1.25 1.79-2.26 1.81-.99.02-1.31-.59-2.44-.59-1.13 0-1.48.57-2.42.6-.97.04-1.71-.97-2.33-1.86C1.4 11.66.42 8.34 1.71 6.1c.64-1.11 1.79-1.81 3.03-1.83.95-.02 1.85.64 2.44.64.58 0 1.68-.79 2.83-.68.48.02 1.84.2 2.71 1.46-.07.04-1.62.94-1.6 2.82M9.36 3.06C9.88 2.43 10.23 1.55 10.13.66 9.38.69 8.47 1.16 7.93 1.79c-.48.56-.9 1.46-.79 2.32.84.06 1.7-.42 2.22-1.05" />
              </svg>
              Continue with Apple
            </button>
          </form>

          {/* Google */}
          <form action="/auth/sign-in" method="POST">
            <input type="hidden" name="provider" value="google" />
            <button type="submit" className="auth-btn auth-btn--white">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
                <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33Z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
              </svg>
              Continue with Google
            </button>
          </form>
        </div>

        <p className="mt-6 text-[12px] text-muted-foreground">By continuing you accept Terms &amp; Privacy.</p>
      </div>
    </main>
  )
}
