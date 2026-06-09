# Requirements: NomLog

**Defined:** 2026-06-09
**Core Value:** Speak what you ate in under 30 seconds and never lose the data — the correction panel exists to fix estimates, not to slow down logging.

## v1 Requirements

### Authentication (AUTH)

- [ ] **AUTH-01**: User can sign in with their Google account via OAuth — no email/password option exists
- [ ] **AUTH-02**: User session persists across browser closes without requiring re-login
- [ ] **AUTH-03**: User can sign out explicitly from their profile screen
- [x] **AUTH-04**: Two different Google accounts have completely separate data with no cross-visibility
- [x] **AUTH-05**: Supabase Row-Level Security (RLS) policies enforce per-user data isolation at the database level; verified with two separate test accounts before any second real user is added

### Goals (GOAL)

- [ ] **GOAL-01**: User can set daily targets: calorie (kcal), protein (g), carbs (g or % of calories), fat (g or % of calories), fiber (g)
- [ ] **GOAL-02**: Default goals are pre-filled on first login (2000 kcal / 30% protein / 40% carbs / 30% fat / 25g fiber) with a first-time prompt to customize
- [ ] **GOAL-03**: Goals are editable at any time; changes apply from the current day forward without retroactively altering historical analytics

### Food Input (INPUT)

- [ ] **INPUT-01**: User can speak what they ate in natural language using the browser mic (Web Speech API, `lang: 'en-IN'`); transcribed text is shown before LLM call
- [ ] **INPUT-02**: Text input box is always visible alongside the mic button — not hidden behind it or shown only on mic failure
- [ ] **INPUT-03**: Mic permission denial is handled gracefully: mic button hidden, text input shown with a one-line explanation
- [ ] **INPUT-04**: Voice input handles English, Hinglish (Hindi-English code-switching), and Indian food names (dal tadka, 2 rotis, half plate biryani, multigrain atta roti, etc.)

### LLM Parsing (LLM)

- [ ] **LLM-01**: Natural language food description is parsed by Gemini 2.5 Flash via a server-side Next.js API route (`/api/parse-food`); API key never exposed to the client bundle
- [ ] **LLM-02**: LLM always returns a structured estimate — never asks clarifying questions, never returns an empty result; vague inputs receive `confidence: "low"`
- [ ] **LLM-03**: Response includes structured per-item nutrition (name, portion, calories_kcal, protein_g, carbs_g, fat_g, fiber_g) and an overall confidence level (high/medium/low)
- [ ] **LLM-04**: LLM response is validated with Zod against the defined schema; invalid responses are retried up to 2 times before returning a structured error
- [ ] **LLM-05**: API errors (timeout, rate limit, schema failure after retries) preserve the user's raw input text so they can retry without re-entering

### Correction Panel (CORR)

- [ ] **CORR-01**: After LLM parse, a confirmation panel shows each food item as an individually editable row before saving — no entry is saved without user review
- [ ] **CORR-02**: User can edit item name, portion detail, and individual macro numbers; manual number edits do not trigger an LLM re-call
- [ ] **CORR-03**: Editing item name or portion/detail field triggers per-item LLM re-estimation via `/api/reestimate-item` (not a full meal re-parse); loading state applies to that row only, not the whole panel
- [ ] **CORR-04**: User can add a new food item to the panel (text input, runs through LLM parse) or delete an individual item
- [ ] **CORR-05**: Meal type (breakfast/lunch/dinner/snack) is shown in the panel and editable before save; auto-suggested based on time of day
- [ ] **CORR-06**: Low-confidence estimates show a visual indicator on the panel header with the message "This estimate is rough — tap any item to adjust"

### Meal Logging (LOG)

- [ ] **LOG-01**: Saved entries store: user_id, logged_at (timestamp with timezone), meal_type, raw_input (text), food_items (JSONB array), total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, confidence, input_source (voice/text), edited (boolean)
- [ ] **LOG-02**: User can delete any logged entry from the daily view with a confirmation step
- [ ] **LOG-03**: User can reopen and edit any entry from today or yesterday using the same correction panel (FR-010/FR-011); edited entries show an "edited" label; undo toast (5 seconds) available immediately after save

