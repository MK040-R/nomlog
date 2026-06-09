---
phase: 01-foundation
plan: 01
subsystem: database
tags: [nextjs, tailwind, supabase, typescript, postgresql, rls, pnpm]

# Dependency graph
requires: []
provides:
  - Next.js 16.2.7 project scaffold with TypeScript and App Router
  - Tailwind v4 CSS-only design system (Nomlog color tokens, typography, utilities)
  - Supabase schema migration: user_profiles + meal_logs with RLS
  - Database TypeScript types (Database, FoodItem, MealType)
  - Supabase SSR client factories (server, client, middleware)
  - Data Access Layer with verifySession() and getCurrentUser()
  - scripts/check-secrets.sh CI guard for Gemini key leaks
affects: [01-02, 02-gemini-parsing, 02-auth-ui, 03-voice, 04-dashboard]

# Tech tracking
tech-stack:
  added:
    - next@16.2.7
    - react@19.2.4
    - "@supabase/ssr@0.12.0"
    - "@supabase/supabase-js@2.108.0"
    - tailwindcss@4.3.0
    - "@tailwindcss/postcss@4.3.0"
    - zod@4.4.3
    - "@google/genai@2.8.0"
    - server-only@0.0.1
    - swr@2.4.1
    - typescript@6.0.3
  patterns:
    - Tailwind v4 CSS-only config via @theme{} in globals.css (no tailwind.config.js)
    - Three-file Supabase SSR pattern (server/client/middleware)
    - React cache() for per-request getUser() memoization in DAL
    - server-only import guard on all server-side Supabase clients

key-files:
  created:
    - app/globals.css
    - app/layout.tsx
    - supabase/migrations/0001_initial_schema.sql
    - types/database.types.ts
    - types/app.types.ts
    - lib/supabase/server.ts
    - lib/supabase/client.ts
    - lib/supabase/middleware.ts
    - lib/dal.ts
    - scripts/check-secrets.sh
    - .env.example
  modified:
    - package.json
    - postcss.config.mjs
    - next.config.ts
    - .gitignore
    - pnpm-workspace.yaml

key-decisions:
  - "Space Grotesk supports max weight 700 (not 800 as in design spec) — loaded weights 300-700"
  - "Turbopack root set to project directory to suppress workspace root warning from parent package-lock.json"
  - "Migration is pending manual supabase db push — Supabase CLI not configured during scaffold"
  - "pnpm-workspace.yaml onlyBuiltDependencies set for sharp and unrs-resolver to unblock install"

patterns-established:
  - "Tailwind v4: all design tokens in @theme{} block in globals.css, no config file"
  - "Supabase server client: async createClient() with server-only guard"
  - "Supabase browser client: sync createClient() without server-only (browser-safe)"
  - "Auth: always getUser() server-side, never getSession() (unverified cookies)"
  - "DAL: verifySession() wrapped in React cache() — single network call per request"

requirements-completed: [AUTH-04, AUTH-05]

# Metrics
duration: 8min
completed: 2026-06-09
---

# Phase 1 Plan 01: Scaffold, Schema, and Factories Summary

**Next.js 16 scaffold with full Nomlog design system, Supabase SSR client factories typed against hand-crafted Database types, and meal_logs/user_profiles schema with auth.uid() RLS policies**

## Performance

- **Duration:** 8 minutes
- **Started:** 2026-06-09T15:51:21Z
- **Completed:** 2026-06-09T15:59:00Z
- **Tasks:** 3
- **Files modified:** 22

## Accomplishments

