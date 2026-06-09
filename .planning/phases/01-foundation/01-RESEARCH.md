# Phase 1: Foundation - Research

**Researched:** 2026-06-09
**Domain:** Next.js 16 App Router + Supabase Auth (Google OAuth) + Row-Level Security + Gemini API key guard
**Confidence:** HIGH (all findings verified from STACK.md, ARCHITECTURE.md, PITFALLS.md written from live npm registry queries and official docs on 2026-06-09)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can sign in with their Google account via OAuth — no email/password option exists | Supabase Auth `signInWithOAuth({ provider: 'google' })` pattern documented; login page is a Server Component with a single CTA |
| AUTH-02 | User session persists across browser closes without requiring re-login | `@supabase/ssr` middleware refreshes the JWT on every request via refresh token in cookie; `setAll` writes refreshed token back to response |
| AUTH-03 | User can sign out explicitly from their profile screen | `supabase.auth.signOut()` from a Client Component; clears the session cookie and redirects to `/login` |
| AUTH-04 | Two different Google accounts have completely separate data with no cross-visibility | Enforced by RLS policies using `auth.uid() = user_id`; verified via mandatory two-account smoke test |
| AUTH-05 | RLS policies enforce per-user data isolation at the DB level; verified with two separate test accounts before any second real user is added | `ENABLE ROW LEVEL SECURITY` + `WITH CHECK (auth.uid() = user_id)` on every user-scoped table; two-account smoke test is a hard gate |
</phase_requirements>

---

## Summary

Phase 1 creates the entire foundation the rest of the app depends on: a working Next.js 16 project scaffold, Supabase schema with RLS, Google OAuth authentication wired through `@supabase/ssr` middleware, and a server-only guard for the Gemini API key. No application feature code ships in this phase — only the infrastructure every later phase assumes.

The three highest-risk decisions are all resolved here. First, the Gemini API key must be guarded by `import 'server-only'` in `lib/gemini/client.ts` before any Gemini code is written — adding the guard after the fact is risky because the import graph may already have holes. Second, RLS must be written with `auth.uid() = user_id` (not `IS NOT NULL`) and verified with two separate Google accounts before the second real user touches the app. Third, the `@supabase/ssr` middleware must use the exact `getAll`/`setAll` cookie pattern — omitting `setAll` causes the refresh token to drop silently, logging users out after ~1 hour.

The database schema (meal_logs with dedicated numeric total columns, user_profiles for goals) must be locked in this phase because changing column types later requires data migrations. The JSONB `food_items` column holds per-item display data; `total_calories`, `total_protein_g` etc. are dedicated columns for aggregation — this decision cannot be deferred.

**Primary recommendation:** Implement in strict order: scaffold → Supabase project + schema + RLS → server/client factories + middleware → OAuth flow → Gemini key guard + CI check. Verify each step before the next. The two-account RLS smoke test is the phase exit gate.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.7 | React framework, App Router, API routes | Current stable; Next.js 15.3.9 carries CVE-2025-66478; React 19 required |
| react | 19.2.7 | UI runtime | Required by Next.js 16; all peer deps (Recharts, SWR) support React 19 |
| typescript | 6.0.3 | Type safety | `lib.dom` in TS 6.x includes `SpeechRecognition` — no third-party types needed |
| @supabase/ssr | 0.12.0 | Supabase Auth + DB in SSR context | Only correct package for Supabase Auth in Next.js App Router; replaces all deprecated `@supabase/auth-helpers-*` |
| @supabase/supabase-js | 2.108.0 | Core Supabase JS client | Required peer of `@supabase/ssr` |
| tailwindcss | 4.3.0 | Utility-first CSS | CSS-based `@theme` config; no `tailwind.config.js` in v4 |
| @tailwindcss/postcss | 4.3.0 | PostCSS plugin for Tailwind v4 | Replaces autoprefixer; must match Tailwind major version |
| zod | 4.4.3 | Schema validation | Built-in `z.toJSONSchema()` — no `zod-to-json-schema` package needed |
| @google/genai | 2.8.0 | Gemini 2.5 Flash SDK | New unified Google Gen AI SDK; `@google/generative-ai` is EOL Aug 2025 |
| server-only | (any) | Hard build error if server module imported from client | Prevents Gemini key from reaching client bundle; build fails loudly |

