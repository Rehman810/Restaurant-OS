CREATE INDEX IF NOT EXISTS "Order_branchId_createdAt_idx" ON "Order"("branchId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_branchId_status_createdAt_idx" ON "Order"("branchId", "status", "createdAt");
