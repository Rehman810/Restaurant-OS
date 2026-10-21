-- Flag users created by automated tests; backfill known test email patterns.
ALTER TABLE "User" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "User_isTest_idx" ON "User"("isTest");

UPDATE "User"
SET "isTest" = true
WHERE email ILIKE '%@test.local'
   OR email ~* '^(adm-br-|mgr-br-|cpy-adm-|admin-par-|admin-dash-|mgr-ds-|mgr-scope-|mgr-ext-|matrix-|cust-a-|cust-b-|chef-scope-|cashier-idor-|change-pw-|adm-ord-)';
