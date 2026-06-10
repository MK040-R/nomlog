# Requirements: NomLog

**Defined:** 2026-06-09
**Core Value:** Speak what you ate in under 30 seconds and never lose the data — the correction panel exists to fix estimates, not to slow down logging.

## v1 Requirements — ✅ SHIPPED (2026-06-10)

All v1 requirements are built, deployed to Vercel (nomlog-neon.vercel.app), and in daily use.

### Authentication (AUTH)

- [x] **AUTH-01**: User can sign in with their Google account via OAuth — no email/password option exists
- [x] **AUTH-02**: User session persists across browser closes without requiring re-login
- [x] **AUTH-03**: User can sign out explicitly from their profile screen
- [x] **AUTH-04**: Two different Google accounts have completely separate data with no cross-visibility
- [x] **AUTH-05**: Supabase RLS policies enforce per-user data isolation at the database level

### Goals (GOAL)

- [x] **GOAL-01**: User can set daily targets: calories, protein, carbs, fat, fiber (grams)
- [x] **GOAL-02**: Default goals pre-filled (2000 kcal / 90p / 250c / 65f / 30fi) until customized
- [x] **GOAL-03**: Goals editable any time from the profile (collapsible "Daily targets" row)

### Food Input (INPUT)

- [x] **INPUT-01**: Voice input via Web Speech API (`lang: 'en-IN'`), continuous listening until user taps stop; transcript shown live
- [x] **INPUT-02**: Text input always visible alongside the mic button
- [x] **INPUT-03**: Mic permission denial handled gracefully with explanation
- [x] **INPUT-04**: Handles English, Hinglish, and Indian food names

### LLM Parsing (LLM)

- [x] **LLM-01**: Parsed by Gemini server-side (`/api/parse`); key never in client bundle (lazy client, CI grep check)
- [x] **LLM-02**: Always returns a structured estimate; vague inputs get `confidence: "low"`
- [x] **LLM-03**: Per-item nutrition (name, portion, kcal, protein, carbs, fat, fiber) + confidence
- [x] **LLM-04**: Zod-validated; retried across model fallback chain (flash-lite primary → flash) before erroring
- [x] **LLM-05**: Errors preserve raw input; overload (503/429) shows honest "busy, try again" message

### Correction Panel (CORR)

- [x] **CORR-01**: Post-parse confirmation panel with individually editable rows; nothing saved without review
- [x] **CORR-02**: Edit name, portion, and all macro numbers; manual edits don't trigger LLM re-call
- [x] **CORR-04**: Add items ("add more" via LLM, or "+ add an item by hand") and delete items
- [x] **CORR-05**: Meal type shown and editable; auto-suggested by IST time of day
- [x] **CORR-06**: Low-confidence shows "Rough — tap a number to fix it"
- [~] **CORR-03**: Per-item LLM re-estimation on name/portion edit — *not built; "add more" + manual edit covers the need. Revisit only if requested.*

### Meal Logging (LOG)

- [x] **LOG-01**: Entries store user_id, logged_at, meal_type, raw_input, food_items JSONB, dedicated total columns, confidence, input_source, edited
- [x] **LOG-02**: Delete any logged entry from the daily view
- [x] **LOG-03**: Edit any logged entry inline (pencil icon → same editing panel); edits recompute totals server-side and set `edited=true`

### Dashboard (DASH)

- [x] **DASH-01**: Dashboard first screen after login: date, calories vs goal, macro progress with gram units
- [x] **DASH-02**: Chronological meal list + prominent log box (mic + text) on dashboard
- [x] **DASH-03**: Any past day reachable via ‹ › day navigation (`/dashboard?date=`); past days read-only

### Analytics (ANLT)

- [x] **ANLT-01**: 7-day calorie bar chart with goal line, avg/day, days logged, streak, average macros vs goal, most-eaten foods

### Added during v1 (originally out of scope, pulled in by owner)

- [x] **BODY-01**: Profile captures name, age, weight, height; live BMI with category
- [x] **BODY-02**: Weight history (`weight_logs`, one entry/day) with "+ Log" bottom sheet and weekly trend chart (Recharts)
- [x] **ACCT-01**: Delete account permanently (service-role admin delete; cascades all data)
- [x] **DSGN-01**: NomLog Design System v1.0 — paper-like, OKLCH tokens, Fraunces + Inter, hairline dividers, lucide icons
- [x] **PWA-01**: iOS home-screen shortcut support — safe-area insets, standalone mode, touch-action fixes

---

## v1.1 Requirements — AGREED, NOT YET BUILT

Defined 2026-06-10 with owner. Cost discipline matters: free Gemini tier.

### ASK — assistant grounded in user's data

