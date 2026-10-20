ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "ordersStaleHours" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "duplicateOrderWindowMinutes" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "trackingCompletedWindowHours" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Order_branchId_customerPhone_createdAt_idx" ON "Order"("branchId", "customerPhone", "createdAt");
