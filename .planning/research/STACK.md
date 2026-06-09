# Stack Research

**Domain:** Voice-first LLM-powered food logging web app
**Researched:** 2026-06-09
**Confidence:** HIGH (all package versions verified from npm registry; SDK deprecation confirmed from official package readme)

---

## Recommended Stack

### Core Technologies

| Technology | Pin Version | Purpose | Why Recommended |
|------------|-------------|---------|-----------------|
| Next.js | `16.2.7` | React framework, App Router, API routes | `latest` on npm as of 2026-06-09. Next.js 16 (released Oct 2025) is the current stable major. React 19 required. Do not pin to 15.x — 15.3.9 carries a known security vulnerability (CVE-2025-66478). |
| React | `19.2.7` | UI runtime | Required by Next.js 16. `latest` on npm. Recharts 3.x and SWR 2.x both declare React 19 peer dep support. |
| TypeScript | `6.0.3` | Type safety | `latest`. `lib.dom` in TS 6.x includes `SpeechRecognition` / `SpeechSynthesis` — no third-party types needed for Web Speech API. |
| @supabase/ssr | `0.12.0` | Supabase Auth + DB client in SSR context | The only correct package for Supabase Auth in Next.js App Router. Released 2026-06-09. Replaces all deprecated `@supabase/auth-helpers-*` packages. |
| @supabase/supabase-js | `2.108.0` | Core Supabase JS client | Required peer of `@supabase/ssr`. |
| @google/genai | `2.8.0` | Gemini 2.5 Flash API calls | The **new** unified Google Gen AI SDK. `@google/generative-ai` is officially deprecated as of Aug 2025 and receives no new features. Use `@google/genai` only. |
| Tailwind CSS | `4.3.0` | Utility-first CSS | `latest` on npm. V4 is the stable major. Breaking change from v3: configuration is CSS-based (no `tailwind.config.js`). Requires `@tailwindcss/postcss` instead of autoprefixer. |
| Zod | `4.4.3` | Schema validation for Gemini JSON responses | `latest`. Zod v4 (released July 2025) is the stable major. Built-in `z.toJSONSchema()` eliminates need for `zod-to-json-schema`. |
| SWR | `2.4.1` | Client-side data fetching + cache invalidation | `latest`. Vercel-maintained. Optimistic mutation via `mutate()` is the correct pattern for post-logging dashboard refresh in a Next.js App Router + API routes setup. |
| Recharts | `3.8.1` | Weekly calorie bar chart, macro progress | `latest`. React 19 support confirmed in peer deps. Composable, no heavy dependencies. |

---

### Supporting Libraries

| Library | Pin Version | Purpose | When to Use |
|---------|-------------|---------|-------------|
| @tailwindcss/postcss | `4.3.0` | PostCSS plugin for Tailwind v4 | Required for all Tailwind v4 setups. Replaces autoprefixer in the PostCSS chain. |
| zod-to-json-schema | NOT NEEDED | — | Zod v4 has `z.toJSONSchema()` built in. Do not add this dependency. |
| @types/node | latest via `@tsconfig/node20` | Node types for Next.js API routes | Dev dependency. Needed for `process.env`, `Request`, `Response` types in route handlers. |

---

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint (Next.js bundled) | Linting | `next lint` uses the built-in config. Do not install a separate eslint config. |
| Prettier | Formatting | Pin a version. Add `prettier-plugin-tailwindcss` for class sorting — but only the Tailwind v4-compatible version of the plugin (check `prettier-plugin-tailwindcss` dist-tags before installing). |
| pnpm | Package manager | Preferred for lockfile determinism and disk efficiency. Use `pnpm-lock.yaml`. |

---

## Installation

