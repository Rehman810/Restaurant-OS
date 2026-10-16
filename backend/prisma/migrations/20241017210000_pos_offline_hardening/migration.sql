CREATE TABLE IF NOT EXISTS "BranchPosOrderDayCounter" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "dayKey" TEXT NOT NULL,
  "lastSeq" INTEGER NOT NULL DEFAULT 1000,
  CONSTRAINT "BranchPosOrderDayCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BranchPosOrderDayCounter_branchId_dayKey_key" ON "BranchPosOrderDayCounter"("branchId", "dayKey");
ALTER TABLE "BranchPosOrderDayCounter" ADD CONSTRAINT "BranchPosOrderDayCounter_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "offlineClockSkewThresholdMinutes" INTEGER NOT NULL DEFAULT 10;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "serverReceivedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "clientClockSkewMinutes" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "clockSkewFlag" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CashMovement" ADD COLUMN IF NOT EXISTS "posClientMovementId" TEXT;
ALTER TABLE "CashMovement" ADD COLUMN IF NOT EXISTS "offlineClientCreatedAt" TIMESTAMP(3);
ALTER TABLE "CashMovement" ADD COLUMN IF NOT EXISTS "offlineDeviceLabel" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "CashMovement_posClientMovementId_key" ON "CashMovement"("posClientMovementId");
