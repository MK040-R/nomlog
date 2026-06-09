# Architecture Research

**Domain:** LLM-powered voice food logging web app (Next.js 14+ App Router + Supabase + Gemini 2.5 Flash)
**Researched:** 2026-06-09
**Confidence:** HIGH (Next.js App Router patterns verified via official docs; Supabase SSR pattern from @supabase/ssr docs; Gemini structured output from training knowledge verified against release timeline; SWR mutation patterns from training knowledge; JSONB aggregation from Postgres documentation)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                             │
│  ┌───────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
│  │  Web Speech   │  │  LogFlow Panel   │  │  Dashboard /       │   │
│  │  API (mic)    │  │  (Client Comp)   │  │  Analytics Pages   │   │
│  │               │  │  useState FSM    │  │  (Server + Client) │   │
│  └──────┬────────┘  └────────┬─────────┘  └────────┬───────────┘   │
│         │                    │                      │               │
│         └──────────── fetch() POST ─────────────────┘               │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ HTTPS
┌─────────────────────────▼───────────────────────────────────────────┐
│                    Next.js on Vercel                                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  middleware.ts  (Supabase @supabase/ssr session refresh +    │    │
│  │                  route guard redirect)                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐     │
│  │  App Router Pages        │  │  Route Handlers (API)        │     │
│  │  /app/(auth)/...         │  │  /app/api/parse-food/        │     │
│  │  /app/(app)/dashboard/   │  │  /app/api/reestimate-item/   │     │
│  │  /app/(app)/yesterday/   │  │  /app/api/meals/             │     │
│  │  /app/(app)/analytics/   │  │  /app/api/goals/             │     │
│  └──────────────────────────┘  └────────────┬─────────────────┘     │
│                                              │ server-only           │
└──────────────────────────────────────────────┼──────────────────────┘
                                               │
              ┌────────────────────────────────┤
              │                                │
