-- CreateEnum
CREATE TYPE "SoldOutUntilKind" AS ENUM ('INDEFINITE', 'END_OF_STORE_DAY', 'DATETIME');

-- Category extensions
ALTER TABLE "Category" ADD COLUMN "bannerAlt" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Category" ADD COLUMN "isVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Category" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Category" ADD COLUMN "scheduleDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "Category" ADD COLUMN "scheduleStartMinutes" INTEGER;
ALTER TABLE "Category" ADD COLUMN "scheduleEndMinutes" INTEGER;
ALTER TABLE "Category" ADD COLUMN "defaultPrintStationId" TEXT;

-- MenuItem extensions
ALTER TABLE "MenuItem" ADD COLUMN "thumbnailUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MenuItem" ADD COLUMN "imageWidth" INTEGER;
ALTER TABLE "MenuItem" ADD COLUMN "imageHeight" INTEGER;
ALTER TABLE "MenuItem" ADD COLUMN "sku" TEXT;
ALTER TABLE "MenuItem" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "MenuItem" ADD COLUMN "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "MenuItem" ADD COLUMN "prepMinutes" INTEGER;
ALTER TABLE "MenuItem" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MenuItem" ADD COLUMN "isVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MenuItem" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "MenuItem_category_sortOrder_idx" ON "MenuItem"("category", "sortOrder");
CREATE INDEX "MenuItem_archivedAt_idx" ON "MenuItem"("archivedAt");
CREATE INDEX "MenuItem_restaurantId_category_name_idx" ON "MenuItem"("restaurantId", "category", "name");

-- Backfill dish sort order within each category (stable by createdAt)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY category ORDER BY "createdAt" ASC) AS rn
  FROM "MenuItem"
)
UPDATE "MenuItem" m SET "sortOrder" = ranked.rn FROM ranked WHERE m.id = ranked.id;

-- Deal extensions
ALTER TABLE "Deal" ADD COLUMN "thumbnailUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Deal" ADD COLUMN "isVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Deal" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Deal" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Deal" ADD COLUMN "scheduleDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "Deal" ADD COLUMN "scheduleStartMinutes" INTEGER;
ALTER TABLE "Deal" ADD COLUMN "scheduleEndMinutes" INTEGER;
ALTER TABLE "Deal" ADD COLUMN "scheduleStartsAt" TIMESTAMP(3);
ALTER TABLE "Deal" ADD COLUMN "scheduleEndsAt" TIMESTAMP(3);
ALTER TABLE "Deal" ADD COLUMN "channelOnline" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Deal" ADD COLUMN "channelPos" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Deal" ADD COLUMN "channelDineIn" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Deal" ADD COLUMN "perOrderLimit" INTEGER;

CREATE INDEX "Deal_archivedAt_idx" ON "Deal"("archivedAt");
CREATE INDEX "Deal_sortOrder_idx" ON "Deal"("sortOrder");

UPDATE "Deal" SET "isVisible" = "isActive" WHERE "isVisible" IS DISTINCT FROM "isActive";

-- Per-branch availability
CREATE TABLE "MenuItemBranchAvailability" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "soldOut" BOOLEAN NOT NULL DEFAULT true,
    "untilKind" "SoldOutUntilKind" NOT NULL DEFAULT 'INDEFINITE',
    "untilAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL DEFAULT '',
    "setById" TEXT,
    "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuItemBranchAvailability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DealBranchAvailability" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "soldOut" BOOLEAN NOT NULL DEFAULT true,
    "untilKind" "SoldOutUntilKind" NOT NULL DEFAULT 'INDEFINITE',
    "untilAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL DEFAULT '',
    "setById" TEXT,
    "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealBranchAvailability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MenuItemBranchAvailability_menuItemId_branchId_key" ON "MenuItemBranchAvailability"("menuItemId", "branchId");
CREATE INDEX "MenuItemBranchAvailability_branchId_idx" ON "MenuItemBranchAvailability"("branchId");
CREATE UNIQUE INDEX "DealBranchAvailability_dealId_branchId_key" ON "DealBranchAvailability"("dealId", "branchId");
CREATE INDEX "DealBranchAvailability_branchId_idx" ON "DealBranchAvailability"("branchId");

ALTER TABLE "MenuItemBranchAvailability" ADD CONSTRAINT "MenuItemBranchAvailability_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItemBranchAvailability" ADD CONSTRAINT "MenuItemBranchAvailability_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealBranchAvailability" ADD CONSTRAINT "DealBranchAvailability_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealBranchAvailability" ADD CONSTRAINT "DealBranchAvailability_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Legacy global isAvailable=false → sold out at every active branch
INSERT INTO "MenuItemBranchAvailability" ("id", "menuItemId", "branchId", "soldOut", "untilKind", "reason")
SELECT gen_random_uuid()::text, m.id, b.id, true, 'INDEFINITE', 'legacy_global_unavailable'
FROM "MenuItem" m
CROSS JOIN "Branch" b
WHERE m."isAvailable" = false AND b."isActive" = true
  AND NOT EXISTS (
    SELECT 1 FROM "MenuItemBranchAvailability" a
    WHERE a."menuItemId" = m.id AND a."branchId" = b.id
  );