### Supporting (Phase 1 scope)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| swr | 2.4.1 | Client-side data fetching | Installed in Phase 1; used from Phase 4 for dashboard; install now so the SWR key convention can be established |
| pnpm | (latest) | Package manager | Lockfile determinism; faster installs |

### What NOT to Install

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@supabase/auth-helpers-nextjs` | Officially deprecated; "Package no longer supported"; missing `getUser()` security model | `@supabase/ssr@0.12.0` |
| `@supabase/auth-helpers-react` | Same deprecation as above; all `@supabase/auth-helpers-*` packages are dead | `@supabase/ssr@0.12.0` |
| `@google/generative-ai` | EOL August 31, 2025; no Gemini 2.5 feature parity | `@google/genai@2.8.0` |
| `next@15.x` | CVE-2025-66478 on 15.3.9; Next.js 16 stable since Oct 2025 | `next@16.2.7` |
| `tailwindcss@3.x` | v3 in LTS-only mode; v3 config syntax incompatible with v4 | `tailwindcss@4.3.0` |
| `zod-to-json-schema` | Redundant; Zod v4 has `z.toJSONSchema()` built in | `z.toJSONSchema(schema)` |
| `NEXT_PUBLIC_GEMINI_API_KEY` | `NEXT_PUBLIC_` prefix bundles value into client JS at build time | `GEMINI_API_KEY` (no prefix) |

### Installation

```bash
# Bootstrap
pnpm create next-app@16.2.7 nomlog --typescript --app --no-src-dir --no-import-alias

# Auth + DB
pnpm add @supabase/ssr@0.12.0 @supabase/supabase-js@2.108.0

# Styling
pnpm add tailwindcss@4.3.0 @tailwindcss/postcss@4.3.0

# Validation (needed in Phase 2 but install now so types are available)
pnpm add zod@4.4.3

# Gemini SDK (install in Phase 1 to set up the server-only guard skeleton)
pnpm add @google/genai@2.8.0 server-only

# Data fetching (install now; establish SWR key convention)
pnpm add swr@2.4.1

# Dev dependencies
pnpm add -D typescript@6.0.3
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 1 scope)

```
nomlog/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx              # Google OAuth CTA (Server Component)
│   │   └── auth/
│   │       └── callback/
│   │           └── route.ts          # OAuth code exchange → session cookie
│   ├── (app)/
│   │   └── layout.tsx                # Auth guard; verifySession() from DAL
│   ├── layout.tsx                    # Root layout
│   └── globals.css
├── lib/
│   ├── supabase/
│   │   ├── server.ts                 # createServerClient factory (server-only)
│   │   ├── client.ts                 # createBrowserClient factory
│   │   └── middleware.ts             # updateSession() helper
│   ├── gemini/
│   │   └── client.ts                 # 'import server-only' guard + GoogleGenAI init
│   └── dal.ts                        # verifySession(), getCurrentUser() — server-only
├── types/
│   ├── database.types.ts             # Generated: `supabase gen types typescript`
│   └── app.types.ts                  # Shared domain types
├── middleware.ts                     # Root: calls updateSession()
├── .env.local                        # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, GEMINI_API_KEY
├── .env.example                      # Schema for all env vars (committed)
└── supabase/
    └── migrations/
        └── 0001_initial_schema.sql   # user_profiles + meal_logs + RLS
```

### Pattern 1: Supabase SSR Middleware (Three-File Pattern)

**What:** `middleware.ts` at the project root delegates to `lib/supabase/middleware.ts`. This keeps root middleware thin and the session-refresh logic testable in isolation.

**Critical:** The `setAll` cookie handler MUST write to both `request.cookies` AND a new `supabaseResponse`. Writing to only one causes the refreshed token to be lost on the next request — users get silently logged out after ~1 hour.

```typescript
// middleware.ts (project root)
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

```typescript
// lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Step 1: write to request (so this request sees the new token)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Step 2: create new response with updated request
          supabaseResponse = NextResponse.next({ request })
          // Step 3: write to response (so the BROWSER gets the new token)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ALWAYS getUser() — never getSession() (getSession reads unverified cookies)
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth')
  const isProtectedRoute = !isAuthRoute

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