┌─────────────▼──────────┐      ┌─────────────▼──────────────────────┐
│   Supabase              │      │   Google Gemini 2.5 Flash          │
│   ─────────             │      │   ────────────────────             │
│   Auth (Google OAuth)   │      │   generateContent() with           │
│   Postgres (meals,      │      │   responseMimeType:                │
│     users, goals)       │      │   "application/json" +             │
│   RLS policies          │      │   responseSchema (Zod → JSON       │
│                         │      │   Schema) via google-genai SDK     │
└─────────────────────────┘      └────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `middleware.ts` | Session refresh on every request; redirect unauthenticated users from protected routes to `/login` | `@supabase/ssr` createServerClient with cookie read/write |
| `(auth)` route group | Login page with Google OAuth initiation; auth callback handler | Server Component page + Route Handler for callback |
| `(app)` route group | All authenticated pages; shares layout that fetches user + goals | Layout is Server Component; guards via DAL `verifySession()` |
| `DashboardPage` | Server Component: fetches today's meals via Supabase; passes to Client shell | async Server Component |
| `LogFlow` (Client) | Orchestrates the full voice→parse→correct→save loop as a finite state machine | `'use client'`, `useReducer` |
| `VoiceInput` (Client) | Web Speech API; dispatches transcribed text up to `LogFlow` | `'use client'`, feature-detection |
| `ConfirmationPanel` (Client) | Displays parsed items; per-item edit, re-estimate, delete, add; save | `'use client'`, receives dispatch from `LogFlow` |
| `DailySummary` (Client) | Running calorie/macro totals; reads from SWR cache; re-renders on mutation | `'use client'`, `useSWR` |
| `MealList` (Client) | Chronological list of logged meals; post-save inline edit; undo toast | `'use client'`, `useSWR` |
| `WeeklyChart` (Client) | Recharts bar chart; rule-based macro flags | `'use client'` |
| `/api/parse-food` | Calls Gemini with user text; validates response with Zod; returns structured JSON | Route Handler, server-only, never exposed to client bundle |
| `/api/reestimate-item` | Calls Gemini for a single item correction; same validation path | Route Handler, server-only |
| `/api/meals` | GET (day's meals), POST (save new meal entry), PATCH (edit entry) | Route Handler with Supabase server client |
| `/api/goals` | GET / PUT user nutrition goals | Route Handler |
| `lib/supabase/server.ts` | `createServerClient` factory for Route Handlers and Server Components | server-only module |
| `lib/supabase/client.ts` | `createBrowserClient` factory for Client Components | client-only module |
| `lib/gemini.ts` | Gemini SDK initialization, prompt templates, Zod schemas, structured output call wrapper | server-only module |
| `lib/dal.ts` | `verifySession()` memoized with React `cache()`; used in all server data fetches | server-only |

---

## Recommended Project Structure

```
nomlog/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx              # Google OAuth sign-in button (Server Component)
│   │   └── auth/
│   │       └── callback/
│   │           └── route.ts          # OAuth callback handler (exchanges code for session)
│   ├── (app)/
│   │   ├── layout.tsx                # Auth guard + fetch user/goals; passes as props
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Server Component: fetches today's meals
│   │   ├── yesterday/
│   │   │   └── page.tsx              # Server Component: fetches yesterday's meals
│   │   └── analytics/
│   │       └── page.tsx              # Server Component: fetches 7-day window
│   ├── api/
│   │   ├── parse-food/
│   │   │   └── route.ts              # POST: text → Gemini → structured items[]
│   │   ├── reestimate-item/
│   │   │   └── route.ts              # POST: single item override → Gemini → updated item
│   │   ├── meals/
│   │   │   └── route.ts              # GET (by date), POST (new entry), PATCH (edit)
│   │   └── goals/
│   │       └── route.ts              # GET / PUT user nutrition goals
│   ├── layout.tsx                    # Root layout: ThemeProvider, SWRConfig provider
│   └── globals.css
├── components/
│   ├── log-flow/
│   │   ├── LogFlow.tsx               # 'use client' — state machine root
│   │   ├── VoiceInput.tsx            # 'use client' — Web Speech API
│   │   ├── TextInput.tsx             # 'use client' — always-visible fallback
│   │   ├── ConfirmationPanel.tsx     # 'use client' — editable item list
│   │   ├── FoodItemRow.tsx           # 'use client' — single row: edit/re-estimate/delete
│   │   └── log-flow.types.ts         # LogFlowState, LogFlowAction union types
│   ├── dashboard/
│   │   ├── DailySummary.tsx          # 'use client' — SWR-backed calorie/macro totals
│   │   ├── MealList.tsx              # 'use client' — SWR-backed meal list
│   │   ├── MealCard.tsx              # 'use client' — post-save inline edit, undo toast
│   │   └── MacroProgressBar.tsx      # pure presentational (no directive needed)
│   └── analytics/
│       ├── CalorieBarChart.tsx       # 'use client' — Recharts
│       └── MacroFlagBanner.tsx       # rule-based flags (pure component)
├── lib/
│   ├── supabase/
│   │   ├── server.ts                 # createServerClient (server-only import)
│   │   ├── client.ts                 # createBrowserClient
│   │   └── middleware.ts             # updateSession() helper called from middleware
│   ├── gemini/
│   │   ├── client.ts                 # GoogleGenerativeAI init (server-only)
│   │   ├── schemas.ts                # Zod schemas: ParsedMealSchema, FoodItemSchema
│   │   ├── prompts.ts                # System prompt templates
│   │   └── parse.ts                  # callGeminiParse(), callGeminiReestimate()
│   ├── dal.ts                        # verifySession(), getCurrentUser() — server-only
│   └── analytics.ts                  # Pure functions: weeklyTotals(), macroFlags()
├── types/
│   ├── database.types.ts             # Supabase generated types (from supabase gen types)
│   └── app.types.ts                  # Shared domain types: MealEntry, FoodItem, Goals
├── middleware.ts                     # Root middleware: session refresh + route guard
└── supabase/
    └── migrations/                   # SQL migration files
```

### Structure Rationale

- **`(auth)` / `(app)` route groups:** Cleanly separates unauthenticated and authenticated page trees. The `(app)/layout.tsx` is the single place that verifies session and loads user context — all nested pages inherit it.
- **`log-flow/` component folder:** The logging flow is complex enough to warrant its own folder with co-located types. `LogFlow.tsx` is the single owner of the FSM state; child components receive props + dispatch only.
- **`lib/gemini/`:** All Gemini logic is server-only and grouped together. Keeping schemas, prompts, and the call wrapper co-located means the system prompt and Zod schema are always updated together.
- **`lib/supabase/`:** The two-file pattern (`server.ts` / `client.ts`) is the canonical @supabase/ssr approach. The middleware helper is a third file so middleware.ts stays thin.
- **`types/database.types.ts`:** Generated by `supabase gen types typescript`. Never edited manually. Re-run after each migration.

---

## Architectural Patterns

### Pattern 1: Supabase SSR Middleware with @supabase/ssr

**What:** A single `middleware.ts` at the project root calls `updateSession()` on every request. This refreshes the Supabase JWT using the refresh token stored in the cookie, then writes the new access token back into the response cookie. Route protection is a secondary concern of the same middleware.

**When to use:** Always. Session refresh must happen at the middleware layer so that Server Components and Route Handlers see a valid, non-expired session on every request.

**Trade-offs:** Middleware runs on every matched route (including `_next/static` if misconfigured). The matcher config must explicitly exclude static assets and images. Middleware uses the Edge Runtime by default on Vercel — the `@supabase/ssr` library is Edge-compatible.

**Implementation:**

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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — MUST happen before any redirect logic
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth')
  const isProtectedRoute = pathname.startsWith('/dashboard') ||
    pathname.startsWith('/yesterday') ||
    pathname.startsWith('/analytics')

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
            // Called from Server Component — cookie writes are silently ignored
            // (only middleware can write cookies)
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

**Critical detail:** The middleware `setAll` must write cookies to BOTH the request and the new `supabaseResponse` object. If you write only to the request, the client never receives the refreshed token. This is the most common @supabase/ssr misconfiguration.

---

### Pattern 2: Gemini Structured Output with Zod Validation Fallback

**What:** The `/api/parse-food` route handler calls Gemini 2.5 Flash with `responseMimeType: "application/json"` and `responseSchema` set to a JSON Schema object. The response is then independently validated with Zod. The responseSchema instruction to Gemini reduces parse failures; Zod validation catches any schema drift that Gemini introduces.

**When to use:** All Gemini calls in this app. Never trust LLM output without schema validation.

**Trade-offs:** Using both `responseSchema` + Zod is defense-in-depth. The primary failure mode is Gemini returning a valid JSON structure but with `null` where a number is expected, or adding extra fields. Zod's `.safeParse()` surfaces these without throwing.

**Error handling tiers:**
1. Gemini API call fails (network, quota, invalid key) → catch block → 503 response
2. Gemini returns non-JSON despite `responseMimeType` → JSON.parse throws → 422 response
3. Gemini JSON fails Zod schema → validation error → 422 response with structured error detail
4. Gemini JSON passes Zod but confidence is universally zero → return data with warning flag (still 200; let the UI communicate uncertainty)

```typescript
// lib/gemini/schemas.ts
import { z } from 'zod'

export const FoodItemSchema = z.object({
  name: z.string(),
  quantity: z.string(),          // "2 katoris", "1 medium bowl"
  calories: z.number().int().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  fiber_g: z.number().nonnegative(),
  confidence: z.enum(['high', 'medium', 'low']),
})

export const ParsedMealSchema = z.object({
  items: z.array(FoodItemSchema).min(1),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  meal_type_confidence: z.enum(['high', 'medium', 'low']),
  raw_text: z.string(),
})

export type FoodItem = z.infer<typeof FoodItemSchema>
export type ParsedMeal = z.infer<typeof ParsedMealSchema>
```

```typescript
// app/api/parse-food/route.ts
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { callGeminiParse } from '@/lib/gemini/parse'
import { ParsedMealSchema } from '@/lib/gemini/schemas'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: { text: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.text?.trim()) {
    return Response.json({ error: 'text is required' }, { status: 400 })
  }

  let rawResult: unknown
  try {
    rawResult = await callGeminiParse(body.text)
  } catch (err) {
    console.error('[parse-food] Gemini call failed:', err)
    return Response.json({ error: 'LLM service unavailable' }, { status: 503 })
  }

  const parsed = ParsedMealSchema.safeParse(rawResult)
  if (!parsed.success) {
    console.error('[parse-food] Schema validation failed:', parsed.error.flatten())
    return Response.json(
      { error: 'LLM returned unexpected format', detail: parsed.error.flatten() },
      { status: 422 }
    )
  }

  return Response.json(parsed.data)
}
```

---

### Pattern 3: LogFlow Finite State Machine with useReducer

**What:** The entire log-and-correct flow is a single Client Component (`LogFlow`) that holds all transient UI state in a `useReducer`. The state machine has explicit, exhaustive states. Child components receive state slices + dispatch — they never manage their own async loading state for items.

**When to use:** Whenever a UI flow has >3 possible states with interdependencies. The correction panel has 8+ states; useState booleans would create impossible state combinations.

**Trade-offs:** More boilerplate than useState chains. The explicit type union makes invalid states unrepresentable.

```typescript
// components/log-flow/log-flow.types.ts
import type { FoodItem, ParsedMeal } from '@/lib/gemini/schemas'

export type LogFlowState =
  | { phase: 'idle' }
  | { phase: 'recording' }
  | { phase: 'parsing'; transcript: string }
  | { phase: 'confirming'; meal: ParsedMeal; reestimatingItemIndex: number | null }
  | { phase: 'saving'; meal: ParsedMeal }
  | { phase: 'saved'; mealId: string }
  | { phase: 'error'; message: string; retryable: boolean }

export type LogFlowAction =
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING'; transcript: string }
  | { type: 'PARSE_COMPLETE'; meal: ParsedMeal }
  | { type: 'PARSE_FAILED'; message: string }
  | { type: 'EDIT_ITEM'; index: number; field: keyof FoodItem; value: string | number }
  | { type: 'DELETE_ITEM'; index: number }
  | { type: 'ADD_ITEM' }
  | { type: 'START_REESTIMATE'; index: number }
  | { type: 'REESTIMATE_COMPLETE'; index: number; item: FoodItem }
  | { type: 'REESTIMATE_FAILED'; index: number; message: string }
  | { type: 'CHANGE_MEAL_TYPE'; mealType: ParsedMeal['meal_type'] }
  | { type: 'CONFIRM_SAVE' }
  | { type: 'SAVE_COMPLETE'; mealId: string }
  | { type: 'SAVE_FAILED'; message: string }
  | { type: 'RESET' }

export function logFlowReducer(state: LogFlowState, action: LogFlowAction): LogFlowState {
  switch (action.type) {
    case 'START_RECORDING':
      return { phase: 'recording' }
    case 'STOP_RECORDING':
      return { phase: 'parsing', transcript: action.transcript }
    case 'PARSE_COMPLETE':
      return { phase: 'confirming', meal: action.meal, reestimatingItemIndex: null }
    case 'PARSE_FAILED':
      return { phase: 'error', message: action.message, retryable: true }
    case 'EDIT_ITEM': {
      if (state.phase !== 'confirming') return state
      const items = [...state.meal.items]
      items[action.index] = { ...items[action.index], [action.field]: action.value }
      return { ...state, meal: { ...state.meal, items } }
    }
    case 'DELETE_ITEM': {
      if (state.phase !== 'confirming') return state
      const items = state.meal.items.filter((_, i) => i !== action.index)
      return { ...state, meal: { ...state.meal, items } }
    }
    case 'START_REESTIMATE': {
      if (state.phase !== 'confirming') return state
      return { ...state, reestimatingItemIndex: action.index }
    }
    case 'REESTIMATE_COMPLETE': {
      if (state.phase !== 'confirming') return state
      const items = [...state.meal.items]
      items[action.index] = action.item
      return { ...state, meal: { ...state.meal, items }, reestimatingItemIndex: null }
    }
    case 'REESTIMATE_FAILED': {
      if (state.phase !== 'confirming') return state
      return { ...state, reestimatingItemIndex: null }
    }
    case 'CHANGE_MEAL_TYPE': {
      if (state.phase !== 'confirming') return state
      return { ...state, meal: { ...state.meal, meal_type: action.mealType } }
    }
    case 'CONFIRM_SAVE': {
      if (state.phase !== 'confirming') return state
      return { phase: 'saving', meal: state.meal }
    }
    case 'SAVE_COMPLETE':
      return { phase: 'saved', mealId: action.mealId }
    case 'SAVE_FAILED':
      return { phase: 'error', message: action.message, retryable: false }
    case 'RESET':
      return { phase: 'idle' }
    default:
      return state
  }
}
```

`LogFlow.tsx` runs all async effects (fetch to `/api/parse-food`, fetch to `/api/reestimate-item`, POST to `/api/meals`) in `useEffect` blocks that watch `state.phase`. This is the only place side effects run. `ConfirmationPanel` is a pure presentational component that receives `state.meal`, `state.reestimatingItemIndex`, and `dispatch`.

---

### Pattern 4: SWR for Dashboard Data + Mutation-Triggered Revalidation

**What:** The dashboard Client Components (`DailySummary`, `MealList`) use `useSWR` to fetch meals for a given date. After `LogFlow` saves a meal (SAVE_COMPLETE), it calls `mutate()` to trigger revalidation of the meals key. No page reload needed.

**When to use:** Any data that needs to update after a user action without a full navigation.

**Trade-offs:** SWR adds ~8KB to the client bundle. For a 2-user personal app, Supabase Realtime subscriptions would also work but are harder to test and add complexity. SWR pull-on-mutate is simpler and sufficient.

```typescript
// Key convention — must be consistent across all useSWR calls for the same data
const MEALS_KEY = (date: string) => `/api/meals?date=${date}`

// In DailySummary.tsx and MealList.tsx
const { data: meals, isLoading } = useSWR(MEALS_KEY(today), fetcher)

// In LogFlow.tsx — after SAVE_COMPLETE
import { mutate } from 'swr'

// Inside the useEffect that handles phase === 'saved':
mutate(MEALS_KEY(today))   // triggers revalidation in all components using this key
```

For the post-save inline edit (FR-011), `MealCard` uses `useSWRMutation` to send a PATCH to `/api/meals` and then calls `mutate(MEALS_KEY(date))` to refresh. The undo toast stores the original data locally and re-PATCHes if the user clicks undo within 5 seconds.

---

## Data Flow

### Primary Flow: Voice Input → LLM Parse → Correction → Database → Dashboard

```
User speaks (Web Speech API)
    ↓ transcript string
LogFlow dispatch(STOP_RECORDING + transcript)
    ↓ state.phase = 'parsing'
[useEffect] POST /api/parse-food { text: transcript }
    ↓
/api/parse-food Route Handler
    ├── verifySession() via Supabase server client
    ├── callGeminiParse(text)
    │       ├── Google Gemini 2.5 Flash
    │       │   responseMimeType: "application/json"
    │       │   responseSchema: FoodItemSchema[]
    │       └── returns raw JSON string
    ├── JSON.parse(rawJson)
    ├── ParsedMealSchema.safeParse(parsed)
    └── Response.json(parsed.data) or 422/503
    ↓
LogFlow dispatch(PARSE_COMPLETE + meal)
    ↓ state.phase = 'confirming'
ConfirmationPanel renders (editable item list)
    ↓ user edits / re-estimates / accepts
LogFlow dispatch(CONFIRM_SAVE)
    ↓ state.phase = 'saving'
[useEffect] POST /api/meals { meal }
    ↓
/api/meals Route Handler
    ├── verifySession()
    ├── INSERT INTO meal_logs (user_id, logged_at, meal_type, food_items JSONB,
    │     total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g)
    └── Response.json({ id })
    ↓
LogFlow dispatch(SAVE_COMPLETE + mealId)
    ↓
mutate(MEALS_KEY(today))
    ↓
DailySummary + MealList re-fetch → dashboard updates
```

### Re-estimation Flow (per item)

```
User clicks "Re-estimate" on FoodItemRow
    ↓
LogFlow dispatch(START_REESTIMATE + index)
    ↓ state.reestimatingItemIndex = index (spinner appears on that row only)
[useEffect] POST /api/reestimate-item { item: state.meal.items[index] }
    ↓
/api/reestimate-item Route Handler
    ├── callGeminiReestimate(item)  ← targeted prompt: "re-estimate for: [item.quantity] [item.name]"
    ├── FoodItemSchema.safeParse(result)
    └── Response.json(updatedItem) or 422
    ↓
LogFlow dispatch(REESTIMATE_COMPLETE + index + item)
    ↓ items[index] replaced in state.meal; spinner clears
```

### State Management Summary

```
LogFlowState (useReducer in LogFlow.tsx)
    ↓ props + dispatch
ConfirmationPanel → FoodItemRow (per item)

SWR Cache (global, keyed by date)
    ↓ useSWR
DailySummary, MealList, MealCard
    ↑ mutate(key)
LogFlow (on SAVE_COMPLETE), MealCard (on PATCH complete)
```

---

## Database Design

### Schema

```sql
-- users table (mirrors Supabase auth.users; extended for goals)
CREATE TABLE user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
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
  food_items       JSONB NOT NULL,        -- array of FoodItem objects
  total_calories   INTEGER NOT NULL,
  total_protein_g  NUMERIC(6,1) NOT NULL,
  total_carbs_g    NUMERIC(6,1) NOT NULL,
  total_fat_g      NUMERIC(6,1) NOT NULL,
  total_fiber_g    NUMERIC(6,1) NOT NULL,
  raw_transcript   TEXT,
  is_edited        BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX meal_logs_user_date ON meal_logs (user_id, logged_at);
```

### JSONB Query Patterns

**Daily totals (for dashboard `DailySummary`):**
```sql
-- Pre-aggregated totals are stored as columns — NO JSONB traversal needed for totals.
-- The total_* columns are computed at save time by the API route from the items array.
-- This is intentional: JSONB aggregation on every dashboard load would be wasteful.

SELECT
  SUM(total_calories)   AS calories,
  SUM(total_protein_g)  AS protein_g,
  SUM(total_carbs_g)    AS carbs_g,
  SUM(total_fat_g)      AS fat_g,
  SUM(total_fiber_g)    AS fiber_g
FROM meal_logs
WHERE user_id = $1
  AND logged_at >= $2::date     -- e.g. '2026-06-09'
  AND logged_at <  $3::date;    -- e.g. '2026-06-10'
```

**Weekly analytics (7-day calorie bar chart):**
```sql
SELECT
  DATE(logged_at AT TIME ZONE 'UTC') AS day,
  SUM(total_calories)                AS calories,
  SUM(total_protein_g)               AS protein_g,
  SUM(total_carbs_g)                 AS carbs_g,
  SUM(total_fat_g)                   AS fat_g
FROM meal_logs
WHERE user_id = $1
  AND logged_at >= NOW() - INTERVAL '7 days'
GROUP BY day
ORDER BY day;
```

**JSONB is only queried when editing a specific meal entry (FR-011) to display per-item breakdown:**
```sql
SELECT food_items FROM meal_logs WHERE id = $1 AND user_id = $2;
```

**Why store totals as columns AND JSONB:** The JSONB `food_items` column is the source of truth for the per-item breakdown shown in the edit UI. Pre-aggregated columns (`total_calories`, etc.) avoid expensive JSONB aggregation on every dashboard render. The trade-off is that the API route must compute and store both on every save/edit.

### RLS Policies

```sql
ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own meals" ON meal_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own profile" ON user_profiles
  FOR ALL USING (auth.uid() = id);
```

---

## Integration Points

### External Services

| Service | Integration Pattern | Key Constraints |
|---------|---------------------|-----------------|
| Gemini 2.5 Flash | Server-only via `@google/generative-ai` SDK; `GEMINI_API_KEY` env var (no `NEXT_PUBLIC_` prefix) | Key must never reach client bundle; all calls in Route Handlers |
| Supabase Auth | Google OAuth via `supabase.auth.signInWithOAuth({ provider: 'google' })`; callback at `/auth/callback/route.ts` exchanges code for session | Redirect URL must be registered in Google Cloud Console AND Supabase dashboard |
| Supabase Postgres | Via `@supabase/ssr` server client in Route Handlers and Server Components; RLS enforced at DB level | Use service role key ONLY in migrations, never in application code |
| Web Speech API | Browser-only; feature-detected on mount with `'SpeechRecognition' in window`; mic button hidden if unavailable | iOS Safari requires user gesture; Chrome requires HTTPS |
| Vercel | Deploy via Git push; `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in Vercel environment settings | Free tier: 100GB bandwidth, 100 serverless function invocations/day on Hobby |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Server Component → Client Component | Props (must be JSON-serializable) | Cannot pass functions or class instances |
| Client Component → API Route | `fetch()` POST/GET/PATCH | Always check response status; never assume 200 |
| LogFlow → ConfirmationPanel | Props + dispatch function | dispatch is stable (from useReducer) — safe to pass as prop |
| SWR → Dashboard Components | Shared cache key string | Key must be identical across all `useSWR` calls for the same resource |
| Route Handler → Gemini | `callGeminiParse()` / `callGeminiReestimate()` lib functions | Wrapped in try/catch; Zod validated before returning to caller |

---

## Build Order Implications

The dependency graph dictates this implementation order:

**Phase 1 — Foundation (must exist before anything else):**
1. Supabase project: tables, RLS, auth config (Google OAuth)
2. `lib/supabase/server.ts`, `lib/supabase/client.ts`, `middleware.ts`
3. `lib/dal.ts` (verifySession)
4. Auth flow: `/login/page.tsx`, `/auth/callback/route.ts`
5. Database types: `supabase gen types typescript`

**Phase 2 — LLM Core (must exist before the log UI):**
1. `lib/gemini/schemas.ts` (Zod schemas) — needed by Route Handlers AND typed in the FSM
2. `lib/gemini/prompts.ts` + `lib/gemini/parse.ts` — the actual Gemini call wrappers
3. `/api/parse-food/route.ts` — test manually with curl before building UI
4. `/api/reestimate-item/route.ts`

**Phase 3 — Log Flow UI (depends on Phase 1 + 2):**
1. `log-flow.types.ts` + `logFlowReducer` — pure logic, testable without React
2. `LogFlow.tsx` (useReducer wiring, useEffect for API calls)
3. `VoiceInput.tsx` + `TextInput.tsx`
4. `ConfirmationPanel.tsx` + `FoodItemRow.tsx`
5. `/api/meals/route.ts` (POST save)

**Phase 4 — Dashboard (depends on Phase 1 + 3):**
1. SWR setup (SWRConfig in root layout)
2. `DailySummary.tsx`, `MealList.tsx`, `MealCard.tsx`
3. `/app/(app)/dashboard/page.tsx` (Server Component shell)
4. Post-save inline edit + undo toast (FR-011)

**Phase 5 — Secondary pages (depends on Phase 4):**
1. `/app/(app)/yesterday/page.tsx` (reuses dashboard components with different date)
2. `lib/analytics.ts` (pure functions: weeklyTotals, macroFlags)
3. `CalorieBarChart.tsx`, `MacroFlagBanner.tsx`
4. `/app/(app)/analytics/page.tsx`

**Phase 6 — Goals:**
1. `user_profiles` table usage (already created in Phase 1)
2. `/api/goals/route.ts` (GET + PUT)
3. Goals settings UI (can be a modal or a dedicated page)

---

## Anti-Patterns

### Anti-Pattern 1: Calling Gemini from Client Components

**What people do:** Create a client-side function that posts directly to the Gemini API using a key stored in `NEXT_PUBLIC_GEMINI_API_KEY`.

**Why it's wrong:** The API key is exposed in the browser's network tab, in the client JS bundle, and in any code inspection tool. Anyone can steal it and consume your quota.

**Do this instead:** All Gemini calls go through Next.js Route Handlers (`/api/parse-food`, `/api/reestimate-item`). `GEMINI_API_KEY` is a server-only environment variable — no `NEXT_PUBLIC_` prefix, ever.

---

### Anti-Pattern 2: Trusting Gemini Output Without Validation

**What people do:** `const data = JSON.parse(geminiResponse.text())` then immediately use `data.items[0].calories`.

**Why it's wrong:** Gemini may return a valid JSON but with the wrong shape, null fields, or extra nesting. This causes silent runtime errors that are hard to debug. For Indian home-cooked food (the primary use case), confidence variance is expected — the schema must tolerate this gracefully.

**Do this instead:** Always `ParsedMealSchema.safeParse(rawData)`. On failure, log the parse error with the raw Gemini response and return a structured 422 error to the UI. The UI shows "Couldn't parse your input — please try again or type manually."

---

### Anti-Pattern 3: Managing LogFlow State with Multiple useState Booleans

**What people do:** `const [isLoading, setIsLoading] = useState(false)`, `const [isConfirming, setIsConfirming] = useState(false)`, `const [isSaving, setIsSaving] = useState(false)` — 6+ booleans that can be in impossible combinations (isLoading + isConfirming = true simultaneously).

**Why it's wrong:** As the flow grows (add re-estimation loading per item), the combinatorial state explosion makes bugs inevitable. Impossible states become reachable.

**Do this instead:** Use a `useReducer` with a discriminated union type for `LogFlowState`. The TypeScript compiler enforces that each `phase` can only have its own fields. Rendering is a switch statement on `state.phase`.

---

### Anti-Pattern 4: Fetching Data in Client Components via Direct Supabase SDK

**What people do:** `const supabase = createBrowserClient(...)` then `supabase.from('meal_logs').select(...)` directly in a dashboard Client Component.

**Why it's wrong:** It bypasses the API layer, making it impossible to add server-side business logic (totals computation, date normalization). It also requires the anon key to be exposed, which is fine for Supabase (anon key is public by design) but creates a coupling: RLS policy changes must now account for what the browser client can query directly.

**Do this instead:** Client Components fetch via Route Handlers (`/api/meals?date=...`) using SWR. Route Handlers use the server Supabase client. RLS is the security layer; the Route Handler is the API contract layer. This separation makes testing and future changes easier.

---

### Anti-Pattern 5: Checking Auth Only in Middleware

**What people do:** Put all auth logic in `middleware.ts` and assume pages/routes are safe because middleware ran.

**Why it's wrong:** Middleware is an optimistic guard for redirects. Route Handlers are publicly callable API endpoints — anyone can POST to `/api/meals` from curl even if middleware redirected a browser request. Next.js docs explicitly state: middleware is not a sufficient security boundary for data.

**Do this instead:** Every Route Handler calls `verifySession()` (or the equivalent `supabase.auth.getUser()` check) as its first action. Return 401 immediately if the user is not authenticated. Middleware handles UX redirects; Route Handlers enforce data security.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 2 users (current) | Single Supabase project, free tier; no caching layer needed; Gemini free tier likely sufficient |
| 10-50 users | Same architecture; monitor Gemini API costs; Supabase free tier storage limit (500MB) becomes concern after ~12 months |
| 100+ users | Add Vercel KV for rate limiting per user on `/api/parse-food`; consider Gemini batch requests; Supabase Pro tier for connection pooling |

### Scaling Priorities

1. **First bottleneck:** Gemini API rate limits (60 req/min free tier). For 2 users logging 3-5 meals/day, this is not a concern in V1. Add per-user rate limiting in middleware before any public launch.
2. **Second bottleneck:** Supabase free tier connection limit (60 connections). Vercel serverless functions each open a new connection. Add Supabase connection pooling (PgBouncer, enabled in Supabase dashboard) if serverless invocations spike.

---

## Sources

- Next.js App Router: Server and Client Components — https://nextjs.org/docs/app/getting-started/server-and-client-components (verified 2026-05-13, version 16.2.7)
- Next.js Authentication Guide — https://nextjs.org/docs/app/guides/authentication (verified 2026-03-03)
- Next.js Route Handlers — https://nextjs.org/docs/app/api-reference/file-conventions/route (verified 2026-03-03)
- @supabase/ssr package: createServerClient / createBrowserClient cookie patterns — training knowledge (package stable since 2023-Q4; replaces deprecated @supabase/auth-helpers-nextjs; confidence HIGH based on official Supabase migration guides reviewed during training)
- Gemini 2.5 Flash structured output (responseMimeType + responseSchema) — training knowledge, confidence HIGH (feature released 2024-Q2, stable in @google/generative-ai SDK)
- SWR useSWR + mutate() pattern — training knowledge, confidence HIGH (SWR API stable since v2.0, 2022)
- Postgres JSONB aggregation patterns — training knowledge, confidence HIGH (standard SQL + Postgres JSONB operators, no version drift)

---
*Architecture research for: NomLog — LLM-powered voice food logging app*
*Researched: 2026-06-09*