```bash
# Bootstrap
pnpm create next-app@16.2.7 nomlog --typescript --app --no-src-dir --no-import-alias

# Core runtime dependencies
pnpm add @supabase/ssr@0.12.0 @supabase/supabase-js@2.108.0
pnpm add @google/genai@2.8.0
pnpm add zod@4.4.3
pnpm add swr@2.4.1
pnpm add recharts@3.8.1

# Tailwind v4 (PostCSS setup)
pnpm add tailwindcss@4.3.0 @tailwindcss/postcss@4.3.0

# Dev
pnpm add -D typescript@6.0.3
```

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@supabase/auth-helpers-nextjs` | **Officially deprecated.** Package status on npm: "Package no longer supported." Last version 0.15.0, no further updates. Using it means missing critical `getUser()` vs `getSession()` security fixes. | `@supabase/ssr@0.12.0` |
| `@supabase/auth-helpers-react` | Same deprecation as above. All `@supabase/auth-helpers-*` packages are dead. | `@supabase/ssr@0.12.0` |
| `@google/generative-ai` | **Officially deprecated.** EOL was August 31, 2025. Readme explicitly states: "Please be advised that this repository is now considered legacy." Gemini 2.5 Flash is a 2.0+ model; the old SDK was built for 1.x models and does not receive new features (no structured output improvements, no Gemini 2.5 support parity). | `@google/genai@2.8.0` |
| `next@15.x` (specifically 15.3.9) | Carries CVE-2025-66478 security vulnerability per npm metadata. Next.js 16 has been stable since Oct 2025. | `next@16.2.7` |
| `tailwindcss@3.x` | Tailwind v3 is in LTS-only mode (`v3-lts` dist-tag). v4 is the stable major. New projects should start on v4; v3 config patterns (`tailwind.config.js`, `@tailwind` directives in CSS) do not apply to v4. | `tailwindcss@4.3.0` |
| `getSession()` for authorization | Per `@supabase/ssr` official readme: "The user object it contains is not verified by the Auth server and must not be used for authorization decisions; a malicious client could craft a cookie with a spoofed user ID." | `getUser()` for auth checks; `getClaims()` for JWT validation without a network call |
| `NEXT_PUBLIC_GEMINI_API_KEY` | Prefixing with `NEXT_PUBLIC_` exposes the value to the client bundle. Gemini API key must NEVER be public. | `GEMINI_API_KEY` (no prefix) — read only in `app/api/` route handlers and server components |
| `zod-to-json-schema` | Zod v4 includes `z.toJSONSchema()` natively. Third-party converter is redundant and adds a dependency. | `z.toJSONSchema(schema)` from Zod v4 directly |

---

## Critical Wiring Patterns

### Supabase Auth with Next.js App Router

The `@supabase/ssr` package requires **two client factories** and **one middleware file**. This is not optional — omitting the middleware causes session tokens to expire silently between navigations.

**1. Browser client** (`lib/supabase/client.ts`) — for Client Components:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**2. Server client** (`lib/supabase/server.ts`) — for Server Components and Route Handlers:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options))
        },
      },
    }
  )
}
```

