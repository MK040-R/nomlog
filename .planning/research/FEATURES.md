# Feature Research

**Domain:** Voice-first food logging and nutrition tracking web app (personal use, 2-user household)
**Researched:** 2026-06-09
**Confidence:** MEDIUM — WebSearch and WebFetch unavailable; analysis draws from training knowledge of MyFitnessPal, Cronometer, Lose It, Noom, Yummly, and voice-first app UX patterns (Siri, Google Assistant, Otter.ai). Training cutoff August 2025. Verified against PROJECT.md decisions where applicable.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features whose absence causes the product to feel broken — not features users praise, but features whose absence causes abandonment.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Today's calorie total, prominently displayed | Every food tracker puts the daily calorie number front and center; missing it feels like missing a speedometer | LOW | Running total, not just end-of-day. Update after every log. |
| Macro breakdown (protein / carbs / fat) | MFP made macros standard UX in 2013; users who care about protein will abandon without it | LOW | Progress bars against goal are the visual convention; absolute grams + % of goal |
| Chronological meal list for today | Users need to review what they logged; scrollable list by meal time is the baseline | LOW | Grouped by meal type (breakfast/lunch/dinner/snack) or by time; both are valid |
| Log entry editing after save | Food estimates change; users realize they logged 2 rotis not 3; no edit = no trust | MEDIUM | Must show "edited" state; undo is expected for accidental changes |
| Goal setting for calories and macros | Without personalized targets, the progress bars have no meaning | MEDIUM | Defaults must be reasonable so the app works before the user customizes |
| Persistent sessions (no re-login on every visit) | Auth re-prompts on mobile are abandonment events | LOW | OAuth tokens with refresh; Supabase handles this |
| Clear input affordance (the primary CTA) | Users must instantly know how to log; a buried input is a dead product | LOW | Floating action button or persistent bottom bar; never hidden in menus |
| Feedback that a log was saved | Without confirmation, users log twice or assume it failed | LOW | Toast or inline confirmation; must appear within 500ms of save |
| Yesterday's log (read + edit) | Users skip logging dinner, catch up the next morning; "yesterday" view is expected | LOW | Same layout as today; editing must work identically |
| Per-user data isolation in multi-user households | Logging into a shared device and seeing another person's food is a trust-breaker | LOW | RLS enforced at DB layer; not a UI feature, but visible in whose data appears |

### Differentiators (Competitive Advantage)

Features that set NomLog apart from MFP/Cronometer for the specific use case of Indian home-cooked food logging via voice.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Natural language voice input ("2 katoris of dal tadka with rice") | The core insight: MFP requires searching a database; NomLog requires speaking a sentence. This is the entire product | HIGH | Web Speech API for transcription; Gemini for parsing. The UX around this moment is the product's identity. |
| LLM parsing of culturally-specific food with no database | Dal tadka, rajma chawal, poha with sev — none exist in MFP's database reliably. LLM estimation makes these loggable | HIGH | Gemini 2.5 Flash with an Indian-food-aware system prompt. The prompt quality is the product quality. |
| Hinglish / mixed-language input ("aaj lunch mein chole bhature khaaye") | Users of Indian home cooking narrate food in Hinglish; requiring English-only is a friction source | MEDIUM | Gemini handles multilingual input well. Web Speech API language detection may need explicit configuration. |
| Confidence indicators per item ("~320 cal, medium confidence") | LLM estimates carry variance; hiding this creates distrust when corrections are needed. Surfacing it creates informed users | LOW | Per-item confidence from Gemini response JSON. Visual indicator (low/medium/high or color). |
| Pre-save correction panel with per-item re-estimation | The correction flow is not a fallback — it is the designed interaction for ambiguous estimates. This is the resolution path, not an error state | HIGH | Editable line items, per-item re-estimate button (not full meal re-parse), add/delete items. Must be faster than re-logging from scratch. |
| Meal type auto-suggestion with override | Time-of-day heuristic (before 10am = breakfast, etc.) saves a tap for most meals | LOW | Server-side suggestion from timestamp; user can override with a single tap |
| <30 second end-to-end logging | The product promise. Speaking a meal and seeing it confirmed in under 30 seconds is the reason to use NomLog over MFP | HIGH | Every interaction in the log→parse→correct→save flow must be measured against this |
| Post-save inline editing with undo toast | MFP requires entering the full editing flow to change a logged item; inline editing on the dashboard is faster | MEDIUM | Edit in place, "edited" badge, undo for 5 seconds. Not a modal — inline. |
| Plain-language weekly macro flags | "You hit your protein goal 4 of 7 days" is more actionable than a chart | LOW | Rule-based, not LLM. Arithmetic over stored data. |