### Pattern 2: Server and Browser Client Factories

```typescript
// lib/supabase/server.ts
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components cannot write cookies — silently ignore
            // Only middleware can write cookies
          }
        },
      },
    }
  )
}
```

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Pattern 3: Data Access Layer (DAL)

**What:** `lib/dal.ts` is the single place that calls `getUser()`. All Server Components and Route Handlers go through `verifySession()` — they never import and call `getUser()` directly. This makes it impossible to accidentally use `getSession()` somewhere.

```typescript
// lib/dal.ts
import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

// cache() memoizes per-request: verifySession() called 5 times in one request = 1 actual getUser() call
export const verifySession = cache(async () => {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
})

export const getCurrentUser = verifySession
```

### Pattern 4: OAuth Callback Handler

```typescript
// app/(auth)/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
```

### Pattern 5: Gemini Server-Only Guard

**What:** `lib/gemini/client.ts` has `import 'server-only'` as its first line. If any Client Component ever imports from this file (directly or transitively), the Next.js build fails with a hard error: "This module cannot be imported from a Client Component module." This is the primary defense against the API key leaking.

```typescript
// lib/gemini/client.ts
import 'server-only'
import { GoogleGenAI } from '@google/genai'

// Module-level singleton — do not instantiate per request
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
```

**The key is read only in Route Handlers and server modules. It is never in any `'use client'` file, never in `NEXT_PUBLIC_` variables, never in `app/globals.css` or any client-reachable file.**

### Pattern 6: Database Schema and RLS

```sql
-- supabase/migrations/0001_initial_schema.sql

-- user_profiles: per-user nutrition goals
CREATE TABLE user_profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  goal_calories    INTEGER,
  goal_protein_g   NUMERIC(6,1),
  goal_carbs_g     NUMERIC(6,1),
  goal_fat_g       NUMERIC(6,1),
  goal_fiber_g     NUMERIC(6,1)
);

-- meal_logs: one row per logged meal entry
CREATE TABLE meal_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meal_type        TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  raw_input        TEXT,                  -- original text/voice transcript
  food_items       JSONB NOT NULL,        -- array of FoodItem objects (for display/edit)
  total_calories   INTEGER NOT NULL,      -- stored separately — never compute from JSONB at query time
  total_protein_g  NUMERIC(6,1) NOT NULL,
  total_carbs_g    NUMERIC(6,1) NOT NULL,
  total_fat_g      NUMERIC(6,1) NOT NULL,
  total_fiber_g    NUMERIC(6,1) NOT NULL,
  confidence       TEXT CHECK (confidence IN ('high','medium','low')),
  input_source     TEXT CHECK (input_source IN ('voice','text')),
  edited           BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Composite index for the most common query: user's meals on a specific day
CREATE INDEX meal_logs_user_date ON meal_logs (user_id, logged_at);

-- RLS on both tables
ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Use auth.uid() = user_id — NOT auth.uid() IS NOT NULL
-- The IS NOT NULL form passes single-user tests but leaks all data to any authenticated user

CREATE POLICY "Users see own meals" ON meal_logs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users see own profile" ON user_profiles
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

**Why dedicated numeric columns instead of JSONB aggregation:**
The dashboard needs `SUM(total_calories)` for the day. Doing `SUM((food_items->>'calories')::numeric)` on every dashboard load is expensive on Supabase free tier shared compute and the query planner cannot use a standard B-tree index on JSONB fields. Dedicated columns are set at save time from the items array and never recomputed.

### Pattern 7: Tailwind v4 Configuration

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --color-brand: #16a34a;
  --font-sans: 'Inter', sans-serif;
}
```

```javascript
// postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

No `tailwind.config.js` — v4 configuration is CSS-only. No `autoprefixer` — `@tailwindcss/postcss` handles vendor prefixing.

### Environment Variables

```bash
# .env.local (never committed)
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
GEMINI_API_KEY=[gemini-key]           # NO NEXT_PUBLIC_ prefix — server only

