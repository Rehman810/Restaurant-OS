CREATE TYPE "CashShiftStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "CashMovementType" AS ENUM ('SALE_CASH', 'REFUND_CASH', 'PAID_IN', 'PAID_OUT', 'RIDER_SETTLEMENT', 'ADJUSTMENT');

ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "shiftVarianceTolerance" DECIMAL(10,2) NOT NULL DEFAULT 500;

CREATE TABLE "CashShift" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "status" "CashShiftStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingCash" DECIMAL(10,2) NOT NULL,
    "closingCountedCash" DECIMAL(10,2),
    "closingDenominations" JSONB,
    "expectedCash" DECIMAL(10,2),
    "variance" DECIMAL(10,2),
    "note" TEXT,
    "closingManagerNote" TEXT,

    CONSTRAINT "CashShift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CashShift_branchId_status_idx" ON "CashShift"("branchId", "status");
CREATE INDEX "CashShift_cashierId_status_idx" ON "CashShift"("cashierId", "status");
CREATE INDEX "CashShift_openedAt_idx" ON "CashShift"("openedAt");
CREATE UNIQUE INDEX "CashShift_one_open_per_cashier_branch" ON "CashShift"("branchId", "cashierId") WHERE ("status" = 'OPEN');

CREATE INDEX "CashMovement_shiftId_createdAt_idx" ON "CashMovement"("shiftId", "createdAt");
CREATE INDEX "CashMovement_orderId_idx" ON "CashMovement"("orderId");

ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "CashShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
