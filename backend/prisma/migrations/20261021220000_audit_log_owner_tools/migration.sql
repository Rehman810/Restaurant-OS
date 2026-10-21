-- Audit log: readable entities, user agent, append-only enforcement
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "entityLabel" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

-- Preserve audit history when a branch is removed (avoid CASCADE DELETE hitting append-only trigger)
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_branchId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "AuditLog_entityLabel_idx" ON "AuditLog"("entityLabel");

CREATE OR REPLACE FUNCTION audit_log_deny_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON "AuditLog";
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON "AuditLog"
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_deny_mutation();

DROP TRIGGER IF EXISTS audit_log_no_delete ON "AuditLog";
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON "AuditLog"
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_deny_mutation();
