# Research Summary: NomLog

**Project:** NomLog — Voice-first LLM-powered food logging and nutrition tracking web app
**Researched:** 2026-06-09
**Confidence:** HIGH (stack verified from npm registry; architecture from official docs; features from category leader analysis)

---

## Executive Summary

NomLog replaces the database-search paradigm of MyFitnessPal with a voice-first LLM parsing loop. The core interaction — speak what you ate, review the LLM's structured estimate, correct if needed, save — must complete in under 30 seconds and must work for Indian home-cooked food and Hinglish descriptions that traditional food databases cannot handle.

The stack (Next.js 16 + Supabase + Gemini 2.5 Flash) is well-suited with well-documented patterns for every integration point. The recommended build order is bottom-up: auth and schema first, then Gemini API routes validated against 20+ Indian food inputs, then the logging UI and correction panel, then the dashboard, then secondary views. The correction panel (FR-010) ships in Alpha — the full log-parse-correct-save loop is the product and cannot be validated in pieces.

The highest-risk items are all locked at Phase 1: Gemini API key never reaches the client bundle, Supabase RLS verified with two separate accounts before a second real user is added, OAuth callback URLs registered for both Supabase and Google Console. The LLM estimation accuracy for Indian home-cooked food is the product's core gamble — the system prompt must explicitly handle home vs. restaurant disambiguation, portion unit grounding (katori, ladle, plate), and transliteration synonyms before any logging code ships.

---

## Key Findings

### Stack — Critical Deprecations (Action Required)

Two widely-used packages are deprecated and must not be used:

| Deprecated | Replace With | Reason |
|-----------|-------------|--------|
| `@google/generative-ai` | `@google/genai@2.8.0` | EOL August 31, 2025 — legacy SDK not updated for Gemini 2.5+ |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr@0.12.0` | Officially dead; missing `getUser()` security model |
| `next@15.x` | `next@16.2.7` | 15.3.9 carries CVE-2025-66478; Next.js 16 is current stable |

### Pinned Stack

| Layer | Package | Version | Notes |
|-------|---------|---------|-------|
| Framework | `next` | `16.2.7` | React 19 required |
| Auth + DB | `@supabase/ssr` | `0.12.0` | Cookie adapter; `getUser()` not `getSession()` |
| Auth + DB | `@supabase/supabase-js` | `2.108.0` | Client SDK |
| LLM | `@google/genai` | `2.8.0` | New unified Google Gen AI SDK; `GoogleGenAI` class |
| Validation | `zod` | `4.4.3` | `z.toJSONSchema()` native — no `zod-to-json-schema` needed |
| Data fetching | `swr` | `2.4.1` | Dashboard reactivity via `mutate()` |
| Charts | `recharts` | `3.8.1` | React 19 compatible |
| Styling | `tailwindcss` | `4.3.0` | CSS-based `@theme` config — no `tailwind.config.js` |
| Styling | `@tailwindcss/postcss` | `4.3.0` | PostCSS plugin for v4 |

**Security rule:** `GEMINI_API_KEY` must never have `NEXT_PUBLIC_` prefix. Add `import 'server-only'` to `lib/gemini/client.ts`. CI grep check: `grep -r "GEMINI_API_KEY" .next/static/` must return empty after every build.

**Auth rule:** Use `getUser()` not `getSession()` everywhere server-side. `getSession()` reads cookies without server verification and must never gate protected routes.

---

### Features — Must Have vs. Defer

**Alpha blockers (table stakes):**
- Today's running calorie total and macro progress bars (meaningless without goal defaults on first login)
- Chronological meal list with edit affordance
- Per-user nutrition goals with sensible defaults
- Post-save inline editing with undo toast (5s minimum, 8s on mobile)
- Yesterday's view (same layout as today — morning catch-up is primary use pattern)
- Persistent sessions via Supabase token refresh
- Save confirmation feedback within 500ms

**Alpha required (core identity):**
- Voice input (Web Speech API, `lang: 'en-IN'`) with always-visible text fallback — `en-IN` activates Indian English model
- LLM parsing with per-item confidence indicators (Low/Medium/High labels, not decimals)
- Pre-save correction panel: editable line items, per-item re-estimation (not full re-parse), add/delete items
- Hinglish / mixed-language input — Gemini handles natively

**After validation (v1.x):**
- Weekly analytics: 7-day calorie bar chart + macro averages + plain-language flags (meaningless until 7+ days of data exist)

**Anti-features (never build):**
- Barcode scanner — wrong product category, fragments voice-first identity
- Conversational correction ("no, actually it was...") — inline panel is faster and more reliable
- TDEE wizard in onboarding — friction with no payoff for a 2-user personal app
- Push notifications — infrastructure cost solving the wrong problem
- Exercise/calorie burn logging, social features, weight tracking

---

### Architecture — Component Map

```
Browser
├── middleware.ts              ← session refresh on every request (@supabase/ssr)
├── app/
│   ├── (auth)/login/         ← Google OAuth CTA
│   ├── (auth)/callback/      ← Supabase OAuth callback handler
│   ├── (app)/dashboard/      ← Today's view (Server Component shell)
│   │   ├── DailySummary      ← useSWR, calorie total + macro bars
│   │   └── MealList          ← useSWR, meal cards with edit icon
│   ├── (app)/yesterday/      ← Same components, date-shifted
│   ├── (app)/analytics/      ← 7-day chart (Phase 6)
│   └── (app)/goals/          ← Goal setting form
├── components/
│   ├── LogFlow               ← useReducer FSM: idle→recording→parsing→confirming→saving→saved→error
│   ├── VoiceInput            ← Web Speech API, lang: 'en-IN', interim results display
│   ├── TextInput             ← Always visible fallback
│   └── ConfirmationPanel     ← Per-item edit, re-estimate, add/delete, confidence indicators
└── api/
    ├── parse-food/           ← server-only Gemini call; Zod validation; 3-tier errors
    └── reestimate-item/      ← server-only; single item re-estimation with meal context