- [ ] **ASK-01**: An "Ask" surface (own tab/entry). Named "Ask"/"Coach" — never "Chat"
- [ ] **ASK-02**: Free-text input always available; user can type any question
- [ ] **ASK-03**: 3–4 suggested prompt chips alongside input (e.g. "What can I eat now?", "How's my week?", "Suggest a dinner"); tapping submits
- [ ] **ASK-04**: Answers grounded in user's own data (compact summary of goals + today's intake + recent meals/weights); must not fabricate logged data
- [ ] **ASK-05**: Rolling context window (~2–3 exchanges) so follow-ups work; older turns drop off to keep cost flat
- [ ] **ASK-06**: Fresh session on leaving/returning — no long persisted chat history
- [ ] **ASK-07**: Answers render as design-system answer cards, not a bubble thread
- [ ] **ASK-08**: Reuses model fallback + honest "busy" messaging

### TIPS — daily nudge

- [x] **TIP-01**: Daily tip card on dashboard: one personalized sentence from today's data
- [x] **TIP-02**: Generated max once/day, cached in DB
- [x] **TIP-03**: Brand voice: warm, witty, never clinical or naggy

### WHAT-FITS — "What can I eat now?"

- [x] **FIT-01**: Given remaining calories + macros, suggest 2–3 specific Indian dishes/snacks that fit
- [x] **FIT-02**: On-demand (one call per tap); suggestions show name + rough kcal/macros
- [x] **FIT-03** *(nice-to-have)*: One-tap log a suggestion

### RECAP — weekly narrative

- [ ] **RCAP-01**: Short warm paragraph on the past 7 days (days logged, goal hits, weakest macro, encouragement) on Insights
- [ ] **RCAP-02**: Generated once/week, cached

### ANLT — analytics interactivity (owner request 2026-06-10)

- [x] **ANLT-02**: Tapping a day's bar in the 7-day chart opens that day's detail — meals + stats (navigate to `/dashboard?date=` or inline expand). Touch targets must be generous; current bars are not reliably tappable
- [x] **ANLT-03**: Monthly calendar view (beyond the 7-day window) — Apple-Fitness-style grid where each day is a colored marker:
  - **Red**: calories clearly over goal
  - **Green**: within ~±10% of goal
  - **Yellow**: well under goal
  - **Muted/empty**: nothing logged
- [x] **ANLT-04**: Tapping a calendar day opens that day's dashboard view
- [x] **ANLT-05**: Month navigation (previous/next month)

### QLOG — quick re-log (zero-cost, low priority)

- [ ] **QLOG-01**: One-tap re-log of a frequent/recent meal, no AI call

### Cross-cutting (NFR)

- [ ] **NFR-01**: All AI features server-side only; Gemini key never reaches client
- [ ] **NFR-02**: Cost discipline — tips/recap cached, Ask rolling window, what-fits on-demand only
- [ ] **NFR-03**: Only the signed-in user's RLS-scoped data
- [ ] **NFR-04**: Design-system compliant

**Suggested build order:** (1) TIP + FIT, (2) ANLT-02..05 (bar tap + calendar), (3) ASK, (4) RCAP, (5) QLOG.

---

## v2 Requirements

Still tracked, not scheduled.

- **ANLT-V2-03**: Export logs to CSV
- **PLAT-V2-03**: Habit/streak nudge system (partially covered by RECAP)

---

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Photo logging (Gemini Vision) | Dropped by owner decision 2026-06-10 |
| Offline queue / PWA sync | Dropped by owner decision 2026-06-10 |
| Push notification reminders | Dropped by owner decision 2026-06-10 |
| Barcode scanner | Wrong product category — NomLog uses LLM estimation by design |
| Social features / sharing logs | Personal household app; no audience for social |
| Email/password auth | Google OAuth only eliminates verification/reset flows |
| Multi-turn persistent chat | Cost trap on free tier; Ask uses rolling window instead |
| Verified nutritional label database | Incompatible with LLM estimation model |
| Micronutrient tracking | Requires different data model |
| Calorie burn / exercise logging | Different product domain |
| TDEE calculator in onboarding | Friction with no payoff |
| Native mobile app (iOS/Android) | Home-screen web shortcut serves the use case |

*(Note: weight/body tracking was originally out of scope but was pulled into v1 by owner request and shipped — see BODY-01/02.)*

---

*Requirements defined: 2026-06-09*
*Last updated: 2026-06-10 — TIP, FIT and ANLT-02..05 shipped (tips, what-fits + one-tap log, tappable bars, monthly calendar). Pending owner step: apply supabase/migrations/0004_daily_tips.sql so tips cache once/day. Remaining v1.1: ASK, RCAP, QLOG.*
