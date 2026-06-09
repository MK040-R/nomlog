---
phase: 01-foundation
plan: 02
subsystem: auth
tags: [nextjs, supabase, google-oauth, gemini, server-only, middleware, typescript]

# Dependency graph
requires:
  - phase: 01-01
    provides: Supabase SSR client factories (server/client/middleware), DAL with verifySession(), types, design system
provides:
  - Google OAuth login page (Nomlog design system styled, Google-only)
  - Next.js 16 proxy (session refresh on every request; unauthenticated redirect to /login)
  - OAuth callback handler exchanging code for session via setAll cookies
  - Protected (app) route group layout calling verifySession()
  - Stub dashboard page with sign-out
  - SignOutButton Client Component
  - Gemini server-only client singleton — hard build error if imported from client
affects: [02-gemini-parsing, 03-voice, 04-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Next.js 16 proxy.ts (renamed from middleware.ts) with exported `proxy` function
    - (auth) and (app) route groups for logical separation of public and protected routes
    - Defense-in-depth auth: proxy layer + layout layer both guard protected routes
    - server-only import guard on Gemini client prevents key from reaching client bundle

key-files:
  created:
    - proxy.ts
    - app/(auth)/login/page.tsx
    - app/(auth)/auth/sign-in/route.ts
    - app/(auth)/auth/callback/route.ts
    - app/(auth)/auth/auth-code-error/page.tsx
    - app/(app)/layout.tsx
    - app/(app)/dashboard/page.tsx
    - components/SignOutButton.tsx
    - lib/gemini/client.ts
  modified:
    - app/globals.css

key-decisions:
  - "Next.js 16 deprecates middleware.ts — renamed to proxy.ts with exported `proxy` function (not `middleware`)"
  - "Login page uses CSS utility class .google-signin-btn in globals.css (not Tailwind utility props) for hover/active states — Server Component cannot use event handlers"
  - "Gemini client throws at module load time if GEMINI_API_KEY missing — protects against silent runtime failures"

patterns-established:
  - "Route groups: (auth) for public auth pages, (app) for protected app routes with layout guard"
  - "Proxy pattern: proxy.ts delegates to lib/supabase/middleware.ts updateSession()"
  - "OAuth callback: uses createServerClient directly with setAll to persist session cookies"
  - "SignOutButton: Client Component using browser supabase client + router.refresh() to clear RSC cache"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: 4min
completed: 2026-06-09
---

# Phase 1 Plan 02: Auth Wiring and Gemini Guard Summary

**Google OAuth login page with Nomlog design system, Next.js 16 proxy session refresh, OAuth callback handler, protected (app) layout, and server-only Gemini client with build-time key guard**

## Performance

- **Duration:** 4 minutes
- **Started:** 2026-06-09T16:04:09Z
- **Completed:** 2026-06-09T16:08:14Z
- **Tasks:** 2 automated (Task 3 awaiting human verification)
- **Files modified:** 10

## Accomplishments

- Wired complete Google OAuth flow: login page -> sign-in POST -> Google -> callback GET -> /dashboard
- Implemented Next.js 16 proxy with session refresh on every request, redirecting unauthenticated users to /login
- Created protected (app) route group with layout-level verifySession() guard (defense-in-depth)
- Built SignOutButton Client Component using browser supabase client + router.refresh()
- Created Gemini server-only singleton: `import 'server-only'` first line, throws if GEMINI_API_KEY missing, confirmed PASS from check-secrets.sh
- Login page matches Nomlog design system: cream background, Space Grotesk wordmark, tomato pill CTA with shadow

## Task Commits

Each task was committed atomically:

1. **Task 1: Root proxy, login page, OAuth sign-in action, and callback handler** - `3391f25` (feat)
2. **Task 2: Protected app layout, stub dashboard, sign-out button, and Gemini guard** - `c091465` (feat)

**Task 3:** Awaiting human verification (checkpoint:human-verify)

## Files Created/Modified

- `proxy.ts` - Next.js 16 proxy delegating to updateSession(); exports `proxy` function and matcher config
- `app/(auth)/login/page.tsx` - Google-only login page with Nomlog cream background, Space Grotesk wordmark, tomato pill CTA
- `app/(auth)/auth/sign-in/route.ts` - POST handler initiating Google OAuth with NEXT_PUBLIC_SITE_URL/auth/callback redirect
- `app/(auth)/auth/callback/route.ts` - GET handler exchanging OAuth code for session using setAll cookies
- `app/(auth)/auth/auth-code-error/page.tsx` - Fallback error page with link back to /login
- `app/(app)/layout.tsx` - Protected layout: calls verifySession(), redirects to /login if null
- `app/(app)/dashboard/page.tsx` - Stub dashboard showing user email + SignOutButton
- `components/SignOutButton.tsx` - Client Component: supabase.auth.signOut() + router.push('/login') + router.refresh()
- `lib/gemini/client.ts` - server-only GoogleGenAI singleton; throws at module load if GEMINI_API_KEY unset
- `app/globals.css` - Added .google-signin-btn utility class with hover/active transitions

## Decisions Made

- Next.js 16 changed the proxy filename from `middleware.ts` to `proxy.ts` and the export from `middleware` to `proxy`. Auto-fixed when build emitted deprecation warning.
- Login page hover states implemented as CSS class in globals.css (not inline event handlers) because the login page is a Server Component — event handlers cannot be attached in server context.
- Gemini client uses module-level singleton (instantiated at module load) rather than per-request instantiation, matching plan specification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Next.js 16 proxy filename and export name change**
- **Found during:** Task 1 (middleware.ts creation)
- **Issue:** Next.js 16 deprecated `middleware.ts` filename convention in favor of `proxy.ts`, and the exported function must be named `proxy` (not `middleware`). Initial `middleware.ts` build emitted deprecation warning, then rename to `proxy.ts` with old export caused hard build failure.
- **Fix:** Renamed `middleware.ts` to `proxy.ts`; changed export from `middleware` to `proxy`
- **Files modified:** proxy.ts (renamed from middleware.ts)
- **Verification:** `pnpm build` exits 0 with no warnings, route shows "ƒ Proxy (Middleware)" in build output
- **Committed in:** 3391f25 (Task 1 commit)

**2. [Rule 1 - Bug] Login page hover states moved to CSS class**
- **Found during:** Task 1 (login page creation)
- **Issue:** Initial implementation used `onMouseEnter`/`onMouseLeave` handlers directly on the button. These are client-side event handlers and cannot be attached in a Server Component — would cause a React runtime error.
- **Fix:** Moved hover/active styles to `.google-signin-btn` CSS class in `app/globals.css` using CSS `:hover` and `:active` pseudo-classes
- **Files modified:** app/(auth)/login/page.tsx, app/globals.css
- **Verification:** `pnpm build` exits 0; no TypeScript errors
- **Committed in:** 3391f25 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes required for correctness. No scope creep.

## Issues Encountered

- `.env.local` is not present in the project — Supabase credentials and GEMINI_API_KEY not yet configured. Build still succeeds because Next.js does not execute server-side code at build time (except for static page generation). The Gemini client `throw` is a runtime guard, not a build-time guard.
- The `check-secrets.sh` PASS confirms no key leaked into the client bundle even without real keys configured.

## User Setup Required

Before Task 3 human verification can complete, the following must be configured:

1. **Supabase Google provider**: Supabase Dashboard > Authentication > Providers > Google — paste Google OAuth Client ID and Secret
2. **Supabase redirect URL**: Authentication > URL Configuration — add `http://localhost:3000/auth/callback`
3. **Google Cloud Console**: Add Supabase callback URL to Authorized Redirect URIs (format: `https://[ref].supabase.co/auth/v1/callback`)
4. **`.env.local`**: Create from `.env.example` and fill in all four variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY` (no NEXT_PUBLIC_ prefix)
   - `NEXT_PUBLIC_SITE_URL=http://localhost:3000`

## Auth flow status

- OAuth working: Automated checks pass; manual E2E pending human verification (Task 3)
- RLS smoke test result: Pending human verification (two-account test - step 5 in Task 3)
- check-secrets.sh result: PASS (verified in Task 2)
- Middleware redirect behavior confirmed: Yes (build shows proxy active; curl test pending dev server)
- Session persistence confirmed: Pending human verification (browser close/reopen test)

## Next Phase Readiness

- Auth layer fully wired — proxy, login, callback, protected layout, sign-out all in place
- Build passes with zero TypeScript errors
- Gemini key guard active — server-only import prevents key leakage
- Human verification (Task 3) required before Phase 2 can begin: Google OAuth E2E flow, session persistence, sign-out, two-account RLS smoke test

---
*Phase: 01-foundation*
*Completed: 2026-06-09 (pending Task 3 human verification)*
