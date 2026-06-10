-- NomLog: weekly recap cache (one AI-generated paragraph per user per IST week)
-- week_start is the IST Monday of the week the recap was generated in.
CREATE TABLE IF NOT EXISTS weekly_recaps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  recap      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS weekly_recaps_user_week ON weekly_recaps (user_id, week_start);

ALTER TABLE weekly_recaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own recaps"
  ON weekly_recaps
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
