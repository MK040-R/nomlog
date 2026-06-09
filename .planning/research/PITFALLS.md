# Pitfalls Research

**Domain:** LLM-powered voice food logging web app (Next.js App Router + Supabase Auth + Gemini 2.5 Flash + Web Speech API)
**Researched:** 2026-06-09
**Confidence:** MEDIUM — drawn from training knowledge of these specific technologies. Web search unavailable. Flags for validation noted per item.

---

## Critical Pitfalls

### Pitfall 1: Gemini API Key Leaks Into the Client Bundle via NEXT_PUBLIC_ or Direct Import

**What goes wrong:**
The Gemini API key ends up in the browser JavaScript bundle. Any user can open DevTools → Sources or Network tab, find the key, and make uncapped API calls at your expense. For a personal project this means surprise billing; the key cannot be rotated without a redeploy.

**Why it happens:**
Three distinct mechanisms cause this:

1. **The `NEXT_PUBLIC_` prefix trap.** Any env var prefixed `NEXT_PUBLIC_` is statically inlined into the client bundle at build time by Next.js. A developer adds `NEXT_PUBLIC_GEMINI_API_KEY` because they see other `NEXT_PUBLIC_SUPABASE_URL` vars and pattern-match incorrectly.

2. **Direct import from a shared util.** A file like `lib/gemini.ts` is created without the `'use server'` directive or `server-only` package guard. A React component imports from it for convenience. Next.js tree-shaking does not reliably exclude server-only modules that are imported by client-touched files — the key is bundled.

3. **Route Handler vs. Server Action confusion.** A developer uses `'use client'` on a form component and calls a function that was meant to be a server action, but the function file lacks the `'use server'` directive at the top. The runtime throws, they move the call inline, and somehow the API key reference gets pulled in.

**How to avoid:**
- Name the key `GEMINI_API_KEY` (no `NEXT_PUBLIC_` prefix). Never give it that prefix even temporarily.
- Install the `server-only` package and add `import 'server-only'` as the first line of `lib/gemini.ts`. This causes a hard build error if the module is ever imported from client code — it cannot silently slip through.
- All Gemini calls go through `app/api/parse-food/route.ts` only. No direct SDK calls from Server Components, even though Server Components run server-side — the pattern is too easy to accidentally refactor later.
- Add a CI check: `grep -r "NEXT_PUBLIC_GEMINI" .` must return empty. Run in `package.json` as a `check:secrets` script.
- Run `next build` and inspect `.next/static/chunks/` with `grep -r "GEMINI_API_KEY" .next/static/` before first deploy. If anything appears, stop.

**Warning signs:**
- Any env var for Gemini has `NEXT_PUBLIC_` prefix in `.env.local` or `.env.example`.
- `lib/gemini.ts` is imported from a file that does not have `'use server'` at the top.
- `typeof window` checks wrap Gemini SDK instantiation — defensive coding that signals the import is reachable from client context.

**Phase to address:** Phase 1 (project scaffolding / auth foundation). Must be locked before any Gemini code is written. The `server-only` guard and route handler skeleton should be the first Gemini-related files committed.

---

### Pitfall 2: Supabase RLS Policies That Pass Single-User Testing but Silently Expose Multi-User Data

**What goes wrong:**
With one test account, all RLS policies appear to work — your data shows up, actions succeed. The second user (the partner) logs in and can read or write the first user's meal log entries. The gap is invisible until you explicitly test with two authenticated sessions.

**Why it happens:**
The most common gap is a policy that checks `auth.uid() IS NOT NULL` (is any user logged in?) instead of `auth.uid() = user_id` (is this the owner?). This passes single-user testing because the only logged-in user is also the owner.

A subtler variant: the `user_id` column exists on `meal_log_entries` but is missing from a `nutrition_goals` table added later, so goals are unscoped — any authenticated user can read any user's goals.

The third variant: an INSERT policy requires `auth.uid() = user_id` but the application code sets `user_id` from the request body rather than from the server. An attacker supplies a different user's UUID and the insert succeeds.

**How to avoid:**
- Every table with user data gets `user_id uuid NOT NULL REFERENCES auth.users(id)` as a non-nullable FK.
- RLS template for every table:
  ```sql
  -- SELECT
  CREATE POLICY "users_own_data" ON meal_log_entries
    FOR SELECT USING (auth.uid() = user_id);

  -- INSERT: force server-side user_id, not client-supplied
  CREATE POLICY "users_insert_own" ON meal_log_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

  -- UPDATE / DELETE: same pattern
  ```
- The INSERT policy `WITH CHECK (auth.uid() = user_id)` combined with setting `user_id` in the API route (not from the request body) is the correct two-layer defense.
- Write a mandatory two-account smoke test: create two test Google accounts, log meals from each, confirm neither can read the other's data via direct Supabase client calls. This must run before the second real user is added.
- Enable `ENABLE ROW LEVEL SECURITY` on every table and set `ALTER TABLE x FORCE ROW LEVEL SECURITY` so even the table owner role is subject to policies during testing.