```

**LogFlow FSM states:**
`idle → recording → parsing → confirming → [item_editing] → saving → saved → error`

Implemented as `useReducer` with discriminated union `LogFlowState` type. Per-item re-estimation loading state must not bleed into sibling items. All async side effects in `useEffect` blocks keyed on `state.phase`.

**Database schema:**
- `user_profiles`: `id, user_id (FK), daily_calories_kcal, protein_g, carbs_g, fat_g, fiber_g, effective_from` — goals versioned with effective date
- `meal_logs`: `id, user_id (FK), logged_at, meal_type, raw_input, food_items (JSONB), total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, confidence, input_source, edited` — **dedicated numeric columns for aggregation; JSONB for per-item display only**

**SWR key convention:** `/api/meals?date=YYYY-MM-DD` — shared across `DailySummary` and `MealList`; invalidated by `LogFlow` on `SAVE_COMPLETE` via `mutate()`. No optimistic updates (server-side calorie computation cannot be safely guessed client-side).

---

### Critical Pitfalls

1. **Gemini API key in client bundle** — `server-only` import guard on `lib/gemini/client.ts`. Never `NEXT_PUBLIC_` prefix. CI grep check after every build. **Phase 1.**

2. **RLS policies that pass single-user testing but expose multi-user data** — Every policy uses `auth.uid() = user_id` (not `IS NOT NULL`). Set `user_id` from server-side `getUser()`, never from request body. Mandatory two-account smoke test before adding second real user. **Phase 1.**

3. **Supabase Auth cookie breaks in App Router** — `@supabase/ssr` exclusively; `setAll` writes cookies to both `request` AND `supabaseResponse`. `getUser()` not `getSession()` everywhere server-side. **Phase 1.**

4. **Indian food produces inconsistent LLM estimates** — System prompt must include: home vs. restaurant disambiguation, unit grounding table (1 katori = 150ml, 1 phulka = 25-30g, 1 ladle = 75ml), transliteration synonyms (roti/chapati/phulka), confidence LOW for ambiguous quantities. 20+ input test is the hard Alpha blocker. **Phase 2.**

5. **Web Speech API fires multiple events before utterance complete** — Submit only on `recognition.onend`, not `isFinal: true`. One Gemini call per voice session. Call `recognition.start()` directly in touch handler — no async gap (iOS Safari requires synchronous user gesture chain). **Phase 3.**

6. **Re-estimation loses meal context** — `/api/reestimate-item` must include original full meal description as context. Same Zod schema and confidence enum as initial parse. **Phase 3.**

7. **Mobile keyboard hides correction panel inputs** — Use `dvh` not `vh`. `visualViewport.resize` not `window.resize`. Sticky confirm/close buttons at **top** of sheet, never bottom. **Phase 3.**

8. **JSONB aggregation performance on free tier** — Weekly analytics and dashboard totals must use dedicated `total_calories`, `total_protein_g` etc. columns — NOT `SUM((food_items->>'calories')::numeric)`. Schema decision locked in Phase 1. **Phase 1 / Phase 6.**

9. **`getSession()` trusted for authorization** — Always `getUser()` in middleware and route handlers. `getSession()` reads unverified cookies and can be spoofed. **Phase 1.**

10. **N+1 dashboard queries** — Single Supabase query per dashboard load. `DailySummary` and `MealList` share one SWR key. No per-meal-card data fetches. **Phase 4.**

---

## Recommended Phase Structure

### Phase 1: Foundation — Auth, Schema, Security
**Delivers:** Google OAuth, Supabase schema + RLS (verified with 2 test accounts), server/client factories, session middleware, Gemini `server-only` guard, CI key-leak check, OAuth URLs registered.
**Pitfall coverage:** API key leak, RLS exposure, auth cookie breakage.

### Phase 2: LLM Core — Gemini Integration + Prompt Validation
**Delivers:** `/api/parse-food` + `/api/reestimate-item` with structured output, Zod validation, 3-tier errors, Indian food system prompt, 20+ input test suite (including ≥5 Hinglish inputs).
**Gate:** 20-input test must pass before any logging UI ships.
**Pitfall coverage:** Schema failures, Indian food misses, re-estimation context loss, rate limiting.

### Phase 3: Log Flow — Voice Input, Correction Panel, Save
**Delivers:** Full `LogFlow` FSM, `VoiceInput` (`lang: 'en-IN'`), `TextInput` fallback (always visible), `ConfirmationPanel` with per-item edit/re-estimate/add/delete/confidence, meal type auto-suggestion, `/api/meals` POST.
**Pitfall coverage:** Premature speech events, mobile keyboard, Firefox/iOS fallback, rate limit UX.

### Phase 4: Dashboard — Today's View + Post-Save Editing
**Delivers:** `DailySummary`, `MealList`, `MealCard` with inline edit + undo toast, SWR key convention, `/api/meals` GET, `/api/goals` GET/PUT.
**Pitfall coverage:** N+1 queries, SWR key inconsistency.

### Phase 5: Secondary Views — Yesterday + Goals Settings
**Delivers:** Yesterday page (reused components, date prop), goals settings (edit targets, default activation on first login).
**Note:** Entirely reuses Phase 3-4 patterns — minimal new surface area.

### Phase 6: Weekly Analytics
**Delivers:** 7-day calorie bar chart (Recharts `BarChart` + `ReferenceLine`), macro averages vs. goal, plain-language macro flags (rule-based arithmetic), streak count.
**Note:** Deliberately last — analytics require 7+ days of data to be non-trivial. Meaningless on day 1.
**Pitfall coverage:** JSONB aggregation performance (uses dedicated columns from Phase 1).

---

## Research Gaps (Validate During Implementation)

| Gap | When to Validate | Conservative Default |
|-----|-----------------|---------------------|
| Gemini `responseSchema` supported JSON Schema subset | Phase 2, before finalizing Zod schemas | Flat schema only; explicit enums; no `$ref`, `allOf`, `oneOf` |
| Gemini 2.5 Flash free tier RPM limits | Phase 2, check `ai.google.dev/pricing` | Design for 10-15 RPM; one in-flight request at a time; 429 countdown toast |
| iOS Safari Web Speech API interim results + gesture chain | Phase 3, physical device test early | Build text fallback first; voice is progressive enhancement |
| Recharts 3.x `BarChart` + `ReferenceLine` API | Phase 6, verify via Context7 | Standard pattern; low risk |

---

## Confidence by Area

| Area | Level | Basis |
|------|-------|-------|
| Package versions and deprecations | HIGH | Live npm registry queries, 2026-06-09 |
| Supabase SSR auth patterns | HIGH | Official `@supabase/ssr@0.12.0` readme |
| Next.js App Router patterns | HIGH | Official Next.js docs (verified 2026-05) |
| Gemini structured output via `@google/genai` | MEDIUM | SDK readme + Google AI docs patterns; validate empirically in Phase 2 |
| Feature table stakes | HIGH | MFP/Cronometer patterns well-established |
| Voice input UX patterns | MEDIUM | Web Speech API MDN confirmed; iOS Safari behavior needs device test |
| Indian food LLM accuracy | LOW → validated | Domain reasoning; empirically confirmed by Phase 2 test gate |
| Weekly analytics patterns | MEDIUM | General UX research; rule-based arithmetic is conservative and correct choice |

---

*Research completed: 2026-06-09*
*Ready for roadmap: yes*
