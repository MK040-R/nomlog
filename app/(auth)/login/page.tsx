import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Already logged in — send to the app
  if (user) redirect('/dashboard')

  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center px-4"
      style={{ backgroundColor: '#FFFBF5' }}
    >
      <div className="flex w-full max-w-xs flex-col items-center gap-10">
        {/* Wordmark + tagline */}
        <div className="flex flex-col items-center gap-3">
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: '34px',
              letterSpacing: '-1.5px',
              color: '#1F1620',
              lineHeight: 1,
            }}
          >
            Nomlog
          </h1>
          <p
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '16px',
              color: '#6F5A4D',
              maxWidth: '240px',
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            Know what you ate. See how it adds up.
          </p>
        </div>

        {/* Google OAuth button */}
        <form action="/auth/sign-in" method="POST" className="w-full">
          <button
            type="submit"
            className="google-signin-btn w-full"
          >
            {/* White Google G logo */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              width="20"
              height="20"
              aria-hidden="true"
            >
              <path
                fill="#FFFFFF"
                d="M19.6 10.23c0-.68-.06-1.36-.17-2H10v3.79h5.39a4.61 4.61 0 0 1-2 3.02v2.52h3.24c1.89-1.74 2.97-4.3 2.97-7.33Z"
              />
              <path
                fill="#FFFFFF"
                d="M10 20c2.7 0 4.96-.9 6.61-2.44l-3.24-2.52c-.9.6-2.04.96-3.37.96-2.59 0-4.78-1.75-5.56-4.1H1.09v2.6A10 10 0 0 0 10 20Z"
              />
              <path
                fill="#FFFFFF"
                d="M4.44 11.9A6.04 6.04 0 0 1 4.13 10c0-.66.11-1.3.31-1.9V5.5H1.09A10.01 10.01 0 0 0 0 10c0 1.61.39 3.14 1.09 4.5l3.35-2.6Z"
              />
              <path
                fill="#FFFFFF"
                d="M10 3.96c1.46 0 2.77.5 3.8 1.49l2.85-2.85C14.95.99 12.7 0 10 0A10 10 0 0 0 1.09 5.5l3.35 2.6C5.22 5.71 7.41 3.96 10 3.96Z"
              />
            </svg>
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  )
}
