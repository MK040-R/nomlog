-- Newer Supabase projects no longer auto-grant table privileges to the API
-- roles for tables created in the SQL editor, so every query fails with
-- 42501 "permission denied" even though RLS policies exist. Grant explicitly.
--
-- anon is intentionally NOT granted: the app only reads/writes as a signed-in
-- user (authenticated, filtered by RLS) or via the server-side service_role.

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO authenticated, service_role;

-- Same for tables created by later migrations.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
