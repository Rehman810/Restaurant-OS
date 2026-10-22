-- Delivery areas: extended fields, pause records, branch coverage, order snapshots

ALTER TABLE "DeliveryArea" ADD COLUMN IF NOT EXISTS "slug" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DeliveryArea" ADD COLUMN IF NOT EXISTS "covers" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "DeliveryArea" ADD COLUMN IF NOT EXISTS "minOrder" DECIMAL(10,2);
ALTER TABLE "DeliveryArea" ADD COLUMN IF NOT EXISTS "freeAbove" DECIMAL(10,2);
ALTER TABLE "DeliveryArea" ADD COLUMN IF NOT EXISTS "etaMinMinutes" INTEGER;
ALTER TABLE "DeliveryArea" ADD COLUMN IF NOT EXISTS "etaMaxMinutes" INTEGER;
ALTER TABLE "DeliveryArea" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "DeliveryArea" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "DeliveryArea" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "DeliveryArea" SET "slug" = lower(regexp_replace(trim("name"), '[^a-zA-Z0-9]+', '-', 'g')) WHERE "slug" = '';

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryAreaNameSnap" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryEtaMinSnap" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryEtaMaxSnap" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryAddressAreaWarning" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Order" o
SET "deliveryAreaNameSnap" = a."name"
FROM "DeliveryArea" a
WHERE o."deliveryAreaId" = a."id" AND o."deliveryAreaNameSnap" IS NULL;

ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "deliveryEstimateMax" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "deliveryChargeSanityLimit" INTEGER NOT NULL DEFAULT 3000;

DROP INDEX IF EXISTS "DeliveryArea_name_key";

CREATE UNIQUE INDEX "DeliveryArea_restaurant_active_name_ci"
  ON "DeliveryArea" ("restaurantId", lower("name"))
  WHERE "archivedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "DeliveryArea_restaurant_archived_delivering_sort"
  ON "DeliveryArea" ("restaurantId", "archivedAt", "isDelivering", "sortOrder");

CREATE INDEX IF NOT EXISTS "Order_deliveryAreaId_createdAt_idx"
  ON "Order" ("deliveryAreaId", "createdAt")
  WHERE "deliveryAreaId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "DeliveryAreaBranch" (
    "areaId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    CONSTRAINT "DeliveryAreaBranch_pkey" PRIMARY KEY ("areaId","branchId")
);

ALTER TABLE "DeliveryAreaBranch" DROP CONSTRAINT IF EXISTS "DeliveryAreaBranch_areaId_fkey";
ALTER TABLE "DeliveryAreaBranch" ADD CONSTRAINT "DeliveryAreaBranch_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "DeliveryArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryAreaBranch" DROP CONSTRAINT IF EXISTS "DeliveryAreaBranch_branchId_fkey";
ALTER TABLE "DeliveryAreaBranch" ADD CONSTRAINT "DeliveryAreaBranch_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "DeliveryAreaBranch_branchId_idx" ON "DeliveryAreaBranch"("branchId");

CREATE TABLE IF NOT EXISTS "DeliveryPause" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111',
    "scope" TEXT NOT NULL,
    "areaIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pausedById" TEXT NOT NULL,
    "pausedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "until" TIMESTAMP(3),
    "reason" TEXT NOT NULL DEFAULT '',
    "resumedAt" TIMESTAMP(3),
    CONSTRAINT "DeliveryPause_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DeliveryPause" DROP CONSTRAINT IF EXISTS "DeliveryPause_pausedById_fkey";
ALTER TABLE "DeliveryPause" ADD CONSTRAINT "DeliveryPause_pausedById_fkey"
  FOREIGN KEY ("pausedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "DeliveryPause_restaurant_active_idx"
  ON "DeliveryPause" ("restaurantId", "resumedAt", "pausedAt");