# Optional: only for admin migrations, never in application code
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
```

```bash
# .env.example (committed — schema only, no values)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
```

### Anti-Patterns to Avoid

- **`getSession()` on the server:** Reads cookies without server verification. A malicious client can craft a cookie with a spoofed user ID. Always `getUser()`.
- **`user_id` from request body:** Never trust the client to supply their own user ID. Always derive from `supabase.auth.getUser()` on the server side.
- **`@supabase/auth-helpers-nextjs`:** Officially deprecated. Using it means the `getUser()` security model is unavailable.
- **`auth.uid() IS NOT NULL` in RLS:** Passes single-user tests silently; any authenticated user can read all rows.
- **`createClient()` from `@supabase/supabase-js` in Route Handlers:** Use the server factory from `@supabase/ssr` instead — it has cookie-based auth context.
- **Auth only in middleware, not in Route Handlers:** Middleware is a UX redirect guard. Route Handlers are public API endpoints — anyone can POST to them from curl. Every Route Handler must call `verifySession()` as its first action.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session refresh on every request | Manual JWT refresh logic in middleware | `@supabase/ssr` `createServerClient` with `getAll`/`setAll` cookies | Token rotation, expiry handling, concurrent refresh prevention are all handled |
| OAuth flow | Custom Google OAuth implementation | `supabase.auth.signInWithOAuth({ provider: 'google' })` | Handles PKCE, state parameter, token exchange, session creation |
| DB-level user isolation | Application-level `WHERE user_id = ...` in every query | Supabase RLS `USING (auth.uid() = user_id)` | Policy applies to ALL queries including those through Studio and direct SDK calls — can't be bypassed by application bugs |
| API key leak prevention | Manual audit of imports | `import 'server-only'` + `grep -r "GEMINI_API_KEY" .next/static/` CI check | Build fails loudly on first violation; CI check catches any future regression |
| TypeScript DB types | Manual type definitions for DB tables | `supabase gen types typescript > types/database.types.ts` | Auto-generated from actual schema; re-run after each migration |

**Key insight:** Every piece of auth plumbing in this phase has a `server-only` boundary concern. Do not improvise the plumbing — use the patterns exactly as documented. The patterns are non-obvious because they involve Next.js Edge Runtime, cookie scoping across middleware and Route Handlers, and Supabase JWT rotation. One wrong implementation detail causes hours of debugging silent logout bugs.

---

## Common Pitfalls

### Pitfall 1: `setAll` Writes Cookies to Only One Target in Middleware

**What goes wrong:** User gets silently logged out after ~1 hour (when the access token expires). Auth appears to work initially because the refresh token is in the cookie, but the refreshed access token is never sent back to the browser.

**Why it happens:** The `setAll` handler in middleware must write to BOTH `request.cookies` (so the current request sees the new token) AND a new `supabaseResponse` (so the browser receives the new token as a Set-Cookie header). Writing only one breaks the chain.

**How to avoid:** Use the exact three-step `setAll` pattern: `request.cookies.set` → `supabaseResponse = NextResponse.next({ request })` → `supabaseResponse.cookies.set`.

**Warning signs:** Auth works immediately after login but breaks after the browser has been open for 60+ minutes without a full page reload.

### Pitfall 2: RLS Policy Uses `IS NOT NULL` Instead of `= user_id`

**What goes wrong:** Data isolation appears to work with one account. The second user (partner) can read all of the first user's meal entries. This is a silent data leak.

**Why it happens:** `USING (auth.uid() IS NOT NULL)` checks only that someone is logged in, not that they own the row. With one user, this is indistinguishable from the correct policy.

**How to avoid:** Always `USING (auth.uid() = user_id)` and `WITH CHECK (auth.uid() = user_id)`. Run the mandatory two-account smoke test before the phase is considered complete.

**Warning signs:** Policy SQL contains `IS NOT NULL` as the sole USING condition. Single-user testing never catches this.

### Pitfall 3: OAuth Callback URL Not Registered in Both Places

**What goes wrong:** OAuth works on `localhost:3000`. On the Vercel production URL, the user completes Google sign-in but is redirected to an error page or back to login without a session.

**Why it happens:** Two separate systems must be configured. Supabase requires the app callback URL in Auth → URL Configuration → Redirect URLs. Google Cloud Console requires `https://[supabase-project-id].supabase.co/auth/v1/callback` (the Supabase-side callback, not the app URL) in OAuth 2.0 Client → Authorized redirect URIs. The Supabase-side callback URL is the most commonly missed.

