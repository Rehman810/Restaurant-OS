-- Extend AuditLog for platform-wide audit (Phase 2)
ALTER TABLE "AuditLog" ALTER COLUMN "branchId" DROP NOT NULL;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "actorRole" "Role";
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "before" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "after" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "ip" TEXT;

CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