**3. Middleware** (`middleware.ts`) — session refresh on every navigation:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )
  // IMPORTANT: call getUser() not getSession() — getSession() is unverified
  const { data: { user } } = await supabase.auth.getUser()
  if (!user && !request.nextUrl.pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Why this matters:** The `setAll` cookie handler in middleware must write cookies back to the response object. Failing to do this causes the refresh token rotation to silently drop, resulting in users being logged out after the access token expires (~1 hour). This is the single most common Supabase + Next.js App Router bug.

---

### Gemini 2.5 Flash Structured Output

Use `@google/genai` with `responseMimeType: 'application/json'` and `responseSchema` in the `config` field. Pass a JSON Schema object (not a Zod schema directly — convert first using `z.toJSONSchema()`).

```typescript
// app/api/parse-meal/route.ts (Server-only — no NEXT_PUBLIC_ key)
import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'

const MealItemSchema = z.object({
  name: z.string(),
  calories: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  fiber_g: z.number().optional(),
  confidence: z.enum(['high', 'medium', 'low']),
})

const MealResponseSchema = z.object({
  items: z.array(MealItemSchema),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  total_calories: z.number(),
})

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export async function POST(req: NextRequest) {
  const { text } = await req.json()

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: text,
    config: {
      systemInstruction: SYSTEM_PROMPT, // defined separately
      responseMimeType: 'application/json',
      responseSchema: z.toJSONSchema(MealResponseSchema),
    },
  })

  const raw = JSON.parse(response.text ?? '{}')
  const parsed = MealResponseSchema.safeParse(raw)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Parse failed' }, { status: 422 })
  }

  return NextResponse.json(parsed.data)
}
```

**Key points:**
- `z.toJSONSchema(schema)` converts the Zod schema to the JSON Schema format that `responseSchema` expects. This is Zod v4's built-in method — no extra package needed.
- `responseMimeType: 'application/json'` tells Gemini to return valid JSON, not markdown-wrapped JSON.
- Always `.safeParse()` the response — even with `responseSchema`, Gemini can return structurally valid JSON that fails business logic constraints (e.g., negative calorie values).
- The `ai` instance should be a module-level singleton, not recreated per request.

**Retry logic for parse failures:**
```typescript
async function parseWithRetry(text: string, maxAttempts = 2) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await ai.models.generateContent({ /* ... */ })
    const parsed = MealResponseSchema.safeParse(JSON.parse(response.text ?? '{}'))
    if (parsed.success) return parsed.data
    if (attempt === maxAttempts) throw new Error('Gemini response failed schema validation after retries')
  }
}
```

---

### SWR Dashboard Refresh After Meal Logging

The pattern is: log a meal via `fetch('/api/meals', { method: 'POST' })`, then call `mutate('/api/dashboard/today')` to invalidate the dashboard cache. Do not use SWR's `optimisticData` for meal logging — the calories are computed server-side and cannot be safely guessed client-side.

```typescript
// In the logging component (Client Component)
import useSWR, { useSWRConfig } from 'swr'

export function MealLogger() {
  const { mutate } = useSWRConfig()

  async function handleSubmit(text: string) {
    // 1. Call parse endpoint
    const parsed = await fetch('/api/parse-meal', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }).then(r => r.json())

    // 2. Show correction panel with parsed result...
    // 3. On confirm, save to DB
    await fetch('/api/meals', {
      method: 'POST',
      body: JSON.stringify(confirmedMeal),
    })

    // 4. Invalidate dashboard data — SWR will refetch automatically
    await mutate('/api/dashboard/today')
  }
}
```

**Key SWR keys to establish and keep stable:**
- `/api/dashboard/today` — calorie total + macro progress + meal list
- `/api/dashboard/yesterday` — yesterday summary
- `/api/dashboard/weekly` — 7-day analytics

Use string keys, not functions, for these shared keys so that `mutate()` calls from anywhere in the component tree reliably hit the correct cache entry.

---

### Web Speech API in a Next.js Client Component

The Web Speech API is a browser-only API. It must live inside a `'use client'` component. Feature-detect before use — Safari 17+ supports it but some configurations may not expose it.

```typescript
'use client'
import { useEffect, useRef, useState } from 'react'

export function VoiceInput({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [isSupported, setIsSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    // Feature detect — must be client-side only (useEffect gate)
    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionCtor) return

    setIsSupported(true)
    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-IN' // Better for Indian English + Hinglish

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      onTranscript(event.results[0][0].transcript)
      setIsListening(false)
    }
    recognition.onerror = () => setIsListening(false)
    recognitionRef.current = recognition
  }, [])

  if (!isSupported) return null // Hide mic button — text input is always visible

  return (
    <button
      type="button"
      aria-label={isListening ? 'Stop recording' : 'Start voice input'}
      onClick={() => {
        if (isListening) {
          recognitionRef.current?.stop()
          setIsListening(false)
        } else {
          recognitionRef.current?.start()
          setIsListening(true)
        }
      }}
    >
      {isListening ? 'Listening...' : 'Speak'}
    </button>
  )
}
```

**TypeScript note:** `SpeechRecognition` is included in `lib.dom` for TypeScript 6.x — no `@types/webspeechapi` needed. Use `window.SpeechRecognition ?? (window as any).webkitSpeechRecognition` for Safari compatibility (Safari uses the `webkit` prefix).

**lang: 'en-IN'** is important — it activates a speech model optimized for Indian English accent patterns and improves recognition of Indian food names and Hinglish.

---

### Environment Variable Rules

| Variable | Prefix | Available In | Never In |
|----------|--------|--------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | `NEXT_PUBLIC_` | Client + Server | — (intentionally public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_` | Client + Server | — (intentionally public, RLS enforced) |
| `GEMINI_API_KEY` | None | Server only (`app/api/`, Server Components) | Client Components, any `NEXT_PUBLIC_` variable, browser bundle |
| `SUPABASE_SERVICE_ROLE_KEY` | None | Server only (admin operations only) | Client Components |

**Hard rule:** If you ever find yourself needing `GEMINI_API_KEY` in a Client Component, the architecture is wrong. The parse endpoint is always an API route.

---

### Tailwind v4 Configuration

Tailwind v4 eliminates `tailwind.config.js`. Configuration is CSS-based. In `app/globals.css`:

```css
@import "tailwindcss";

/* Custom theme tokens go here using @theme */
@theme {
  --color-brand: #16a34a; /* Example: green-600 */
  --font-sans: 'Inter', sans-serif;
}
```

In `postcss.config.mjs`:
```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

**No `autoprefixer` needed** — `@tailwindcss/postcss` handles vendor prefixing. Removing autoprefixer from the PostCSS chain is intentional and correct for v4.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Gemini SDK | `@google/genai@2.8.0` | `@google/generative-ai` | Deprecated EOL Aug 2025; no Gemini 2.5 feature parity; no new development |
| Supabase SSR | `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | Officially deprecated; "Package no longer supported" on npm; missing `getUser()` security model |
| Next.js version | `16.2.7` | `15.3.9` | CVE-2025-66478 security vulnerability; 16.x is stable since Oct 2025 |
| Tailwind version | `4.3.0` | `3.4.19` | v3 is LTS-only; new projects should use v4; config syntax is incompatible anyway so no migration cost for greenfield |
| Zod JSON schema | `z.toJSONSchema()` (built-in) | `zod-to-json-schema` package | Zod v4 includes this natively; extra dependency adds no value |
| Charting | Recharts | Chart.js, Nivo | Recharts is React-native and composable; Chart.js requires canvas imperative API; Nivo is heavier and overkill for a 7-bar chart |
| Data fetching | SWR | TanStack Query | SWR is sufficient for this use case; TanStack Query adds complexity without benefit for a 2-user app with simple invalidation patterns |
| Auth | Supabase Auth + Google OAuth | NextAuth.js | NextAuth requires additional configuration; Supabase Auth is already in the stack and handles Google OAuth natively with RLS integration |

---

## Version Compatibility Matrix

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `next@16.2.7` | — | `react@19.x` | React 19 is a hard requirement for Next.js 16 |
| `@supabase/ssr@0.12.0` | — | `@supabase/supabase-js@2.108.0` | Must install both; `@supabase/ssr` has `@supabase/supabase-js` as peer dep |
| `recharts@3.8.1` | — | `react@19.x` | Peer dep declares `^19.0.0` support |
| `swr@2.4.1` | — | `react@19.x` | Peer dep declares `^19.0.0` support |
| `tailwindcss@4.3.0` | — | `@tailwindcss/postcss@4.3.0` | Must match major versions |
| `zod@4.4.3` | — | `@google/genai@2.8.0` | No direct coupling; use `z.toJSONSchema()` to produce `responseSchema` |
| `@google/genai@2.8.0` | — | Node.js 20+ | Explicitly requires Node 20+ |

---

## Sources

- npm registry (live queries, 2026-06-09) — all version numbers and dist-tags
- `@supabase/ssr` npm readme (0.12.0) — `getUser()` vs `getSession()` security model, middleware pattern, deprecation notice for auth-helpers packages
- `@google/generative-ai` npm readme (0.24.1) — explicit deprecation notice, EOL Aug 31 2025, migration pointer to `@google/genai`
- `@google/genai` npm readme (2.8.0) — `GoogleGenAI` class, `ai.models.generateContent()`, `config.responseMimeType`, `config.responseSchema` fields
- npm dist-tags for `next` — confirmed `latest: 16.2.7`, `backport: 15.5.19`, security warning on 15.3.9
- npm dist-tags for `tailwindcss` — confirmed `latest: 4.3.0`, `v3-lts: 3.4.19`
- npm dist-tags for `zod` — confirmed `latest: 4.4.3` (v4 GA July 2025)

---

*Stack research for: NomLog — voice-first LLM food logging web app*
*Researched: 2026-06-09*