**How to avoid:** Configure both before first Vercel deploy. For Supabase Redirect URLs, add `http://localhost:3000/**` and `https://[production-domain]/**`. For Google Console, add the Supabase callback URL (format: `https://[project-ref].supabase.co/auth/v1/callback`).

**Warning signs:** Login works locally but silently fails after deploy. Error page shows "redirect_uri_mismatch".

### Pitfall 4: Gemini `lib/gemini/client.ts` Imported From a Client-Touched File

**What goes wrong:** The API key ends up in `.next/static/chunks/`. No error is thrown at runtime — the key is simply there, visible to any user who opens DevTools.

**Why it happens:** A developer creates `lib/gemini/client.ts` without `import 'server-only'`. A utility or shared module imports from it. A Client Component imports from that utility. Next.js tree-shaking does not reliably exclude server modules reachable from client-touched files.

**How to avoid:** `import 'server-only'` as the first line of `lib/gemini/client.ts` causes a hard build error on the first violation. Additionally, run `grep -r "GEMINI_API_KEY" .next/static/` after every `next build` in CI.

**Warning signs:** `typeof window` checks wrap Gemini SDK code. `lib/gemini/client.ts` is imported from a file in `components/` or `app/` without a `'use server'` boundary.

### Pitfall 5: `user_id` Accepted From Request Body

**What goes wrong:** A user POSTs to `/api/meals` with a different user's UUID in the body. The INSERT policy has `WITH CHECK (auth.uid() = user_id)`, but the Route Handler sets `user_id` from `req.body.userId` — the user supplied a mismatched ID and the check fails differently than expected, or worse, the Route Handler sets it before the check and the policy is bypassed through a misconfigured service role call.

**How to avoid:** Always: `const user = await verifySession()` → use `user.id` as `user_id` in all DB writes. Completely ignore any `user_id` field in the request body.

---

## Code Examples

### Google OAuth Sign-In Button (Server Component)

```typescript
// app/(auth)/login/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If already logged in, redirect to dashboard
  if (user) redirect('/dashboard')

  return (
    <main>
      <h1>NomLog</h1>
      <form action="/auth/sign-in" method="POST">
        <button type="submit">Sign in with Google</button>
      </form>
    </main>
  )
}
```

```typescript
// app/(auth)/auth/sign-in/route.ts
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function POST() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error || !data.url) redirect('/auth/error')
  redirect(data.url)
}
```

### Sign Out (Client Component)

```typescript
'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh() // Clear server component cache
  }

  return <button onClick={handleSignOut}>Sign out</button>
}
```

### Protected Layout (Auth Guard)

```typescript
// app/(app)/layout.tsx
import { verifySession } from '@/lib/dal'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await verifySession()
  if (!user) redirect('/login')

  return <>{children}</>
}
```

### Daily Totals Query

```sql
-- Dashboard: today's calorie and macro totals
-- Uses dedicated numeric columns — no JSONB aggregation
SELECT
  SUM(total_calories)  AS calories,
  SUM(total_protein_g) AS protein_g,
  SUM(total_carbs_g)   AS carbs_g,
  SUM(total_fat_g)     AS fat_g,
  SUM(total_fiber_g)   AS fiber_g
FROM meal_logs
WHERE user_id = auth.uid()
  AND logged_at >= '2026-06-09'::date
  AND logged_at <  '2026-06-10'::date;
```

### CI Key-Leak Check (package.json)

```json
{
  "scripts": {
    "build": "next build",
    "check:secrets": "grep -r 'GEMINI_API_KEY' .next/static/ && echo 'FAIL: GEMINI_API_KEY found in client bundle' && exit 1 || echo 'PASS: key not in client bundle'"
  }
}
```

