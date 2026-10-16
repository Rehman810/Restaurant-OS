ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "offlinePosEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "posClientOrderId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "offlineLabel" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "offlineClientCreatedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "offlineDeviceLabel" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "clientClaimedTotal" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "needsReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "needsReviewReason" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_posClientOrderId_key" ON "Order"("posClientOrderId");
CREATE INDEX IF NOT EXISTS "Order_branchId_needsReview_idx" ON "Order"("branchId", "needsReview");
