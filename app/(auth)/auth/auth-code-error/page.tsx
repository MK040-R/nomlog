import Link from 'next/link'

export default function AuthCodeErrorPage() {
  return (
    <main
      className="flex min-h-dvh items-center justify-center px-4"
      style={{ backgroundColor: '#FFFBF5' }}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '20px',
            color: '#1F1620',
          }}
        >
          Sign-in failed
        </h1>
        <p
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '14px',
            color: '#6F5A4D',
          }}
        >
          Something went wrong during Google sign-in.
        </p>
        <Link
          href="/login"
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '14px',
            color: '#FF4E33',
            textDecoration: 'underline',
          }}
        >
          Try again
        </Link>
      </div>
    </main>
  )
}