**Warning signs:**
- Supabase Studio shows a table with RLS disabled (the shield icon is red).
- Any policy using `auth.uid() IS NOT NULL` as the sole condition.
- Any table added during development that lacks a `user_id` column.
- `user_id` is set from `req.body.userId` in an API route.

**Phase to address:** Phase 1 (auth + data model). Write RLS policies on the same day as the schema migration. Do not defer; schema without RLS is a debt that is easy to forget.

---

### Pitfall 3: Supabase Auth Cookie/Session Breaks in Next.js App Router Middleware

**What goes wrong:**
The middleware that refreshes Supabase sessions runs, but `cookies()` from `next/headers` and the middleware `request.cookies` object are out of sync. The user is authenticated in the middleware but unauthenticated inside a Server Component, or vice versa. This manifests as random 401s on page load, redirect loops on the dashboard, or stale session data appearing after logout.

**Why it happens:**
Next.js App Router requires using `@supabase/ssr` (not the old `@supabase/auth-helpers-nextjs`) with the correct cookie adapter pattern. The common mistake is mixing the two packages — using `createServerClient` from `@supabase/ssr` in some places and `createServerComponentClient` from the deprecated helpers in others. The middleware must both read AND write cookies using the `getAll`/`setAll` pattern to persist the refreshed token; if only `get` is implemented, the refreshed session is lost on the next request.

A secondary cause: the middleware `matcher` config excludes too many paths (`/api/*` is excluded to avoid overhead), which means API routes that call `supabase.auth.getUser()` see an expired session even though the browser has a valid cookie.

**How to avoid:**
- Use `@supabase/ssr` exclusively. Remove `@supabase/auth-helpers-nextjs` entirely if it was ever installed.
- Copy the exact middleware template from the official Supabase Next.js SSR guide verbatim. The `setAll` cookie handler in middleware is non-optional.
- The middleware matcher must include `/api/:path*` for auth routes. Exclude only truly public static assets (`/_next/static`, `/_next/image`, `/favicon.ico`).
- Use `supabase.auth.getUser()` (not `getSession()`) in Server Components. `getSession()` reads from the cookie without server-side validation and can return stale data; `getUser()` makes a network call to validate.

**Warning signs:**
- Import of `createServerComponentClient` from `@supabase/auth-helpers-nextjs` in any file.
- Middleware that calls `response.cookies.set` but not in the `setAll` pattern.
- `getSession()` calls in Server Components or API routes.
- Auth state works on hard refresh but breaks on soft navigation.

**Phase to address:** Phase 1 (auth setup). Get this right once with an official reference implementation; do not improvise.

---

### Pitfall 4: Gemini Structured Output Fails Silently on Unsupported Schema Features

**What goes wrong:**
The `responseMimeType: 'application/json'` with `responseSchema` configuration returns a response that Gemini forces into valid JSON but the schema constraints are silently dropped. Fields marked as required may be absent. Enum values outside the schema may appear. The Zod parse succeeds for the happy path but throws on edge cases because the schema you sent to Gemini differs from what Gemini actually enforced.

**Why it happens:**
Gemini's structured output implementation does not support the full JSON Schema spec. Known unsupported features (as of mid-2025, MEDIUM confidence):
- `oneOf` / `anyOf` / `allOf` combiners
- `$ref` (schema references)
- Recursive schemas
- `format` constraints (e.g., `format: "date-time"`)
- `additionalProperties: false` (may be ignored)
- `default` values (ignored — Gemini fills or omits, not defaults)
- Union types in strongly-typed SDKs (must be expressed as nullable, not as union)

When these features are used, Gemini either ignores the constraint or falls back to unstructured output. The response is still valid JSON but does not match your Zod schema.

**How to avoid:**
- Keep the response schema flat and explicit. Use only: `string`, `number`, `integer`, `boolean`, `array`, `object`, `enum` (as `type: string` with explicit `enum` array), and `nullable: true`.
- Do not use `$ref`, `allOf`, `oneOf`. Inline all definitions.
- Zod schema must be the source of truth. Generate the Gemini `responseSchema` from the Zod schema using `zod-to-json-schema` with the `target: 'jsonSchema7'` option, then manually audit the output for unsupported features.
- After Gemini returns, parse with Zod using `.safeParse()`, not `.parse()`. On failure, log the raw response and the Zod error, then fall back to a graceful error state (do not crash the request).
- Write a test fixture for each food type variant (simple English, Hinglish, ambiguous portion) and assert Zod parse success before shipping.

**Warning signs:**
- Schema uses `$ref`, `allOf`, `oneOf`, `anyOf`, or `default`.
- Zod schema uses `.union()`, `.discriminatedUnion()`, or `.transform()` in the part mirrored to Gemini.
- Parse errors appear only on specific food inputs, not on simple test cases.
- `confidence` field comes back as a string ("high") instead of a number (0.8) unexpectedly.

