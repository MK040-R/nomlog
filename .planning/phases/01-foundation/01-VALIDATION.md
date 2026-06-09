---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual smoke tests + shell CI checks (Phase 1 is infrastructure; no unit test framework needed yet) |
| **Config file** | `scripts/check-secrets.sh` — created in Wave 0 |
| **Quick run command** | `pnpm build` |
| **Full suite command** | `pnpm build && bash scripts/check-secrets.sh` + middleware redirect test |
| **Estimated runtime** | ~30–60 seconds (build) + ~5 min manual smoke |

---

## Sampling Rate

- **After every task commit:** Run `pnpm build` (catches TypeScript errors, server-only violations)
- **After every plan wave:** Run `pnpm build && bash scripts/check-secrets.sh` + middleware redirect curl test
- **Before `/gsd:verify-work`:** Full two-account RLS smoke test must pass + Gemini key grep returns empty + OAuth works on production Vercel URL
- **Max feedback latency:** Build feedback < 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| Schema migration | 01-01 | 1 | AUTH-04, AUTH-05 | smoke | `supabase db push` succeeds | ❌ W0 | ⬜ pending |
| RLS policies | 01-01 | 1 | AUTH-04, AUTH-05 | smoke | Two-account SQL smoke test (manual) | ❌ W0 | ⬜ pending |
| Supabase client factories | 01-01 | 1 | AUTH-01, AUTH-02 | build | `pnpm build` | ❌ W0 | ⬜ pending |
| Middleware | 01-02 | 1 | AUTH-02, AUTH-03 | smoke | `curl -w "%{http_code}" localhost:3000/dashboard` returns 302 | ❌ W0 | ⬜ pending |
| Login page | 01-02 | 1 | AUTH-01 | smoke | `curl localhost:3000/login \| grep -c 'email'` returns 0 | ❌ W0 | ⬜ pending |
| OAuth callback | 01-02 | 1 | AUTH-01, AUTH-02 | smoke | Manual: complete Google OAuth flow, land on dashboard | ❌ W0 | ⬜ pending |
| Sign out | 01-02 | 1 | AUTH-03 | smoke | Manual: tap sign out, verify redirect to /login | ❌ W0 | ⬜ pending |
| Gemini server-only guard | 01-02 | 1 | AUTH-05 (security) | automated | `bash scripts/check-secrets.sh` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/check-secrets.sh` — Gemini key leak detection; run after every build
- [ ] `supabase/migrations/0001_initial_schema.sql` — schema + RLS migration; must exist before Phase 2
- [ ] `types/database.types.ts` — generated from `supabase gen types typescript`; committed so TypeScript compiles

*These must exist before wave 1 tasks begin.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Session persists across browser close | AUTH-02 | Requires real OAuth session and browser close/reopen cycle | 1. Log in with Google. 2. Close browser entirely. 3. Reopen and navigate to app. 4. Verify no re-auth prompt. |
| Two accounts have zero data cross-visibility | AUTH-04 | Requires two authenticated Supabase sessions simultaneously | Run two-account RLS smoke test below. |
| RLS blocks cross-user write | AUTH-05 | Requires authenticated SQL injection attempt | Run step 3 of RLS smoke test below. |
| Google OAuth consent screen flow | AUTH-01 | Requires live Google OAuth credentials and redirect | 1. Navigate to /login. 2. Tap "Continue with Google". 3. Complete Google consent. 4. Verify redirect to /dashboard with session. |

---

## Two-Account RLS Smoke Test (Phase Exit Gate)

Must pass before Phase 2 begins. Run in Supabase SQL editor with RLS active.

**Step 1 — As User A, insert a test row:**
```sql
INSERT INTO meal_logs (user_id, meal_type, food_items, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g)
VALUES (auth.uid(), 'lunch', '[]'::jsonb, 500, 20, 60, 15, 5);
```

**Step 2 — As User B (different Google account), attempt to read User A's data:**
```sql
-- Should return only User B's own rows (0 if none logged)
SELECT COUNT(*) FROM meal_logs;

-- Direct attack by known User A UUID — should return 0
SELECT * FROM meal_logs WHERE user_id = '[User A UUID]';
```

**Step 3 — As User B, attempt cross-user insert (should be blocked):**
```sql
INSERT INTO meal_logs (user_id, meal_type, food_items, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g)
VALUES ('[User A UUID]', 'dinner', '[]'::jsonb, 300, 10, 40, 8, 3);
-- Expected: ERROR: new row violates row-level security policy
```

---

## Automated Check Scripts

**`scripts/check-secrets.sh`** (Wave 0 deliverable):
```bash
#!/bin/bash
set -e
echo "Checking for Gemini API key in client bundle..."
if grep -r "GEMINI_API_KEY" .next/static/ 2>/dev/null; then
  echo "FAIL: GEMINI_API_KEY found in client bundle"
  exit 1
fi
if grep -r "AIza" .next/static/ 2>/dev/null; then
  echo "WARNING: Possible API key pattern found in client bundle"
  exit 1
fi
echo "PASS: No API key in client bundle"
```

**Middleware redirect check:**
```bash
# Start dev server first, then:
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard
# Expected: 307 (redirect to /login)
```

**No email/password on login page:**
```bash
curl -s http://localhost:3000/login | grep -iE '(type="email"|type="password")' \
  && echo "FAIL: email/password input found" \
  || echo "PASS: no email/password input"
```

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (`pnpm build` counts)
- [ ] Wave 0 covers all MISSING references (scripts/check-secrets.sh, migration file, types)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s for automated checks
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
