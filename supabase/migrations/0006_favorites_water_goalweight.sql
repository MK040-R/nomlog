-- NomLog v1.2: pinned favorite meals, water tracking, goal weight

-- Favorite meals: starred by the user, pinned to the "Log again" row.
-- sig is the normalized item signature (name|portion sorted) used to match
-- a logged meal back to its favorite.
CREATE TABLE IF NOT EXISTS favorite_meals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sig        TEXT NOT NULL,
  label      TEXT NOT NULL,
  items      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, sig)
);
ALTER TABLE favorite_meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own favorites" ON favorite_meals FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Water: glasses per local day.
CREATE TABLE IF NOT EXISTS water_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_on  DATE NOT NULL,
  glasses    INTEGER NOT NULL DEFAULT 0 CHECK (glasses >= 0 AND glasses <= 30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, logged_on)
);
ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own water" ON water_logs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Goal weight for the profile progress line.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS goal_weight_kg NUMERIC(5,1);