**Phase to address:** Phase 1/2 (Gemini API route + prompt engineering). The schema must be validated against 20+ Indian food inputs (as required by PROJECT.md) before any logging UI is built.

---

### Pitfall 5: LLM Re-Estimation Losing Meal Context and Producing Inconsistent Totals

**What goes wrong:**
When the user triggers per-item re-estimation (FR-010 correction panel), the API call sends only the single item text (e.g., "2 rotis") without the surrounding meal context. The LLM estimates the item in isolation — often producing a different calorie figure than the original parse that had "lunch with dal, sabzi, 2 rotis, and rice" as context. The running total jumps up or down unexpectedly and users lose trust.

A related failure: after re-estimation, the confidence score for the re-estimated item is inconsistent with the scale used by the original parse. The original parse used 0-1 numeric confidence; the re-estimation prompt returns "medium" as a string. The UI renders `NaN%`.

**Why it happens:**
The re-estimation prompt is written independently of the original parse prompt, without sharing a system prompt or output schema. Developers optimize the re-estimation prompt for the single-item case and forget that meal context matters for portion estimation ("2 rotis" at lunch after a full meal vs. as a standalone snack).

**How to avoid:**
- Re-estimation API route receives: the specific item text, the full original meal description as context, and an explicit instruction not to re-estimate other items.
- Prompt template: `"From the meal: [original_description]. Re-estimate only this item: [item_text]. Return the same JSON schema as the original parse."`
- The response schema for re-estimation must be identical to the original parse schema (same Zod type, same Gemini responseSchema object). Use the same exported constant.
- Unit test: same item re-estimated with vs. without meal context should produce values within 20% of each other.

**Warning signs:**
- Re-estimation and parse share no code — they are completely separate prompt strings.
- Confidence field is a different type between parse result and re-estimation result.
- Calorie total visibly jumps on any re-estimation in the correction panel.

**Phase to address:** Phase 2 (correction panel / FR-010). Before building the re-estimation UI, lock down the shared schema and prompt template.

---

### Pitfall 6: Web Speech API Fires `onresult` Before the User Finishes Speaking

**What goes wrong:**
`SpeechRecognition` fires `onresult` with `isFinal: false` (interim results) as the user speaks. If the developer calls the Gemini API on the first `onresult` event, the user gets feedback from an incomplete sentence. More commonly: the developer listens for any `onresult` with `isFinal: true` but the API fires this mid-sentence during a natural pause (e.g., "I had... [pause]... dal chawal"). Two separate API calls are made; the second one (the actual complete input) fails because the first call is already in-flight.

**Why it happens:**
`SpeechRecognition` has two result types: interim (live, subject to change) and final (the engine is confident this segment is complete). In Chrome, `isFinal: true` can fire after each phrase-level pause, not just at the end of the utterance. Developers assume `isFinal: true` means "user stopped talking" but it means "engine is confident about this segment."

**How to avoid:**
- Always collect interim results and concatenate them; only submit when `onend` fires (the recognition session has ended), not when `isFinal: true` fires.
- Set `recognition.interimResults = true` and maintain a running transcript string updated on each `onresult` event (replace the last result with the new interim/final).
- Debounce the API call: submit only after `onend` + a 300ms delay to allow the user to restart recognition if they want to add more.
- Show the live transcript in the UI so users can see what is being captured before submission.
- Do not call the Gemini API more than once per voice session; cancel any in-flight request if the user starts a new session.

**Warning signs:**
- Multiple Gemini API calls appearing in the Network tab during a single voice input session.
- Gemini API is called from inside the `onresult` handler.
- No debounce or `onend` gating on the API call.

**Phase to address:** Phase 1/2 (voice input component). This must be correct before any Gemini integration is wired to the voice input.

---

### Pitfall 7: Web Speech API Simply Does Not Work on Firefox or iOS Safari (PWA Context)

**What goes wrong:**
Firefox (desktop and Android) does not implement `SpeechRecognition` at all as of 2025 — the interface is undefined. iOS Safari implements a vendor-prefixed version (`webkitSpeechRecognition`) but it only works in the foreground tab with a user gesture; background tabs and PWA standalone mode can silently fail or throw. The mic button appears, the user taps it, nothing happens, and there is no error surfaced.

**Why it happens:**
Developers test exclusively on Chrome desktop. Feature detection with `window.SpeechRecognition || window.webkitSpeechRecognition` succeeds on iOS Safari (returns the constructor) but the actual `recognition.start()` fails if called without a direct user gesture, or fails silently in some iOS PWA contexts due to permission scoping differences.

