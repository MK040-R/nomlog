-- NomLog: personal profile fields (for greeting + BMI)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS name      TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS age       INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,1);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,1);
