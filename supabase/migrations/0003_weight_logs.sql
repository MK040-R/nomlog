-- NomLog: weight history (one entry per day, drives the profile weight trend)
CREATE TABLE IF NOT EXISTS weight_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_on  DATE NOT NULL,
  weight_kg  NUMERIC(5,1) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, logged_on)
);

CREATE INDEX IF NOT EXISTS weight_logs_user_date ON weight_logs (user_id, logged_on);

ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own weights"
  ON weight_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
