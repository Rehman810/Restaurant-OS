-- Enums
ALTER TYPE "InventoryUnit" ADD VALUE IF NOT EXISTS 'DOZEN';

ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'SALE_DEDUCTION';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'COUNT_CORRECTION';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'TRANSFER_IN';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'TRANSFER_OUT';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'REVERSAL';

CREATE TYPE "PurchasePaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'RECEIVED', 'VOIDED');
CREATE TYPE "WasteReason" AS ENUM ('EXPIRED', 'SPOILED', 'DROPPED', 'OVER_PREPARED', 'STAFF_MEAL', 'OTHER');
CREATE TYPE "StockCountStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');
CREATE TYPE "StockReferenceType" AS ENUM ('ORDER', 'PURCHASE', 'WASTE', 'COUNT', 'TRANSFER', 'ADJUSTMENT');

-- Ingredient categories
CREATE TABLE "IngredientCategory" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "IngredientCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IngredientCategory_restaurantId_name_key" ON "IngredientCategory"("restaurantId", "name");
ALTER TABLE "IngredientCategory" ADD CONSTRAINT "IngredientCategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Inventory item extensions
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "parLevel" DECIMAL(12,3);
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "trackExpiry" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "IngredientCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "InventoryItem_categoryId_idx" ON "InventoryItem"("categoryId");

ALTER TABLE "BranchStock" ADD COLUMN IF NOT EXISTS "avgCost" DECIMAL(10,4) NOT NULL DEFAULT 0;

ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "address" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "paymentTerms" TEXT NOT NULL DEFAULT '';

CREATE TABLE "SupplierItem" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "lastPrice" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupplierItem_supplierId_itemId_key" ON "SupplierItem"("supplierId", "itemId");
ALTER TABLE "SupplierItem" ADD CONSTRAINT "SupplierItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierItem" ADD CONSTRAINT "SupplierItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "referenceType" "StockReferenceType";
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "referenceId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "wasteLogId" TEXT;
CREATE INDEX IF NOT EXISTS "StockMovement_referenceType_referenceId_idx" ON "StockMovement"("referenceType", "referenceId");
CREATE INDEX IF NOT EXISTS "StockMovement_actorId_idx" ON "StockMovement"("actorId");
CREATE UNIQUE INDEX IF NOT EXISTS "StockMovement_order_item_sale_key" ON "StockMovement"("orderId", "itemId") WHERE "type" = 'SALE' AND "orderId" IS NOT NULL;

ALTER TABLE "InventoryPurchase" ADD COLUMN IF NOT EXISTS "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "InventoryPurchase" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "InventoryPurchase" ADD COLUMN IF NOT EXISTS "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "InventoryPurchase" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "InventoryPurchase" ADD COLUMN IF NOT EXISTS "total" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "InventoryPurchase" ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "InventoryPurchase" ADD COLUMN IF NOT EXISTS "paymentStatus" "PurchasePaymentStatus" NOT NULL DEFAULT 'UNPAID';
ALTER TABLE "InventoryPurchase" ADD COLUMN IF NOT EXISTS "status" "PurchaseStatus" NOT NULL DEFAULT 'RECEIVED';
ALTER TABLE "InventoryPurchase" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "InventoryPurchase" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);

ALTER TABLE "InventoryPurchaseLine" ADD COLUMN IF NOT EXISTS "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "InventoryPurchaseLine" ADD COLUMN IF NOT EXISTS "batchNo" TEXT;
ALTER TABLE "InventoryPurchaseLine" ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP(3);

CREATE TABLE "StockBatch" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "purchaseLineId" TEXT,
    "quantityRemaining" DECIMAL(12,3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockBatch_branchId_itemId_idx" ON "StockBatch"("branchId", "itemId");
CREATE INDEX "StockBatch_expiryDate_idx" ON "StockBatch"("expiryDate");
ALTER TABLE "StockBatch" ADD CONSTRAINT "StockBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockBatch" ADD CONSTRAINT "StockBatch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockBatch" ADD CONSTRAINT "StockBatch_purchaseLineId_fkey" FOREIGN KEY ("purchaseLineId") REFERENCES "InventoryPurchaseLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "WasteLog" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "itemId" TEXT,
    "menuItemId" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "reason" "WasteReason" NOT NULL,
    "costAtTime" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "WasteLog_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WasteLog" ADD CONSTRAINT "WasteLog_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_wasteLogId_fkey" FOREIGN KEY ("wasteLogId") REFERENCES "WasteLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "StockMovement_wasteLogId_key" ON "StockMovement"("wasteLogId");

CREATE TABLE "MenuRecipe" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "yieldPortions" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MenuRecipe_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MenuRecipe_menuItemId_key" ON "MenuRecipe"("menuItemId");
ALTER TABLE "MenuRecipe" ADD CONSTRAINT "MenuRecipe_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StockCount" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" "StockCountStatus" NOT NULL DEFAULT 'DRAFT',
    "countedById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StockCountLine" (
    "id" TEXT NOT NULL,
    "countId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "systemQty" DECIMAL(12,3) NOT NULL,
    "countedQty" DECIMAL(12,3),
    "variance" DECIMAL(12,3),
    "varianceCost" DECIMAL(12,2),
    CONSTRAINT "StockCountLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StockCountLine_countId_itemId_key" ON "StockCountLine"("countId", "itemId");
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_countId_fkey" FOREIGN KEY ("countId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockCountLine" ADD CONSTRAINT "StockCountLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT,
    "receivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shippedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StockTransferLine" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantitySent" DECIMAL(12,3) NOT NULL,
    "quantityReceived" DECIMAL(12,3),
    CONSTRAINT "StockTransferLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StockTransferLine_transferId_itemId_key" ON "StockTransferLine"("transferId", "itemId");
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "inventoryAllowNegative" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "inventoryAutoHideMenu" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "inventoryDeductAtPreparing" BOOLEAN NOT NULL DEFAULT true;