- Scaffolded Next.js 16.2.7 with TypeScript, App Router, and all pinned dependencies installed
- Applied full Nomlog design system as Tailwind v4 CSS tokens (tomato, mustard, plum, avocado palette + typography + motion)
- Created Supabase migration with user_profiles + meal_logs tables, RLS enabled with auth.uid() = user_id policies (not IS NOT NULL)
- Generated hand-written Database TypeScript types accurate to the schema + app domain types (FoodItem, MealType, Confidence, InputSource)
- Wired three-file Supabase SSR pattern: server factory (cookie-aware + server-only), browser factory (localStorage), middleware (three-step setAll for token refresh)
- DAL with verifySession() wrapped in React cache() for per-request deduplication
- CI check script for Gemini key leak detection post-build

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js 16 with design system and pinned deps** - `03803ed` (chore)
2. **Task 2: Create Supabase schema migration and TypeScript types** - `202beb4` (feat)
3. **Task 3: Add Supabase SSR client factories and Data Access Layer** - `b0a9d74` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `app/globals.css` - Full Nomlog design system: @theme{} with all color tokens, typography variables, utility classes (.nom-data, .nom-eyebrow)
- `app/layout.tsx` - Root layout loading Space Grotesk, Plus Jakarta Sans, Roboto Mono via next/font
- `supabase/migrations/0001_initial_schema.sql` - user_profiles + meal_logs schema with RLS + composite index
- `types/database.types.ts` - Database type with meal_logs and user_profiles Row/Insert/Update shapes
- `types/app.types.ts` - FoodItem, MealType, Confidence, InputSource domain types
- `lib/supabase/server.ts` - Server-side createClient() with server-only guard and cookie handling
- `lib/supabase/client.ts` - Browser createClient() using createBrowserClient
- `lib/supabase/middleware.ts` - updateSession() with three-step setAll pattern
- `lib/dal.ts` - verifySession() and getCurrentUser() with server-only + React cache()
- `scripts/check-secrets.sh` - CI script checking .next/static for GEMINI_API_KEY / AIza patterns
- `.env.example` - Supabase + Gemini + site URL schema committed to git
- `package.json` - All pinned deps + check:secrets script
- `next.config.ts` - Turbopack root set to avoid workspace root warning
- `.gitignore` - Explicit .env/.env.local/.env*.local exclusions with !.env.example exception

## Decisions Made

- Space Grotesk maximum available weight is 700, not 800 as in the design spec — loaded 300-700
- Turbopack root configured to silence "multiple lockfiles" warning from parent-level package-lock.json
- Migration is pending manual `supabase db push` — Supabase CLI not configured; hand-written type stub committed instead of auto-generated
- pnpm-workspace.yaml `onlyBuiltDependencies` configured for sharp/unrs-resolver to unblock pnpm install

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Space Grotesk weight 800 unavailable in next/font**
- **Found during:** Task 1 (scaffold + layout.tsx)
- **Issue:** Design system spec lists Space Grotesk at weights 400, 500, 600, 700, 800 — but Google Fonts only offers 300-700 for this font. Build failed with "Unknown weight 800 for font Space Grotesk"
- **Fix:** Changed loaded weights to ['300', '400', '500', '600', '700'] — no visual impact as weight 800 would have been rendered as 700 anyway
- **Files modified:** app/layout.tsx
- **Verification:** pnpm build exits 0 after change
- **Committed in:** 03803ed (Task 1 commit)

**2. [Rule 3 - Blocking] Turbopack workspace root warning**
- **Found during:** Task 1 (first build)
- **Issue:** Next.js detected multiple lockfiles (parent /Users/Murali/package-lock.json + project pnpm-lock.yaml) and selected the wrong root, emitting a build warning
- **Fix:** Added `turbopack: { root: path.resolve(__dirname) }` to next.config.ts
- **Files modified:** next.config.ts
- **Verification:** Warning no longer appears in build output
- **Committed in:** 03803ed (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for build correctness. No scope creep.

## Issues Encountered

- pnpm install initially failed with ERR_PNPM_IGNORED_BUILDS because pnpm-workspace.yaml required selecting whether sharp and unrs-resolver could run build scripts. Fixed by setting `onlyBuiltDependencies` in pnpm-workspace.yaml.
- Project directory name "Nomlog" (capital letters) rejected by create-next-app. Worked around by scaffolding into a temp subdirectory and moving files to project root.

## User Setup Required

External services require manual configuration:

1. **Supabase project**: Create project at supabase.com, get URL and anon key
2. **Apply migration**: Run `supabase db push` or paste `supabase/migrations/0001_initial_schema.sql` into the SQL editor
3. **Environment variables**: Copy `.env.example` to `.env.local` and fill in values:
   - `NEXT_PUBLIC_SUPABASE_URL` - from Supabase Dashboard > Project Settings > API
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - from Supabase Dashboard > Project Settings > API
   - `GEMINI_API_KEY` - from https://aistudio.google.com/apikey (server-side only, no NEXT_PUBLIC_ prefix)
   - `NEXT_PUBLIC_SITE_URL` - set to production URL when deploying (default: http://localhost:3000)

## Next Phase Readiness

- Project compiles and builds with zero TypeScript errors
- All client factory files are in place — Phase 2 (auth wiring + Gemini guard) can start immediately
- Migration SQL is ready to apply — schema will be live once Supabase project is configured
- types/database.types.ts stub will be replaced by auto-generated types after `supabase gen types` runs

---
*Phase: 01-foundation*
*Completed: 2026-06-09*
