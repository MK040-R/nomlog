-- NomLog: daily tip cache (one AI-generated nudge per user per IST day)
-- Generated lazily on first dashboard visit of the day; never regenerated.
CREATE TABLE IF NOT EXISTS daily_tips (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tip_date   DATE NOT NULL,
  tip        TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tip_date)
);

CREATE INDEX IF NOT EXISTS daily_tips_user_date ON daily_tips (user_id, tip_date);

ALTER TABLE daily_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own tips"
  ON daily_tips
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
