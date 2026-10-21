-- Additive inventory enhancements
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "purchaseUnit" "InventoryUnit";
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "conversionFactor" DECIMAL(12, 4) NOT NULL DEFAULT 1;
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "isPackaging" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "defaultPackagingItemId" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "defaultPackagingQty" DECIMAL(12, 3) NOT NULL DEFAULT 1;

ALTER TABLE "StockCount" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StockCount" ADD COLUMN IF NOT EXISTS "countType" TEXT NOT NULL DEFAULT 'FULL';

CREATE TABLE IF NOT EXISTS "SupplierPayment" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "method" TEXT NOT NULL DEFAULT 'CASH',
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reference" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupplierPayment_supplierId_paidAt_idx" ON "SupplierPayment"("supplierId", "paidAt");
CREATE INDEX IF NOT EXISTS "SupplierPayment_branchId_idx" ON "SupplierPayment"("branchId");

DO $$ BEGIN
  ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "whatsapp" TEXT NOT NULL DEFAULT '';