**How to avoid:**
- Feature detection must test the constructor AND perform a trial `start()` / `stop()` in the gesture handler — not at component mount time.
- Hide the mic button entirely in Firefox (constructor is undefined — this is the correct behavior per PROJECT.md: "feature-detect and hide mic button if unavailable").
- On iOS Safari: always call `recognition.start()` directly in the touch event handler (no `setTimeout`, no async gap before `start()`). Any async gap breaks the user gesture chain required for microphone permission.
- Test the text fallback path explicitly on Firefox — it must be fully functional, not visually degraded.
- Do not use PWA `standalone` display mode as the default install target if voice is a critical feature; link to the browser for voice input.

**Warning signs:**
- `recognition.start()` called after any `await` or `setTimeout` in the event handler.
- Mic button visible on all browsers without feature detection.
- No E2E test or manual test checklist covering Firefox.

**Phase to address:** Phase 1/2 (voice input component). The fallback text input must be built first; voice is progressive enhancement.

---

### Pitfall 8: Indian Food Descriptions Break LLM Calorie Estimates in Predictable Ways

**What goes wrong:**
The LLM produces wildly inconsistent calorie estimates for the same food described differently:
- "2 katoris of rajma" vs "a bowl of rajma" vs "rajma" → three different calorie values with no explainable pattern
- "puri bhaji" is estimated at restaurant portion when the user meant home-cooked (50% difference)
- Transliteration variants: "phulka" vs "roti" vs "chapati" are estimated as different foods, not synonyms
- Cooking method ignored: "bhuna mutton" and "mutton curry" get the same estimate even though bhuna uses significantly more oil
- Ambiguous units: "1 plate", "1 serving", "thali" produce inconsistent results because Gemini has no grounded definition of these units in Indian context

**Why it happens:**
Gemini's training data for Indian food is dominated by restaurant menus (Mumbai, Delhi, restaurant-format dishes) rather than home cooking. Home cooking uses significantly less oil and smaller portions than restaurant food, but the model defaults to restaurant estimates. The prompts that work well for "a burger and fries" do not work for portion-ambiguous Indian food without explicit grounding instructions.

**How to avoid:**
- System prompt must explicitly state: "Assume home-cooked Indian food unless the user says 'restaurant' or 'ordered'. Home cooking uses 30-50% less oil than restaurant equivalents."
- System prompt must include a unit grounding table: "1 katori = 150ml, 1 steel plate = 400-500g total, 1 phulka/roti/chapati = 25-30g, 1 puri = 30g (fried), 1 ladle of dal = 75ml."
- System prompt must list transliteration synonyms: "roti, chapati, phulka, fulka are the same food."
- Confidence scoring must be tied to portion ambiguity, not just food recognition: if the user says "some dal" with no quantity, confidence must be LOW regardless of how well Gemini knows what dal is.
- Mandatory test suite: 20+ Indian food inputs covering katori/plate/ladle units, Hinglish mixing, transliteration variants, and cooking method qualifiers. All must pass before shipping. This is the Alpha blocker per PROJECT.md.

**Warning signs:**
- Prompt contains no home-cooking vs. restaurant disambiguation instruction.
- Confidence level is high for inputs with ambiguous portions ("had some rice").
- "roti" and "chapati" produce different calorie estimates in test runs.
- No unit grounding in the system prompt.

**Phase to address:** Phase 1/2 (Gemini prompt engineering, the 20-input validation step). Must complete before any UI work begins on the logging flow.

---

### Pitfall 9: Next.js API Route Exposes Gemini Response to Client With No Sanitization

**What goes wrong:**
The `/api/parse-food` route returns the full Gemini API response object to the client, including fields like `usageMetadata` (token counts), `safetyRatings`, `modelVersion`, and other internal metadata. None of this is sensitive in the way an API key is, but it leaks implementation details and increases response payload size. More critically: error responses from the Gemini SDK may include the raw API key in stack traces if error handling is not careful.

**Why it happens:**
Developers do `res.json(geminiResponse)` without extracting only the needed fields. In error paths, `catch (error) { res.json({ error: error.message }) }` can expose SDK internals including the key in some SDK versions.

**How to avoid:**
- The API route returns only the parsed, validated result: `{ items: [...], mealType: '...', totalCalories: ... }`. Never the raw SDK response object.
- Error handler returns only a generic message: `{ error: 'Failed to parse food input', code: 'PARSE_FAILED' }`. Log the detailed error server-side only.
- Use `try/catch` with specific error type checks; never `res.json(error)` directly.

**Warning signs:**
- `usageMetadata` or `safetyRatings` appearing in client-side Network tab responses.
- Raw error messages from the Gemini SDK appearing in browser console.

**Phase to address:** Phase 1/2 (API route implementation). Part of the initial route handler template.

---

### Pitfall 10: Dashboard Data Overfetching with SWR — N+1 on Meal Entries

**What goes wrong:**
The dashboard loads today's meals. Each meal card also needs to display per-item nutrition breakdowns. The initial SWR fetch gets the meal list (meal IDs, names, totals). Then for each meal card, a separate SWR hook fires to get the items. With 5 meals on a day, this is 6 round trips to Supabase. On the free tier with cold connections, this is visibly slow (400-800ms per query × 6 = 2-5 seconds to fully render the dashboard).

