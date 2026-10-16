CREATE TYPE "RiderCashEntryStatus" AS ENUM ('PENDING', 'SETTLED');

ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "riderCashStaleHours" INTEGER NOT NULL DEFAULT 24;

CREATE TABLE "RiderCashEntry" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "expectedAmount" DECIMAL(10,2) NOT NULL,
    "collectedAmount" DECIMAL(10,2) NOT NULL,
    "varianceReason" TEXT,
    "status" "RiderCashEntryStatus" NOT NULL DEFAULT 'PENDING',
    "settlementId" TEXT,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "RiderCashEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiderSettlement" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "settledById" TEXT NOT NULL,
    "expectedTotal" DECIMAL(10,2) NOT NULL,
    "receivedTotal" DECIMAL(10,2) NOT NULL,
    "variance" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiderSettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RiderCashEntry_orderId_key" ON "RiderCashEntry"("orderId");
CREATE INDEX "RiderCashEntry_branchId_status_deliveredAt_idx" ON "RiderCashEntry"("branchId", "status", "deliveredAt");
CREATE INDEX "RiderCashEntry_riderId_status_idx" ON "RiderCashEntry"("riderId", "status");
CREATE INDEX "RiderSettlement_branchId_createdAt_idx" ON "RiderSettlement"("branchId", "createdAt");
CREATE INDEX "RiderSettlement_riderId_createdAt_idx" ON "RiderSettlement"("riderId", "createdAt");

ALTER TABLE "RiderCashEntry" ADD CONSTRAINT "RiderCashEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiderCashEntry" ADD CONSTRAINT "RiderCashEntry_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiderCashEntry" ADD CONSTRAINT "RiderCashEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiderCashEntry" ADD CONSTRAINT "RiderCashEntry_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "RiderSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RiderSettlement" ADD CONSTRAINT "RiderSettlement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiderSettlement" ADD CONSTRAINT "RiderSettlement_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiderSettlement" ADD CONSTRAINT "RiderSettlement_settledById_fkey" FOREIGN KEY ("settledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