Run `pnpm build && pnpm check:secrets` in CI after every build. If the grep finds anything, the build is rejected.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr@0.12.0` | 2023–2024 | `getUser()` security model; `getAll`/`setAll` cookie adapter; App Router compatibility |
| `@google/generative-ai` | `@google/genai@2.8.0` | Aug 2025 (EOL) | New unified SDK; `GoogleGenAI` class; supports Gemini 2.5+ |
| `next@15.x` | `next@16.2.7` | Oct 2025 | CVE-2025-66478 patched; React 19 required |
| `tailwind.config.js` | CSS `@theme {}` in `globals.css` | Tailwind v4 (2024) | No JS config file; PostCSS plugin replaces autoprefixer |
| `zod-to-json-schema` package | `z.toJSONSchema()` (Zod v4 built-in) | Zod v4 (July 2025) | Eliminates a dependency |
| `getSession()` for auth checks | `getUser()` everywhere server-side | `@supabase/ssr` docs | `getSession()` reads unverified cookies; `getUser()` validates with Auth server |

**Deprecated / must not use:**
- `@supabase/auth-helpers-nextjs`: "Package no longer supported" on npm; last version 0.15.0
- `@google/generative-ai`: Explicit EOL notice in readme; "now considered legacy"
- `next@15.3.9`: CVE-2025-66478

---

## Open Questions

1. **Supabase project tier for development**
   - What we know: Free tier supports the 2-user use case (500MB storage, 60 connections)
   - What's unclear: Whether the free tier connection limit (60) becomes a concern during development with multiple Vercel preview deployments open simultaneously
   - Recommendation: Use a single Supabase project for dev/staging/prod on free tier; if connection issues appear, enable PgBouncer in Supabase dashboard (free setting change)

2. **Google Cloud Console OAuth client: test users vs. production**
   - What we know: Google requires adding test users in the OAuth consent screen during development if the app is in "Testing" mode
   - What's unclear: Whether the Supabase callback URL registration is sufficient for the second user (partner) to sign in during dev
   - Recommendation: Add both Google accounts as test users in Google Cloud Console before testing the two-account RLS smoke test

3. **`supabase gen types typescript` — when to run**
   - What we know: Generated types (`types/database.types.ts`) must be committed; re-run after every migration
   - What's unclear: Whether the Supabase CLI is installed locally or via pnpm; Vercel does not run this automatically
   - Recommendation: Add as a post-migration step in a local script; commit the generated file

---

## Validation Architecture

`nyquist_validation` is enabled in `.planning/config.json`. Phase 1 is infrastructure — no application behavior to unit test. Validation is done through smoke tests and build checks that prove each AUTH requirement is satisfied.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual smoke tests + shell CI checks (no unit test framework needed for Phase 1 infrastructure) |
| Config file | None needed for Phase 1; Jest or Vitest scaffolded in Phase 2 for LLM schema tests |
| Quick run command | `pnpm build && pnpm check:secrets` |
| Full suite command | Two-account RLS smoke test (manual) + `pnpm build && pnpm check:secrets` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| AUTH-01 | User can sign in with Google — no email/password option exists | smoke | `curl -s http://localhost:3000/login | grep -c 'email'` should return 0 | Manual: open login page, verify only Google CTA exists |
| AUTH-02 | Session persists across browser closes | smoke | Manual only | Open app → close browser → reopen → verify still logged in (no re-auth prompt) |
| AUTH-03 | User can sign out and return to login | smoke | Manual only | Tap sign out → verify redirected to `/login` → verify protected routes redirect back to `/login` |
| AUTH-04 | Two accounts have separate data with no cross-visibility | smoke | Supabase query (see below) | Must run with two authenticated sessions |
| AUTH-05 | RLS enforced at DB level; verified with two accounts | smoke | Supabase SQL check (see below) | RLS verification is the phase exit gate |

**AUTH-01 automated check (no email/password option):**
```bash
# After `pnpm dev`, verify login page has no email/password form elements
curl -s http://localhost:3000/login | grep -iE '(type="email"|type="password"|email.*input|password.*input)' && echo "FAIL: email/password found" || echo "PASS: no email/password"
```

**AUTH-04 / AUTH-05: Two-account RLS smoke test (manual procedure):**