**Why it happens:**
Developers build meal cards as self-contained components that fetch their own data ("the component owns its data"). This feels clean but produces N+1 behavior. SWR deduplication only helps if the same key is fetched multiple times; distinct meal IDs are distinct keys.

**How to avoid:**
- Single dashboard fetch that joins meal log entries with their items: `SELECT * FROM meal_log_entries WHERE user_id = $1 AND date = $2 ORDER BY logged_at`. If items are stored as JSONB in the same row (recommended for this schema), this is one query returning all needed data.
- Store `items` as a JSONB column on `meal_log_entries` rather than a separate `meal_items` table. For this use case (personal log, no cross-item querying needed), JSONB is the right choice and eliminates joins entirely.
- The SWR key for the dashboard is a single `['/api/meals', userId, today]` key; all meal card data comes from this one cache entry, passed as props.

**Warning signs:**
- A `useMealItems(mealId)` hook that each meal card calls independently.
- Multiple Supabase queries visible in Supabase Studio logs when the dashboard loads.
- `meal_items` as a separate table with a `meal_id` FK.

**Phase to address:** Phase 2/3 (dashboard and data layer). Design the schema right before building the dashboard.

---

### Pitfall 11: JSONB Aggregation Queries Are Slow on Supabase Free Tier Without Indexes

**What goes wrong:**
The weekly analytics view needs 7-day calorie totals and macro averages. The query does `SELECT date, SUM((data->>'calories')::numeric) FROM meal_log_entries GROUP BY date WHERE user_id = $1`. On Supabase free tier (shared compute), this JSONB aggregation on unindexed data causes full table scans and times out or returns in 3-5 seconds with as few as 500 rows.

**Why it happens:**
JSONB field access in `WHERE` or `ORDER BY` clauses is not indexed unless explicitly added. Postgres cannot use a standard B-tree index on a JSONB sub-field. Free tier compute is limited and shared — a query that would be instant on dedicated compute can be visibly slow.

**How to avoid:**
- Store `total_calories`, `total_protein`, `total_carbs`, `total_fat`, `total_fiber` as dedicated numeric columns on `meal_log_entries`, not computed from JSONB at query time. The LLM returns totals; store them directly.
- The JSONB `items` column is for the per-item breakdown (read at display time, not aggregated). Aggregation fields are always dedicated columns.
- Add composite index: `CREATE INDEX ON meal_log_entries (user_id, logged_date)` for the most common query pattern.
- Weekly analytics can be computed client-side from the already-fetched 7-day meal list rather than a separate aggregation query.

**Warning signs:**
- SQL query uses `(items->>'calories')::numeric` in a `SUM()` or `WHERE` clause.
- No index on `(user_id, logged_date)`.
- Weekly analytics endpoint fires a separate query rather than using cached meal data.

**Phase to address:** Phase 1 (schema design). Column types must be decided before any migration is written.

---

### Pitfall 12: Gemini Rate Limiting Creates Unusable UX Without Backpressure

**What goes wrong:**
Gemini 2.5 Flash free tier enforces requests-per-minute (RPM) limits. On the free tier (as of mid-2025), limits are approximately 10-15 RPM. A user in the correction panel who triggers 3-4 per-item re-estimations in quick succession hits the limit. The 429 error is returned, the app surfaces a generic "Something went wrong" toast, and the user doesn't know to wait.

**Why it happens:**
Per-item re-estimation is expected to be fast and cheap (it is). Developers don't implement backpressure because it "shouldn't be needed for 2 users." But even 2 users can each trigger multiple rapid re-estimations, and the free tier limits are per-project not per-user.

**How to avoid:**
- Implement client-side debounce on re-estimation: 500ms minimum between triggering re-estimations for different items.
- Disable re-estimation buttons while any re-estimation is in-flight (one at a time).
- On 429 response, surface a specific message: "Too many requests — wait a moment and try again" with a countdown timer (15 seconds).
- Track remaining requests with a simple client-side counter if the API returns rate limit headers; hide the counter but use it to pre-disable buttons.

**Warning signs:**
- Re-estimation buttons have no disabled state during in-flight requests.
- The error handler treats 429 the same as 500 (generic toast).
- No debounce on rapid button clicks in the correction panel.

**Phase to address:** Phase 2 (correction panel / FR-010). Handle this during the re-estimation feature implementation.

---

### Pitfall 13: Mobile Keyboard Obscures the Correction Panel Bottom Sheet

**What goes wrong:**
The correction panel opens as a bottom sheet or modal to review and edit meal items. On mobile (especially iOS Safari), when the user taps an editable field inside the panel, the software keyboard opens and either: (a) completely hides the active input field behind the keyboard, or (b) pushes the entire bottom sheet up but the close button goes off-screen, leaving the user trapped. On Android Chrome, `window.visualViewport` resize events fire; on iOS Safari they sometimes do not, making the fix applied for Android break on iOS.

