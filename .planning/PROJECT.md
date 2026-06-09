# NomLog

## What This Is

NomLog is a voice-first, web-based food logging and nutrition tracking app for individuals who care about calorie and macro intake but find traditional food logging too tedious to sustain. Users speak or type what they ate in natural language — no measuring, no structured input, no food databases — and the app uses Gemini 2.5 Flash to interpret the input, estimate calories and macros, and store the entry against their profile. Built for a 2-person household (primary user + partner), each with independent logs and nutrition goals.

## Core Value

Speak what you ate in under 30 seconds and never lose the data — the correction panel exists to fix estimates, not to slow down logging.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Google OAuth sign-in with persistent sessions and per-user data isolation (Supabase RLS)
- [ ] Per-user nutrition goal setting (calories, protein, carbs, fat, fiber) with defaults
- [ ] Voice input via browser Web Speech API with graceful fallback to text
- [ ] Text input as always-visible fallback input method
- [ ] LLM food parsing via Gemini 2.5 Flash returning structured JSON with per-item nutrition and confidence
- [ ] Pre-save inline correction panel: editable line items, per-item LLM re-estimation, manual override, add/delete items
- [ ] Meal type auto-suggestion (breakfast/lunch/dinner/snack) with user override
- [ ] Meal log entry storage in Supabase Postgres with full nutrition data and metadata
- [ ] Today's dashboard: running calorie total, macro progress bars, chronological meal list, log entry CTA
- [ ] Yesterday's summary view (same layout as today, entries editable)
- [ ] Post-save inline editing of logged entries (FR-011) with "edited" label and undo toast
- [ ] Weekly analytics: 7-day calorie bar chart, macro averages vs. goal, plain-language macro flags

### Out of Scope

- Image-based food logging — Phase 2
- Meal planning / AI chat interface — Phase 2
- Native mobile app (iOS/Android) — Phase 2
- Barcode scanner — never (wrong product category)
- Weight / body metrics tracking — out of scope entirely
- Social features / sharing logs — out of scope entirely
- Verified nutritional label database — never (LLM estimation by design)
- Micronutrient tracking — Phase 3 at earliest
- Calorie burn / exercise logging — out of scope
- Email/password auth — dropped; Google OAuth only
- Conversational correction ("no, actually it was...") — never; inline structured editing is the correction model

## Context

- **Personal-use product**: 2 users (builder + partner). No SLA, no public launch.
- **Cultural fit gap**: Existing food apps (MyFitnessPal, Cronometer) fail on Indian home-cooked food — no "2 katoris of dal tadka" in any database. This is the root cause NomLog solves.
- **LLM accuracy expectations**: Estimates carry ±20-30% variance for home-cooked Indian food. This is known and communicated via confidence indicators. The correction panel (FR-010/FR-011) is the designated resolution path, not a fallback.
- **Alpha definition**: Correction panel (FR-010) is included from day one — not deferred to Beta. The full log → parse → correct → save → dashboard loop must work in Alpha.
- **Gemini API key security**: Highest-risk item in the stack. Must never reach the client bundle. All Gemini calls go through server-side Next.js API routes only.
- **System prompt validation**: Gemini prompt must be tested against 20+ Indian food inputs before any logging code ships. This is a hard Alpha blocker.
- **Supabase RLS**: Must be written and tested with two separate Google accounts before the second real user is added.

## Constraints

- **Tech Stack**: Next.js 14+ (App Router) on Vercel, Supabase (Auth + Postgres), Gemini 2.5 Flash, Tailwind CSS, Recharts, Zod, React + SWR
- **LLM**: Gemini 2.5 Flash only — Claude excluded by product owner preference; GPT-4o excluded (more expensive)
- **Auth**: Google OAuth only via Supabase Auth — no email/password, no phone OTP
- **Analytics**: Rule-based in V1 — no LLM for weekly insights (defer to Phase 2)
- **Budget**: Gemini API cost <$1/user/month; Supabase free tier (500MB storage, 2GB bandwidth)
- **Hosting**: Vercel free tier — no uptime SLA required
- **Performance**: Dashboard load <2s on 4G; LLM parse response <3s; per-item re-estimation <2s
- **Security**: Gemini API key server-side only (never `NEXT_PUBLIC_` prefix); Supabase RLS on all user tables
- **Mobile**: Fully functional on mobile Chrome and Safari; min 44×44px touch targets; works on 390px viewport

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Gemini 2.5 Flash for LLM parsing | 10x cheaper for audio than OpenAI equivalent; free tier for dev; handles Indian food and Hinglish | — Pending |
| Google OAuth only (no email/password) | Eliminates verification, password reset, and account recovery flows; Google handles identity | — Pending |
| LLM always estimates, never asks clarifying questions | Protects the <30s logging promise; inline correction panel is the resolution path | — Pending |
| Per-item re-estimation (not full-meal re-parse) | Cheaper, faster, more predictable; avoids re-estimating already-accepted items | — Pending |
| Rule-based analytics in V1 | Weekly macro flags computable from stored data with arithmetic; no extra API cost | — Pending |
| Correction panel (FR-010) in Alpha | The full log-correct-save loop must work from day one; not deferrable | — Pending |
| Web Speech API with silent fallback | Feature-detect and hide mic button if unavailable; show text input; Gemini audio transcription as P1 secondary fallback | — Pending |

---
*Last updated: 2026-06-09 after initialization*
