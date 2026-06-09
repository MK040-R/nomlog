# Roadmap: NomLog

## Overview

NomLog ships bottom-up, following hard dependency order. Auth and database schema must exist before anything else can be tested. Gemini API routes must be validated against 20+ Indian food inputs before any logging UI ships — this is the Alpha blocker. The full log-parse-correct-save loop ships together in Phase 3 because it cannot be validated in pieces. Dashboard and history views require real logged data. Weekly analytics require 7+ days of data and ship last.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Google OAuth, Supabase schema + RLS, session middleware, Gemini key guard
- [ ] **Phase 2: LLM Core** - Gemini parse + reestimate API routes validated against 20+ Indian food inputs
- [ ] **Phase 3: Log Flow** - Complete speak → parse → correct → save loop; voice input, correction panel, meal save
- [ ] **Phase 4: Dashboard + History** - Today's dashboard, yesterday view, post-save editing, goal settings
- [ ] **Phase 5: Weekly Analytics** - 7-day calorie chart, macro averages vs. goal, plain-language flags

## Phase Details

### Phase 1: Foundation
**Goal**: Every user has a verified, isolated account with a working database schema — no data leaks between accounts
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. User can open the app, tap "Sign in with Google", complete OAuth, and land on the app — no email/password option exists
  2. User can close the browser, reopen it, and be still logged in without re-authenticating
  3. User can tap sign out and be returned to the login screen with their session cleared
  4. Logging in with a second Google account shows zero data from the first account — both in the UI and confirmed by direct Supabase query
  5. Gemini API key is absent from the compiled client bundle — `grep -r "GEMINI_API_KEY" .next/static/` returns empty after every build
**Plans**: 2 plans

Plans:
- [ ] 01-01: Supabase project setup — schema, RLS policies, server/client factories, OAuth provider config
- [ ] 01-02: Next.js auth wiring — middleware, login page, OAuth callback, session refresh, Gemini server-only guard

### Phase 2: LLM Core
**Goal**: A server-side API can parse any natural-language Indian food description into structured nutrition data and re-estimate individual items — validated against 20+ real inputs before any logging UI ships
**Depends on**: Phase 1
**Requirements**: LLM-01, LLM-02, LLM-03, LLM-04, LLM-05
**Success Criteria** (what must be TRUE):
  1. Sending "2 katoris dal tadka, 3 phulkas, small bowl of raita" to `/api/parse-food` returns a structured JSON array with per-item calories, protein, carbs, fat, fiber, and a confidence level
  2. Sending a vague input ("ate some food") returns a structured response with `confidence: "low"` — never an empty result or a clarifying question
  3. Sending a Hinglish input ("aaj lunch mein dal chawal khaya, ek katori dal aur ek plate rice") returns a correctly parsed structured result
  4. A malformed Gemini response triggers up to 2 automatic retries; after retries are exhausted the user's original raw input text is preserved for re-submission
  5. `/api/reestimate-item` called with a modified item name and the original meal context returns updated nutrition numbers for that item only
**Plans**: 2 plans

Plans:
- [ ] 02-01: Gemini client setup — system prompt with Indian food unit grounding, Zod schemas, `/api/parse-food` route with retry logic
- [ ] 02-02: `/api/reestimate-item` route, 20+ Indian food input test suite (pass gate required before Phase 3 begins)

### Phase 3: Log Flow
**Goal**: A user can speak or type what they ate, review and correct the LLM's structured estimate, and save the entry — the complete core product loop works end to end
**Depends on**: Phase 2
**Requirements**: INPUT-01, INPUT-02, INPUT-03, INPUT-04, CORR-01, CORR-02, CORR-03, CORR-04, CORR-05, CORR-06, LOG-01, LOG-02, GOAL-01, GOAL-02
**Success Criteria** (what must be TRUE):
  1. User can tap the mic button, speak "2 rotis and dal fry", see the transcribed text appear, and receive a filled correction panel — all within 30 seconds on a mobile browser
  2. User without mic access (permission denied or unsupported browser) sees a text input field with a one-line explanation and can log food without any mic interaction
  3. User can edit any item's name, portion, or macro numbers in the correction panel; editing name or portion triggers per-item re-estimation with a loading state on that row only
  4. User can add a new food item to the correction panel or delete an existing item before saving
  5. User can tap Save, and the entry appears in the database with all nutrition fields stored — including meal type, raw input, confidence, and input source
  6. Low-confidence LLM estimates show a visible indicator in the correction panel header with the message "This estimate is rough — tap any item to adjust"
**Plans**: 3 plans

Plans:
- [ ] 03-01: LogFlow FSM + VoiceInput component (Web Speech API, `lang: 'en-IN'`, mic permission handling, iOS Safari gesture chain)
- [ ] 03-02: ConfirmationPanel component (per-item edit, re-estimate loading state, add/delete, confidence indicator, meal type selector)
- [ ] 03-03: Goal defaults + `/api/meals` POST + `/api/goals` POST — save to Supabase, first-login goal initialization

### Phase 4: Dashboard + History
**Goal**: A user can see their day's nutrition at a glance, access yesterday's entries, edit any logged meal, and manage their nutrition goals
**Depends on**: Phase 3
**Requirements**: DASH-01, DASH-02, DASH-03, LOG-03, GOAL-03
**Success Criteria** (what must be TRUE):
  1. After logging meals, the dashboard shows today's total calories vs. goal and macro progress bars (protein, carbs, fat, fiber) — all reflecting the actual logged data
  2. User can tap any logged meal on the dashboard to reopen the correction panel, edit it, and save — the entry shows an "edited" label and an undo toast appears for 5 seconds
  3. User can tap "Yesterday" from the dashboard in one tap and see the same layout (calorie total, macro breakdown, meal list with edit icons) for the previous day
  4. User can navigate to Goals settings and change any daily target; the new goal is reflected immediately on the dashboard without altering any historical data
**Plans**: 2 plans

Plans:
- [ ] 04-01: Dashboard page — DailySummary + MealList components, SWR key convention, `/api/meals` GET, `/api/goals` GET
- [ ] 04-02: Post-save editing (LOG-03), undo toast, yesterday page (date-shifted reuse), goals settings page (GOAL-03), `/api/goals` PUT

### Phase 5: Weekly Analytics
**Goal**: A user can see a 7-day view of their calorie and macro patterns with plain-language flags for any significant deviations from their goals
**Depends on**: Phase 4
**Requirements**: ANLT-01
**Success Criteria** (what must be TRUE):
  1. User can navigate to the weekly analytics view and see a bar chart of daily calories for the past 7 days with a reference line at their calorie goal
  2. The weekly view shows average protein, carbs, fat, and fiber for the week alongside the goal values for each macro
  3. Any macro averaging more than 20% above or below the daily goal across the week shows a plain-language flag (e.g., "Your protein average was 40% below your goal this week")
  4. The weekly view shows how many days out of the past 7 had at least one logged meal
**Plans**: 1 plan

Plans:
- [ ] 05-01: Analytics page — Recharts BarChart + ReferenceLine, macro averages, rule-based flag logic, logged day count, `/api/analytics/weekly` GET

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/2 | In Progress|  |
| 2. LLM Core | 0/2 | Not started | - |
| 3. Log Flow | 0/3 | Not started | - |
| 4. Dashboard + History | 0/2 | Not started | - |
| 5. Weekly Analytics | 0/1 | Not started | - |