**Why it happens:**
iOS Safari does not resize `window.innerHeight` when the keyboard opens — it resizes the visual viewport instead. CSS `height: 100vh` on the bottom sheet remains fixed at the full screen height, so the keyboard overlaps the content. Developers fix this with `window.resize` listeners that work on Android but not iOS.

**How to avoid:**
- Use `window.visualViewport.height` (not `window.innerHeight`) to detect the available height. Listen to `visualViewport.resize` events.
- CSS fix: `height: env(keyboard-insets-bottom, 100dvh)` with `dvh` (dynamic viewport height) as the primary unit, falling back to `100vh`. `dvh` is supported on iOS 15.4+ and Android Chrome 108+.
- The correction panel should be a scrollable sheet, not a fixed-height modal. The close button must be in a sticky header (top of sheet), not the bottom, so it is never keyboard-obscured.
- Test specifically: open correction panel, tap an editable calorie field, verify the field is visible above the keyboard and the panel is scrollable. Test on both physical iOS and Android.

**Warning signs:**
- Bottom sheet uses `height: 100vh` or `height: 100%` without `dvh` or visualViewport correction.
- Close/confirm button is at the bottom of the panel.
- `window.resize` listener used for keyboard detection (works Android, fails iOS).

**Phase to address:** Phase 2/3 (correction panel UI, mobile polish). Address during initial correction panel implementation, not as a post-ship fix.

---

### Pitfall 14: OAuth Callback URL Misconfiguration Causes Silent Auth Failure

**What goes wrong:**
Google OAuth signin works in development. In production (Vercel preview URL or custom domain), the OAuth callback silently fails: the user is redirected to Google, authenticates, and is redirected back to an error page or the landing page without being logged in. No error is surfaced.

**Why it happens:**
Supabase requires the OAuth callback URL to be explicitly whitelisted in two places: (1) Supabase Dashboard → Auth → URL Configuration → Redirect URLs, and (2) Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs. Production, preview, and local URLs must all be listed. Vercel preview deployments use unique per-deployment URLs (`*.vercel.app`), which cannot be wildcarded in Google Console but can be wildcarded in Supabase (`https://*.vercel.app/**`).

**Why developers miss it:**
Local development uses `http://localhost:3000` which is added during initial setup. Production is added when deploying. Preview URLs are forgotten because they seem like development environments. The auth failure on a preview deployment is often noticed too late.

**How to avoid:**
- Supabase Redirect URLs: add `http://localhost:3000/**`, `https://[production-domain]/**`, `https://*.vercel.app/**`.
- Google Console Authorized redirect URIs: add `https://[supabase-project-id].supabase.co/auth/v1/callback` (this is the Supabase-side callback, not the app URL — this is the most commonly missed entry).
- Add an auth health check to the Vercel preview deployment CI step: call `/api/auth/status` and assert it returns the correct redirect URL config.

**Warning signs:**
- OAuth works locally but fails on the Vercel preview URL.
- Google Console only has `localhost:3000` in authorized URIs.
- Supabase redirect URLs don't include a wildcard for preview deployments.

