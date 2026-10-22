-- Row level security. Superusers still bypass it. restaurant_app does not.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'restaurant_app') THEN
    CREATE ROLE restaurant_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;
GRANT restaurant_app TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO restaurant_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO restaurant_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO restaurant_app;

ALTER TABLE "Restaurant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Restaurant" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Restaurant";
CREATE POLICY tenant_isolation ON "Restaurant"
  USING (current_setting('app.tenant_bypass', true) = 'on' OR "id" = current_setting('app.tenant_id', true))
  WITH CHECK (current_setting('app.tenant_bypass', true) = 'on' OR "id" = current_setting('app.tenant_id', true));

DO $$ DECLARE r record; BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND c.column_name = 'restaurantId' AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', r.table_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (current_setting(''app.tenant_bypass'', true) = ''on'' OR "restaurantId" = current_setting(''app.tenant_id'', true)) WITH CHECK (current_setting(''app.tenant_bypass'', true) = ''on'' OR "restaurantId" = current_setting(''app.tenant_id'', true))', r.table_name);
  END LOOP;
END $$;
COMMIT;