### Dashboard (DASH)

- [ ] **DASH-01**: Dashboard is the first screen after login, showing today's date, total calories logged vs. goal, and macro progress indicators (protein, carbs, fat, fiber — each showing logged vs. goal)
- [ ] **DASH-02**: Today's chronological meal list is shown on the dashboard; mic button and text input are accessible from this screen without any navigation
- [ ] **DASH-03**: Yesterday's summary is accessible in one tap from the dashboard and shows the same layout (calorie total, macro breakdown, meal list with edit icons)

### Analytics (ANLT)

- [ ] **ANLT-01**: Weekly analytics view shows: 7-day calorie bar chart with goal reference line, average macro breakdown for the week vs. goal, plain-language flags for any macro averaging >20% above or below the daily goal across the week, and logged day count for the past 7 days

---

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Input

- **INPUT-V2-01**: User can photograph a meal and receive a Gemini Vision nutrition estimate
- **INPUT-V2-02**: Quick-log mode for recurring meals (log same meal as yesterday, etc.)

### Analytics & Insights

- **ANLT-V2-01**: LLM-generated narrative insights for weekly analytics (not rule-based)
- **ANLT-V2-02**: Multi-week trend analysis (beyond 7 days)
- **ANLT-V2-03**: Export logs to CSV

### Platform

- **PLAT-V2-01**: Progressive Web App with offline queue — entries held locally and synced on reconnect
- **PLAT-V2-02**: Push notification reminders (opt-in)
- **PLAT-V2-03**: Habit/streak insights with nudge system

---

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Barcode scanner | Wrong product category — NomLog uses LLM estimation by design |
| Weight / body metrics tracking | Different product domain entirely |
| Social features / sharing logs | 2-user personal app; no audience for social |
| Email/password auth | Eliminated all verification/reset flows by using Google OAuth only |
| Conversational correction ("no, it was...") | Inline structured editing is faster and more reliable; stateful LLM conversation is complexity trap |
| Verified nutritional label database | Incompatible with LLM estimation model; wrong product category |
| Micronutrient tracking | Phase 3 at earliest; requires different data model |
| Calorie burn / exercise logging | Different product domain; out of scope entirely |
| TDEE calculator in onboarding | Friction with no payoff for a 2-user personal app |
| Native mobile app (iOS/Android) | Web app serves use case; defer mobile native to v2+ |

---

## Traceability

Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| GOAL-01 | Phase 3 | Pending |
| GOAL-02 | Phase 3 | Pending |
| GOAL-03 | Phase 4 | Pending |
| INPUT-01 | Phase 3 | Pending |
| INPUT-02 | Phase 3 | Pending |
| INPUT-03 | Phase 3 | Pending |
| INPUT-04 | Phase 3 | Pending |
| LLM-01 | Phase 2 | Pending |
| LLM-02 | Phase 2 | Pending |
| LLM-03 | Phase 2 | Pending |
| LLM-04 | Phase 2 | Pending |
| LLM-05 | Phase 2 | Pending |
| CORR-01 | Phase 3 | Pending |
| CORR-02 | Phase 3 | Pending |
| CORR-03 | Phase 3 | Pending |
| CORR-04 | Phase 3 | Pending |
| CORR-05 | Phase 3 | Pending |
| CORR-06 | Phase 3 | Pending |
| LOG-01 | Phase 3 | Pending |
| LOG-02 | Phase 3 | Pending |
| LOG-03 | Phase 4 | Pending |
| DASH-01 | Phase 4 | Pending |
| DASH-02 | Phase 4 | Pending |
| DASH-03 | Phase 4 | Pending |
| ANLT-01 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30 ✓
- Unmapped: 0 ✓

---

*Requirements defined: 2026-06-09*
*Last updated: 2026-06-09 after initial definition*