**Phase to address:** Phase 1 (auth setup). Must be part of the initial deployment checklist, not discovered at Phase 3.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store nutrition totals in JSONB only, no dedicated columns | Simpler initial schema | Every aggregation query is slow; weekly analytics requires full JSONB scan | Never — add dedicated columns from day one |
| Skip `server-only` package, rely on convention to keep Gemini imports server-side | Less boilerplate | API key silently moves to client bundle during refactor; no build-time error | Never |
| Use `getSession()` instead of `getUser()` in server code | One fewer network call | Stale auth state; security gap — unvalidated token | Never in auth-critical paths; acceptable only for display hints |
| Single RLS test with owner account only | Faster development | Multi-user data exposure discovered in production | Never if a second user will ever be added |
| No debounce on re-estimation | Simpler code | 429 rate limit errors on correction panel UX | MVP-only if single user; not acceptable with 2 users |
| Inline Gemini prompt string instead of system prompt + user message structure | Faster initial build | Prompt injection surface; harder to iterate; no prompt versioning | Alpha only; refactor before Beta |
| Per-item SWR fetches in meal card components | Cleaner component encapsulation | N+1 Supabase queries on dashboard | Never if items are available in parent fetch |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Gemini SDK (Node.js) | Instantiate `GoogleGenerativeAI` client per request | Instantiate once at module load; reuse across requests |
| Supabase client in Next.js API routes | Use `createClient` from `@supabase/supabase-js` (browser client) | Use `createClient` from `@supabase/ssr` with cookie adapter for server-side auth context |
| Supabase in middleware | Create a new Supabase client instance per middleware call without updating response cookies | Use `createServerClient` with `getAll`/`setAll` cookie handlers; return the updated response with refreshed cookies |
| Web Speech API | Call `recognition.start()` on component mount | Call only in direct response to a user gesture (click/tap); never on mount or after async gap |
| Gemini structured output | Use `response.text()` and `JSON.parse()` | Use `response.response.candidates[0].content.parts[0].text` and validate with Zod; or use the `responseSchema` path and still validate |
| Supabase RLS on new tables | Add RLS policy after data is already in the table | Enable RLS at table creation time in the migration; the policy row is part of the same migration |
| Next.js environment variables | Share `.env.local` for all vars | `NEXT_PUBLIC_` only for vars the client legitimately needs (Supabase URL, anon key); never for Gemini key |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 Supabase queries from per-component SWR hooks | Dashboard takes 2-5s to fully render; Network tab shows 5-8 sequential Supabase requests | Single dashboard query returning all needed data; JSONB items column | At 3+ meals per day |
| JSONB aggregation for weekly analytics without indexed columns | Weekly view takes 3-10s on free tier | Dedicated numeric columns for totals; client-side aggregation from cached meal list | At 100+ total meal entries |
| Gemini calls without abort controller | Old in-flight request completes after user has moved on; stale result overwrites current state | `AbortController` on every Gemini API route call; client tracks request ID | Any time user navigates away mid-parse |
| SWR without `revalidateOnFocus: false` on the dashboard | Dashboard refetches (and briefly shows stale data) every time user tabs back | Set `revalidateOnFocus: false` for meal log data; manual invalidation on mutations | On any multi-tab usage |
| Unoptimized Recharts re-renders on weekly chart | Chart re-animates on every parent re-render | Memoize chart data; use `isAnimationActive={false}` after initial render | Any time parent state changes |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `NEXT_PUBLIC_GEMINI_API_KEY` in any env file | API key exposed in client bundle; unbounded billing | Name key `GEMINI_API_KEY`; add `import 'server-only'` to gemini module; CI check scans `.next/static/` for key presence |
| Supabase service role key in client-facing code | Bypasses all RLS; full database access for any user | Service role key only in server-side code for admin operations; never in any client-reachable file |
| `user_id` accepted from request body in API routes | User can impersonate another user's ID on insert/update | Always derive `user_id` from `supabase.auth.getUser()` on the server; ignore any client-supplied user ID |
| RLS disabled on any table | Any authenticated user can read/write all rows | Enable RLS on every table at creation; `FORCE ROW LEVEL SECURITY` in dev; Supabase Studio audit before deploy |
| Error messages forwarded raw to client | Potential key/stack trace exposure | Catch all errors server-side; return only `{ error: string, code: string }`; never `JSON.stringify(error)` |
| Missing CORS restriction on Gemini API route | Any domain can proxy through your API route and use your Gemini quota | Next.js API routes accept same-origin by default; verify no custom CORS wildcard is added to the route |
| Storing raw LLM response in database | May contain unexpected PII or prompt content if user included personal info in their food description | Store only validated, structured fields; never store raw LLM response text |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No live transcript during voice input | User doesn't know what was captured; discovers errors only after parse | Show interim transcript in the input area as speech recognition fires; allow edit before submission |
| Mic button visible but non-functional on unsupported browsers | User taps mic, nothing happens; assumes app is broken | Feature-detect before rendering mic button; text input is always visible regardless |
| Confidence scores shown as decimals (0.73) | Meaningless to non-technical users | Show as Low/Medium/High labels with color coding; never show raw floats |
| Generic "Something went wrong" on Gemini parse failure | User doesn't know if they should retry or rephrase | Specific error states: network error (retry), rate limit (wait + countdown), parse failure (rephrase prompt) |
| Editing calorie field requires clearing and retyping | Tedious on mobile; fat-finger risk | Number input with select-all on focus; stepper buttons (+/- 10 cal) as alternative |
| No optimistic update on meal save | User sees spinner for 1-2s after tapping Save; dashboard doesn't update immediately | Optimistic insert into SWR cache on save; revert on error |
| Correction panel shows raw food name from LLM | LLM may return inconsistent casing or punctuation ("Dal tadka", "dal Tadka", "DAL TADKA") | Normalize: `.toLowerCase()` then capitalize first letter only; or display as-is but lock casing in Zod parse |
| Toast for undo disappears before user reads it | User loses the undo window | Undo toast: 5-second minimum, pause timer on hover (desktop), extend to 8s on mobile |

---

## "Looks Done But Isn't" Checklist

