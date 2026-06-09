-- NomLog Phase 1: Initial schema
-- user_profiles: per-user nutrition goals
-- meal_logs: logged meal entries with dedicated numeric totals (not computed from JSONB)

CREATE TABLE IF NOT EXISTS user_profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  goal_calories    INTEGER,
  goal_protein_g   NUMERIC(6,1),
  goal_carbs_g     NUMERIC(6,1),
  goal_fat_g       NUMERIC(6,1),
  goal_fiber_g     NUMERIC(6,1)
);

CREATE TABLE IF NOT EXISTS meal_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meal_type        TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  raw_input        TEXT,
  food_items       JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_calories   INTEGER NOT NULL DEFAULT 0,
  total_protein_g  NUMERIC(6,1) NOT NULL DEFAULT 0,
  total_carbs_g    NUMERIC(6,1) NOT NULL DEFAULT 0,
  total_fat_g      NUMERIC(6,1) NOT NULL DEFAULT 0,
  total_fiber_g    NUMERIC(6,1) NOT NULL DEFAULT 0,
  confidence       TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  input_source     TEXT CHECK (input_source IN ('voice', 'text')),
  edited           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index for the most common query: user's meals on a specific day
CREATE INDEX IF NOT EXISTS meal_logs_user_date ON meal_logs (user_id, logged_at);

-- Enable Row-Level Security on both tables
ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies: auth.uid() = user_id (NOT auth.uid() IS NOT NULL)
-- The IS NOT NULL form passes single-user tests but leaks all rows to any authenticated user.

CREATE POLICY "Users see own meals"
  ON meal_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users see own profile"
  ON user_profiles
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
