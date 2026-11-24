import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// How close to expiry (in seconds) the access token can get before middleware
// refreshes it. Server Components can't write cookies, so middleware is the
// only place a refreshed token can be persisted back to the browser.
const REFRESH_MARGIN_S = 5 * 60

const PUBLIC_PATHS = ['/privacy', '/terms']

// @supabase/ssr names the session cookie `sb-<project-ref>-auth-token`, where
// the ref is the first label of the project hostname. Match ONLY the current
// project's cookie: a leftover cookie from a previous Supabase project would
// otherwise look like a live session here, while the server (which can't read
// it) sends the user back to /login, which bounces to /dashboard — a redirect
// loop.
const AUTH_COOKIE_RE = new RegExp(
  `^sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]}-auth-token(\\.\\d+)?$`
)

/**
 * Read the access token's expiry from the Supabase auth cookie without a
 * network call. Returns null when there is no session cookie or it can't be
 * parsed. Used ONLY to decide routing and whether a refresh is due — real
 * verification happens in verifySession() on every page and API route.
 */
function sessionExpiresAt(request: NextRequest): number | null {
  const chunks = request.cookies
    .getAll()
    .filter((c) => AUTH_COOKIE_RE.test(c.name))
  if (chunks.length === 0) return null

  const value = chunks
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
    .map((c) => c.value)
    .join('')
  try {
    let raw: string
    if (value.startsWith('base64-')) {
      const b64 = value.slice(7).replace(/-/g, '+').replace(/_/g, '/')
      raw = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='))
    } else {
      raw = decodeURIComponent(value)
    }
    const parsed = JSON.parse(raw) as { expires_at?: number }
    return typeof parsed.expires_at === 'number' ? parsed.expires_at : null
  } catch {
    return null
  }
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Native clients (the iOS app) authenticate per-request with a Supabase
  // access token in the Authorization header instead of cookies. Let those
  // requests straight through — the route handler validates the token via
  // verifySession(). Without this, the cookie-only getUser() below sees no
  // user and short-circuits /api/* calls with a 401 before they're handled.
  if (request.headers.get('Authorization')?.toLowerCase().startsWith('bearer ')) {
    return NextResponse.next({ request })
  }

  // Public legal pages must load for everyone, signed in or not — Google's
  // OAuth consent screen links to them and reviewers aren't logged in.
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next({ request })
  }

  // Route handlers already validate sessions and can return API-specific
  // errors. Skipping middleware auth here avoids a duplicate Supabase
  // auth.getUser() round trip for every app fetch.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next({ request })
  }

  // Start with a passthrough response
  let supabaseResponse = NextResponse.next({ request })

  const isAuthPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/welcome') ||
    pathname === '/'

  // Fast path: the access token is present and not close to expiry, so no
  // refresh is due. Route on cookie presence alone and skip the Supabase
  // auth round trip — verifySession() in the page/route is the real check,
  // so a forged cookie only buys a render that immediately redirects.
  const expiresAt = sessionExpiresAt(request)
  const nowS = Math.floor(Date.now() / 1000)
  if (expiresAt !== null && expiresAt - nowS > REFRESH_MARGIN_S) {
    if (isAuthPath && pathname !== '/auth/callback') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // No session cookie at all: nothing to refresh, redirect protected pages.
  if (expiresAt === null) {
    if (!isAuthPath) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Step 1: Write to request so the current request sees the refreshed token
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Step 2: Recreate response with the updated request (carries refreshed cookies)
          supabaseResponse = NextResponse.next({ request })
          // Step 3: Write to response so the browser receives the new token via Set-Cookie
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Token expired or expiring soon — getUser() verifies AND refreshes it, and
  // the cookie plumbing above persists the new token to the browser.
  // ALWAYS getUser() — never getSession(). getSession() reads unverified cookies and can be spoofed.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!isAuthPath && !user) {
    // API calls must get a JSON 401, never a redirect — otherwise fetch()
    // follows the redirect, receives the login page's HTML, and res.json()
    // blows up with Safari's cryptic "string did not match" error.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Session expired.' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (isAuthPath && user && pathname !== '/auth/callback') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