- [ ] **Voice input:** Works on Chrome desktop — verify on Chrome mobile, iOS Safari, Firefox desktop (should degrade gracefully, not appear broken).
- [ ] **Auth flow:** Works with one Google account — verify data isolation with two separate accounts before Partner user is added.
- [ ] **RLS policies:** All tables visible in Supabase Studio have RLS enabled (green shield) — not just the primary `meal_log_entries` table.
- [ ] **Gemini key security:** Build passes and `.next/static/` contains no reference to `GEMINI_API_KEY` — run grep check before first Vercel deploy.
- [ ] **Correction panel:** Works on desktop — verify on 390px mobile viewport with keyboard open; confirm no input field is hidden.
- [ ] **Weekly analytics:** Shows correct totals — verify against manually calculated values for a 7-day period with mixed meal counts.
- [ ] **Offline/network error:** App is fetched on slow connection — verify all loading states are shown; no blank screens on Supabase timeout.
- [ ] **Indian food prompts:** Gemini returns structured output for 20+ test inputs — verify Zod parse succeeds for all before shipping logging flow.
- [ ] **Re-estimation:** Changing one item — verify only that item's calories change in the correction panel; running total updates correctly.
- [ ] **OAuth on production URL:** Auth works on `localhost:3000` — verify on the actual Vercel production domain with Google Console redirect URIs updated.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Gemini API key leaked in bundle | HIGH | Immediately rotate key in Google AI Studio; redeploy; audit billing for unexpected charges; add `server-only` guard before redeployment |
| RLS gap exposes multi-user data | HIGH | Disable RLS offending policy immediately; audit logs for unauthorized reads; patch policy; notify affected user (partner); re-verify with 2-account test |
| JSONB-only schema requires aggregation columns | MEDIUM | Write migration adding dedicated numeric columns; backfill from JSONB items data; update insert/update logic; weekly analytics query update |
| N+1 dashboard queries | LOW | Consolidate to single query + endpoint; update SWR key; no data migration needed |
| OAuth callback misconfiguration on production | LOW | Add callback URL to Google Console and Supabase dashboard; re-test login flow; no data impact |
| Gemini response schema mismatch causes Zod failures | MEDIUM | Update Gemini responseSchema and Zod schema in sync; rerun 20-input test suite; no data migration unless stored data also needs backfill |
| Mobile keyboard hides correction panel inputs | LOW | CSS `dvh` fix + visualViewport listener; no data impact; testable in 1 day |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Gemini API key in client bundle | Phase 1 (scaffolding) | `grep -r "GEMINI_API_KEY" .next/static/` returns empty after `next build` |
| RLS multi-user data exposure | Phase 1 (auth + schema) | Two-account smoke test: each account cannot read the other's data |
| Supabase Auth cookie session bugs | Phase 1 (auth setup) | Auth persists across hard refresh and soft navigation; no redirect loops |
| Gemini schema unsupported features | Phase 1/2 (API route + prompt) | Zod `.safeParse()` succeeds on 20+ Indian food inputs |
| Re-estimation loses meal context | Phase 2 (correction panel) | Re-estimation of same item with/without meal context is within 20% |
| Web Speech fires before utterance complete | Phase 1/2 (voice component) | Only one Gemini API call per voice session in Network tab |
| Speech API broken on Firefox/iOS | Phase 1/2 (voice component) | Mic button absent on Firefox; text fallback fully functional |
| Indian food transliteration/unit failures | Phase 1/2 (prompt engineering) | 20-input test suite all pass Zod parse; "roti" == "chapati" calorie estimate |
| API key in error responses | Phase 1/2 (API route) | All error responses return `{ error: string, code: string }` only |
| N+1 dashboard queries | Phase 2/3 (dashboard) | Single Supabase query per dashboard load (confirmed in Studio logs) |
| JSONB aggregation performance | Phase 1 (schema design) | Dedicated numeric columns present in initial migration |
| Gemini rate limiting on correction panel | Phase 2 (correction panel) | Re-estimation buttons disabled during in-flight request; 429 shows countdown toast |
| Mobile keyboard hides correction panel | Phase 2/3 (correction panel UI) | Manual test: tap editable field on iOS Safari, input visible above keyboard |
| OAuth callback misconfiguration | Phase 1 (auth + deploy) | Login works on production Vercel URL before any user is invited |

---

## Sources

- Gemini API structured output limitations: training knowledge (mid-2025), MEDIUM confidence — verify against current Gemini API docs at `ai.google.dev/gemini-api/docs/structured-output`
- Supabase Auth + Next.js App Router: training knowledge of `@supabase/ssr` package patterns, verified partially via MDN fetch; HIGH confidence on cookie/session patterns
- Web Speech API browser compatibility: MDN SpeechRecognition docs (fetched during research) — Firefox no support confirmed; iOS Safari behavior: MEDIUM confidence
- Indian food LLM estimation: domain reasoning from project context and known LLM training data characteristics; MEDIUM confidence — validate with actual prompt testing
- Next.js environment variable bundling: HIGH confidence — this is documented Next.js behavior
- Supabase RLS patterns: HIGH confidence — standard Postgres RLS + Supabase documentation
- Mobile keyboard and `dvh`/`visualViewport` behavior: HIGH confidence — well-documented browser behavior with clear caveats

---
*Pitfalls research for: NomLog — LLM-powered voice food logging web app*
*Researched: 2026-06-09*