### Anti-Features (Explicitly Avoid)

Features that seem appealing but are complexity traps, wrong-product signals, or scope creep for a 2-user personal tool.

| Feature | Why Requested | Why It's a Trap | Alternative |
|---------|---------------|-----------------|-------------|
| Barcode / food label scanning | Fast logging for packaged foods; popular in MFP | Wrong product category. NomLog's core value is unstructured home-cooked food. A barcode scanner requires maintaining a food database or integrating a third-party database API (Open Food Facts, USDA), which is the exact problem NomLog sidesteps. It also fragments UX — do I scan or speak? | Keep voice as the only primary input. Packaged food can be voiced ("100g of Amul butter") and estimated adequately |
| Conversational correction ("no, actually it was chicken not paneer") | Seems natural for a voice-first app | Requires stateful conversation management, turn-taking UX, and a much more complex LLM prompt. The inline structured correction panel is faster and more reliable — you see exactly what changed. Conversational correction also fails when the user is hands-free but the correction requires precision. | Inline structured editing: tap the item, change the value, re-estimate if needed |
| Verified nutritional label database | "Accurate" nutrition data feels more trustworthy | LLM estimation is the product's thesis for home-cooked food. Adding a verified database creates two classes of data (verified vs. estimated) requiring UI distinction everywhere. For a 2-user personal app, the ±20-30% variance is understood and accepted. A database integration adds maintenance burden with no benefit for the target food types. | Document the LLM-estimation model, communicate confidence levels, let users correct |
| Exercise / calorie burn logging | Natural companion to calorie tracking | Completely different domain — requires activity database, heart rate data, or manual entry. Adds cognitive load (net calories vs. gross calories) and UI complexity. For a 2-person personal app with defined scope, this is pure scope creep. | Out of scope. If a user wants exercise tracking, they use a fitness app and check NomLog separately |
| Social features (share meals, friend comparison) | Community and accountability are engagement drivers in consumer apps | This is a 2-user household app, not a consumer product. Social features require trust/safety systems, content moderation thinking, and push notification infrastructure. The "social pressure" engagement mechanism is not the right model for a personal logging tool. | Direct household sharing (both users' goals visible to each other if desired) can be added as a simple feature later |
| AI meal planning / recipe suggestions | Natural extension of tracking what you eat | Requires a separate LLM flow with different prompting, meal plan data structures, and a recipe database. It's a different product — a meal planner — duct-taped onto a logger. The logging loop must be proven before planning is worth building. | Defer to Phase 2, and only if the logging habit is established and the user explicitly requests it |
| Weight / body metrics tracking | Common in MFP; macro tracking often correlates with weight goals | Different data model, different charts, different user mental model. Weight tracking with calorie tracking implies weight management goals — which NomLog deliberately doesn't frame itself around. Adding it changes the product's emotional register. | Out of scope. Recommend a dedicated app (Happy Scale, Libra) if users want this |
| Micronutrient tracking (vitamins, minerals, fiber) | Cronometer users love this; "complete picture" of nutrition | LLM accuracy for micronutrients is extremely low — variance on calcium or vitamin C from a home-cooked meal is not ±20-30%, it's ±200%. Displaying this data would be misleading. Fiber is the exception (added to macros is defensible). | Calories + protein + carbs + fat + fiber is the maximum reliable set for LLM estimation |
| Push notifications / reminders | "Don't forget to log dinner!" | Web push notifications require service workers, permission prompts, and browser-specific implementation complexity. For a personal app with 2 motivated users, reminders add infrastructure without addressing the real dropout cause (logging is too tedious). | Solve tedium with voice speed, not reminders |
| Offline mode | Useful for users who log in areas with poor connectivity | Requires service workers, IndexedDB sync, conflict resolution — significant engineering for a web app. The target user (urban household) has reliable connectivity at meal times. | Graceful error states when the network drops; don't build full offline sync |
| Import from MFP / Cronometer | Onboarding from existing apps feels smooth | Users switching from MFP to NomLog for Indian food are not migrating their history — they're starting fresh. An import flow for incompatible data is a launch blocker with near-zero payoff for a 2-user app. | Clean slate onboarding; history starts when NomLog starts |
| Complex goal calculations (TDEE, BMR, activity level) | "Set realistic goals based on my stats" | Accurate TDEE requires validated inputs (height, weight, activity level) and a computation model. For a personal app where the builder knows the users, sensible defaults + manual goal setting is sufficient. TDEE calculators feel like a health app feature, not a food logger feature. | Flat calorie and macro goal inputs. Default: 2000 kcal, 150g protein, 50g fat, 200g carbs. User overrides freely. |

---

## Feature Dependencies

```
Voice input (Web Speech API)
    └──feeds──> Text transcription
                    └──feeds──> LLM parse (Gemini)
                                    └──returns──> Structured nutrition JSON
                                                      └──populates──> Pre-save correction panel
                                                                          └──on save──> Meal log entry (Supabase)
                                                                                            └──aggregates──> Today's dashboard
                                                                                                                └──accumulates──> Weekly analytics

Text input (fallback)
    └──feeds──> LLM parse (Gemini)   [same path from here]

Per-user goals (onboarding)
    └──required by──> Progress bars on dashboard (bars have no meaning without targets)
    └──required by──> Weekly macro flags ("below protein goal 4 days")

Auth (Google OAuth)
    └──required by──> Per-user data isolation (RLS)
    └──required by──> Household 2-user model

Per-item re-estimation
    └──depends on──> Pre-save correction panel (UI context)
    └──depends on──> Gemini (same API, different prompt scope)

Post-save inline editing
    └──depends on──> Meal log entry (must exist before editing)
    └──enhances──> Yesterday's view (edit yesterday's entries)
```

### Dependency Notes

- **Dashboard requires goals:** Calorie/macro progress bars are meaningless without a target. Goal setting must be complete before the user sees the dashboard for the first time — either via onboarding or sensible defaults that activate immediately.
- **Correction panel is pre-save, inline editing is post-save:** These are two distinct editing flows with different triggers. Pre-save: the user is reviewing before committing. Post-save: the user is correcting a committed entry. Both must exist; they serve different recovery moments.
- **Voice input depends on browser, not app:** Web Speech API availability varies by browser. The app must handle unavailability silently (no mic button shown) and promote text input. This is a runtime dependency, not a build-time one.
- **Weekly analytics depends on 7 days of data:** The analytics view is meaningless until there are entries. The empty state for week 1 must not look broken.

---

## UX Pattern Analysis

This section provides specific, concrete guidance on the five focus areas from the research brief.

### 1. LLM Correction Flow (Pre-Save and Post-Save)

**The problem:** LLM-estimated nutrition data is wrong often enough (±20-30% for home-cooked Indian food) that a correction path is not optional — it is load-bearing. How the correction feels determines whether users trust the data.

**What works (industry pattern):**

- **Show items as a list, not a form.** Each food item parsed from the input gets its own row. The row shows: food name, quantity, calories, protein/carbs/fat. This mirrors how MFP shows multi-food search results.
- **Inline edit on tap, not a modal.** Tapping a value opens an inline input on that row. No navigation away. No modal overlay. The user sees the full list while editing one value.
- **Per-item re-estimate button (not re-parse full meal).** "Recalculate for this item" sends only that item back to Gemini with the corrected quantity. This is faster (<2s vs 3-5s for full re-parse) and doesn't disturb already-accepted rows.
- **Add/delete items.** The LLM may miss an item or hallucinate one. A trash icon per row and an "add item" affordance at the bottom of the list complete the correction surface.
- **Confidence indicator per item.** Low-confidence items should have a visual signal (amber text, a "~" prefix before calorie count, or a subtle warning icon). This primes the user to check those items, rather than discovering wrong data after save.
- **"Save anyway" is always visible.** Correction is optional. The save CTA must not require any correction. Users who trust the estimate should be able to save in one tap from the correction panel.
- **Post-save: inline edit on the dashboard entry.** The logged entry in the meal list shows an edit (pencil) icon. Tapping opens an editable row, same as the pre-save panel. An "edited" badge marks corrected entries. An undo toast (5-second window) handles accidental edits.

**What doesn't work:**

- Conversational re-correction ("no, that was 250g, not 100g"). Requires LLM state management, multi-turn context, and parsing ambiguous corrections. The inline panel gives direct, unambiguous control.
- Full-meal re-parse on any edit. Changes one item but discards user corrections on other items. Destroys trust in the correction panel.
- Requiring correction before save. Correction is the user's choice. Forced review for every log entry breaks the <30s promise.

**Confidence:** HIGH (pattern is consistent across MFP, Cronometer, and emerging LLM-powered food apps from 2024-2025 like Calorie Mama, Macrof).

---

### 2. Voice Input UX Patterns

**The problem:** Voice input on the web is technically constrained (Web Speech API, no persistent background listening) and psychologically unfamiliar (users have habituated to typing on phones). The UX around the mic moment makes or breaks adoption.

**What works:**

- **Pulsing/animated mic button while recording.** Visual state is essential. A static mic icon gives no feedback that the app is listening. The canonical pattern: mic button tapped → button animates (pulse, ring, waveform) → user speaks → animation stops → transcription appears.
- **Show live transcription as the user speaks (if available).** Web Speech API returns interim results — display them in the input field in real-time. This gives the user confidence the app is capturing their words. Interim results should appear visually distinct (lighter text) from final results.
- **Keep transcription in an editable text field.** After speaking, the transcription must be editable before submitting. "2 katoris of dal" might transcribe as "2 katoris of dull" — the text field is the correction affordance for transcription errors, not nutrition errors.
- **Single CTA after transcription.** "Parse this" or a send button. The user should not have to decide between "re-record" and "submit" — just edit the text if needed, then submit.
- **Graceful unavailability.** When Web Speech API is absent (Firefox desktop, certain WebViews), the mic button simply doesn't render. The text input is the primary affordance. No error messages, no explanations. The text input is never hidden.
- **Session timeout handling.** Web Speech API sessions time out after ~60 seconds of silence. If the user is still thinking, the session ends. The UI must handle this gracefully — mic returns to idle state, transcription preserves whatever was captured, no error message.
- **Tap anywhere to stop recording.** Don't require tapping the mic button again to stop. Any tap outside the input area, or a submit action, should end the session.

**What doesn't work:**

- Hold-to-speak (push-to-talk). Requires sustained finger contact; fatiguing for meal descriptions longer than 5 seconds. Tap-to-toggle is the right model.
- Automatic submission on silence detection. If the user pauses mid-sentence, silence detection triggers submission prematurely. Always require an explicit submit action.
- Playing audio feedback ("I heard: 2 katoris..."). Adds a step. The transcription display is sufficient and faster.
- Requiring headphones/microphone check or permissions explanation before first use. Browser will prompt for mic permission natively. Don't add a pre-permission screen.

**Confidence:** MEDIUM-HIGH (Web Speech API behavior is from direct technical knowledge; UX patterns from voice-first apps including Siri, Google Assistant task apps, and dictation-first apps like Otter.ai and voice memo apps).

---

### 3. Dashboard Patterns for Daily Nutrition Summary

**The problem:** Mobile dashboard real estate is scarce. Too much information = visual noise; too little = users can't self-regulate. The hierarchy must surface the most decision-relevant data first.

**What works (information hierarchy on mobile):**

**Top section — Progress summary (above the fold, always visible):**
- Large calorie number: consumed / goal (e.g., "1,340 / 2,000 kcal")
- Remaining prominently labeled: "660 remaining" or styled in a different color if over goal
- Three macro bars: protein, carbs, fat — each showing grams consumed vs. goal. Progress bars with current value and goal value labeled at the end. Fat is least urgent; protein is most tracked by this user type — order: protein > carbs > fat.
- Fiber bar is optional, can be collapsed by default.

**Middle section — Meal list:**
- Grouped by meal type (Breakfast / Lunch / Dinner / Snacks) with collapsible sections
- Each group shows total calories for that meal
- Individual entries within each group: food name, portion description, calorie count
- Edit icon (pencil) on each entry — accessible without expanding to a detail view
- "Add meal" affordance at bottom of each group (or a single floating "Log food" button)

**Bottom section (or nav):**
- Date navigation: previous/next day arrows flanking the date label. "Today" button to jump back.
- Weekly analytics tab/nav item — not on the dashboard itself

**What doesn't work:**

- Ring/donut charts for macro breakdown. Visually appealing but harder to read precise values than progress bars. MFP uses donut charts and users frequently misread them.
- Putting the log CTA inside the meal list (e.g., inline "+ Add food" links). These compete visually with entries. A floating action button or persistent CTA at the bottom is faster.
- Showing calorie burn / exercise calories on the dashboard when exercise tracking isn't a feature. "Net calories" requires exercise data; don't show a "net" field that's always identical to consumed.
- Collapsing macros by default. Users who care about macros (this app's audience) need them visible without a tap.

**Mobile-specific constraints for NomLog's 390px viewport:**
- Progress bars at 390px: label left-aligned, value right-aligned, bar full width. Works cleanly.
- Meal group headers with calorie total: use a chevron for expand/collapse if entries get long.
- Touch targets: meal entry edit icons must be 44×44px minimum — tap area, not visual size.

**Confidence:** HIGH (MFP, Cronometer, Lose It dashboards are extensively documented in UX reviews; pattern is consistent across the category).

---

### 4. Weekly Analytics Patterns

**The problem:** Most analytics features in consumer nutrition apps are visual noise — beautiful charts that users look at once and never return to. For a personal-use app with 2 users, analytics must be actionable, not decorative.

**What is actually useful:**

- **7-day calorie bar chart.** Simple, immediate. Each bar is one day; goal shown as a horizontal line. Users can instantly see "I hit goal 3 times this week." Recharts BarChart with a ReferenceLine for the goal. Color bars above the goal line differently (e.g., amber) to highlight overage at a glance.
- **Macro averages vs. goal.** A small table or three summary rows: "Avg protein: 89g / 150g goal" for each macro. Plain numbers, not a chart. The chart adds nothing here — the question is "am I consistently hitting my targets?" which is answered by a ratio, not a visualization.
- **Plain-language flags.** "You hit your protein goal 2 out of 7 days." "Your carbs averaged 23% over goal." These are computed by simple arithmetic from stored data. They are more actionable than a chart because they tell the user what to do differently. The exact NomLog design decision (rule-based, not LLM, in V1) is correct — this is arithmetic.
- **Streak or consistency indicator.** "5-day logging streak" is motivating and costs nothing to compute. Not a chart — a number and a short label.

**What is visual noise (don't build):**

- Macro split pie/donut chart. Users already have daily macro bars. The weekly aggregate pie chart is a third level of abstraction that answers no specific question.
- Day-of-week heatmap ("you tend to overeat on Saturdays"). Interesting once; forgotten after. Too much data volume needed for statistical reliability (need months of data, not 1-2 weeks).
- Trend lines / moving averages. Meaningful only with 4+ weeks of data. In the first month of a personal app, trend lines are meaningless noise.
- Calorie vs. goal radial / gauge chart. Aesthetically common, informationally weak. The bar chart is strictly better.
- Animated chart transitions. Adds latency and zero information. Recharts animations should be disabled or set to very short durations for production data.

**The weekly analytics page layout for NomLog (mobile, 390px):**
1. Date range label: "Week of Jun 2 – Jun 8" with prev/next week navigation
2. 7-day calorie bar chart (full width, ~200px tall)
3. Macro averages: three rows (protein, carbs, fat), each showing average vs. goal
4. Plain-language flags (2-4 bullets, computed from data)
5. Streak count (days logged this week / 7, and current consecutive streak)

**Confidence:** MEDIUM-HIGH (pattern synthesized from MFP weekly reports, Cronometer nutrient trends, and UX writing principles; the "charts users ignore" finding is from general UX research on dashboard engagement, not food-app-specific data).

---

### 5. Onboarding Patterns for Nutrition Goal Setting

**The problem:** Goal-setting onboarding is the first moment users are asked to do work. Long onboarding = abandonment. For a 2-user personal app, the stakes are lower (builder and partner are motivated), but the pattern still matters because goals are required before the dashboard is meaningful.

**What works:**

- **Sensible defaults, presented as a starting point not a recommendation.** "We've set a default of 2,000 calories. Adjust if you know your target." Users who don't know their TDEE can start immediately. Users who do know can change one number. No calculation screen required.
- **One screen, not a wizard.** For a personal app, the onboarding form can be a single screen: display name, calorie goal, protein goal, carbs goal, fat goal. Pre-filled with defaults. User changes what they know, skips the rest. Save. Done.
- **Skip-able / editable later.** Goals must be editable from profile/settings at any time. The onboarding prompt is not a gate — if the user skips, defaults activate and the dashboard works immediately.
- **No TDEE calculator in the onboarding flow.** Asking for height, weight, age, and activity level in a 2-user personal app adds friction for marginal precision. The user can calculate TDEE externally and enter the number. Or use the default and adjust based on how their weight responds.
- **No "why are you logging?" questionnaire.** NomLog is a personal tool. The user knows why they're using it. Skip the motivation survey that consumer apps use for segmentation.

**What doesn't work:**

- Multi-step onboarding wizard (step 1 of 5). Each step is an abandonment opportunity. One screen is strictly better for a known motivated user.
- Required goal entry before any use. If the user signs in and wants to immediately log a meal (to see if the voice input works), a blocking goal-setting screen is hostile. Defaults should activate on first sign-in.
- "Recommended" goals based on user-entered metrics. Without validated medical data and disclaimers, any "recommendation" is noise that competes with the user's own knowledge of their body.

**Confidence:** MEDIUM (onboarding abandonment patterns are well-documented in consumer apps; the specific recommendation to skip TDEE calculators for personal apps is from UX first-principles, not a published study).

---

## MVP Definition

### Launch With (Alpha v1)

The full log → parse → correct → save → dashboard loop, working for both users.

- [ ] Google OAuth sign-in + per-user data isolation (RLS) — without this, nothing else is safe to ship with 2 users
- [ ] Per-user goal setting with sensible defaults — dashboard is meaningless without targets
- [ ] Voice input (Web Speech API) with text fallback — the core UX interaction
- [ ] Gemini 2.5 Flash LLM parsing with structured JSON output + confidence per item — the core intelligence
- [ ] Pre-save correction panel: editable line items, per-item re-estimation, add/delete, confidence indicators — load-bearing for trust
- [ ] Meal log storage (Supabase Postgres) — data must persist
- [ ] Today's dashboard: calorie total, macro progress bars, chronological meal list — the feedback loop
- [ ] Post-save inline editing with "edited" badge and undo toast — corrections after save are inevitable
- [ ] Yesterday's view (same layout, entries editable) — morning catch-up use case

### Add After Validation (v1.x)

- [ ] Weekly analytics: 7-day calorie bar chart + macro averages vs. goal + plain-language flags — add when 7+ days of data exist to make it non-empty
- [ ] Meal type auto-suggestion from timestamp — quality-of-life improvement, low complexity

### Future Consideration (v2+)

- [ ] Image-based food logging — when LLM image parsing is verified accurate enough for production use
- [ ] Micronutrient tracking (fiber only first) — if LLM accuracy proves sufficient for fiber estimates
- [ ] Household goal visibility (see partner's progress) — only if explicitly requested by both users

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Voice input + LLM parse | HIGH | HIGH | P1 |
| Pre-save correction panel | HIGH | HIGH | P1 |
| Today's dashboard (calorie + macros) | HIGH | LOW | P1 |
| Auth + RLS (2-user isolation) | HIGH | MEDIUM | P1 |
| Post-save inline editing | HIGH | MEDIUM | P1 |
| Goal setting (onboarding) | HIGH | LOW | P1 |
| Yesterday's view | MEDIUM | LOW | P1 |
| Meal type auto-suggestion | MEDIUM | LOW | P2 |
| Weekly analytics (bar chart + flags) | MEDIUM | MEDIUM | P2 |
| Confidence indicators per item | MEDIUM | LOW | P1 |
| Undo toast (post-edit) | MEDIUM | LOW | P1 |
| Streak / consistency indicator | LOW | LOW | P3 |
| Fiber tracking | LOW | LOW | P3 |
| Per-item re-estimation | HIGH | MEDIUM | P1 |

---

## Competitor Feature Analysis

| Feature | MyFitnessPal | Cronometer | Lose It | NomLog Approach |
|---------|--------------|------------|---------|-----------------|
| Food entry method | Database search + barcode + camera | Database search + barcode | Database search + barcode | Voice → LLM parse (no database) |
| Indian home-cooked food | Sparse, user-contributed entries | Sparse | Sparse | LLM estimation by design |
| Hinglish input | Not supported | Not supported | Not supported | Supported via Gemini multilingual |
| Correction/editing | Full-page edit form, re-search | In-line but complex | Modal edit form | Inline on correction panel; per-item re-estimate |
| Macro tracking | 3 macros + fiber + more | Full micronutrients | 3 macros | 4 macros (protein/carbs/fat/fiber optional) |
| Dashboard | Calorie ring + macro donut + diary | Calorie bar + nutrient list | Calorie summary + diary | Progress bars + macro bars + meal list |
| Weekly view | Premium feature | Built-in | Built-in (premium for details) | Bar chart + plain-language flags (free, rule-based) |
| Voice input | None (2025) | None | None | Primary input method |
| Onboarding | Long wizard + goal calculator | Comprehensive profile + goals | Short wizard | One screen, defaults, skippable |
| Cost | Freemium (heavy feature-gating) | Freemium | Freemium | Personal use, no paywall |
| Multi-user | Separate accounts | Separate accounts | Separate accounts | Separate accounts + shared infrastructure |

---

## Sources

**Confidence note:** WebSearch and WebFetch were unavailable during this research session. All findings are from training knowledge (cutoff August 2025) of the following sources, supplemented by the NomLog PROJECT.md which encodes builder research decisions:

- MyFitnessPal iOS/web app UX (widely documented in UX case studies and app store reviews)
- Cronometer web app UX (direct functional knowledge; well-documented)
- Lose It app UX (app store review corpus and UX teardowns)
- Noom's onboarding pattern (widely cited in mobile onboarding UX literature)
- Web Speech API MDN documentation (authoritative technical reference)
- Google Voice Search and Siri voice-first UX patterns (widely documented)
- Otter.ai live transcription UX (voice-first web app pattern reference)
- Recharts documentation for chart type evaluation
- NomLog PROJECT.md (primary source — builder's validated design decisions take precedence over generic patterns)

**Flags for phase-specific verification:**
- Confirm Web Speech API behavior on iOS Safari (has known quirks with interim results and session timeouts) before voice input UX is finalized
- Verify Gemini 2.5 Flash multilingual (Hinglish) accuracy empirically — the 20+ Indian food test required in PROJECT.md should include 5+ Hinglish inputs
- Recharts BarChart with ReferenceLine: verify current API against Context7 when implementing weekly analytics

---

*Feature research for: Voice-first food logging and nutrition tracking web app*
*Researched: 2026-06-09*