Step 1 — Log in as User A, insert a test meal:
```sql
-- In Supabase SQL editor while authenticated as User A (anon key, RLS active)
INSERT INTO meal_logs (user_id, meal_type, food_items, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g)
VALUES (auth.uid(), 'lunch', '[]', 500, 20, 60, 15, 5);
```

Step 2 — Log in as User B (different Google account), attempt to read User A's data:
```sql
-- In Supabase SQL editor authenticated as User B
-- This should return 0 rows if RLS is correct
SELECT COUNT(*) FROM meal_logs;
-- Expected: returns only User B's own rows (0 if none logged yet)

-- Direct attack: attempt to read by known ID
SELECT * FROM meal_logs WHERE user_id = '[User A UUID]';
-- Expected: 0 rows returned
```

Step 3 — Attempt cross-user insert (should be blocked by WITH CHECK):
```sql
-- Authenticated as User B, attempt to write as User A
INSERT INTO meal_logs (user_id, meal_type, food_items, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g)
VALUES ('[User A UUID]', 'dinner', '[]', 300, 10, 40, 8, 3);
-- Expected: ERROR: new row violates row-level security policy for table "meal_logs"
```

**Gemini key check (AUTH-01 adjacent — key must not reach client):**
```bash
# Run after every `next build`
pnpm build
grep -r "GEMINI_API_KEY" .next/static/ && echo "FAIL: key leaked to client bundle" && exit 1 || echo "PASS: key not in bundle"

# Also check for the literal key value (in case it was hardcoded)
grep -r "AIza" .next/static/ && echo "WARNING: possible API key in bundle" || echo "PASS: no API key pattern found"
```

**RLS enabled on all tables (Supabase CLI check):**
```bash
# Using Supabase CLI
supabase db inspect rls
# Expected: all user-scoped tables show RLS enabled
```

**Middleware redirect behavior:**
```bash
# Unauthenticated request to protected route should redirect to /login
curl -s -o /dev/null -w "%{http_code} %{redirect_url}" http://localhost:3000/dashboard
# Expected: 302/307 redirect to http://localhost:3000/login
```

### Sampling Rate

- **Per task commit:** `pnpm build` (verify no TypeScript errors, no server-only violations)
- **Per wave (after 01-01 and 01-02 complete):** `pnpm build && pnpm check:secrets` + middleware redirect test
- **Phase gate (before Phase 2 begins):** Full two-account RLS smoke test passes + Gemini key grep returns empty + OAuth works on production Vercel URL

### Wave 0 Gaps

- [ ] `scripts/check-secrets.sh` — the `grep -r "GEMINI_API_KEY" .next/static/` check as a named script (covers AUTH-01 key security)
- [ ] `supabase/migrations/0001_initial_schema.sql` — schema + RLS migration must exist before any Phase 2 work
- [ ] `types/database.types.ts` — generated from `supabase gen types typescript`; must be committed before TypeScript compilation succeeds

---

## Sources

### Primary (HIGH confidence)
- STACK.md (this project) — all package versions from live npm registry queries, 2026-06-09
- ARCHITECTURE.md (this project) — Supabase SSR patterns, middleware implementation, schema design
- PITFALLS.md (this project) — RLS policies, cookie/session bugs, key leak mechanisms
- SUMMARY.md (this project) — critical deprecations, phase structure

### Secondary (MEDIUM confidence)
- Official Supabase Next.js SSR guide patterns — reflected in ARCHITECTURE.md middleware code
- Next.js App Router authentication docs — reflected in DAL pattern, Route Handler auth checks

### Tertiary (LOW confidence)
- None — all Phase 1 findings are HIGH confidence from official sources verified 2026-06-09

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions from live npm registry queries on 2026-06-09
- Architecture: HIGH — official `@supabase/ssr` and Next.js App Router patterns
- Pitfalls: HIGH — specific mechanisms verified from library readmes and official docs
- RLS patterns: HIGH — standard Postgres + Supabase RLS documentation
- Validation architecture: HIGH — SQL queries are deterministic; grep check is mechanical

**Research date:** 2026-06-09
**Valid until:** 2026-07-09 (30 days; stack versions and SSR patterns are stable)
