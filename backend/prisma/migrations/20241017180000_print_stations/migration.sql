ALTER TABLE "StoreSettings" ADD COLUMN IF NOT EXISTS "autoPrintKitchenTickets" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PrintStation" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintStation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "printStationId" TEXT;

CREATE UNIQUE INDEX "PrintStation_branchId_code_key" ON "PrintStation"("branchId", "code");
CREATE INDEX "PrintStation_branchId_isActive_sortOrder_idx" ON "PrintStation"("branchId", "isActive", "sortOrder");
CREATE INDEX "MenuItem_printStationId_idx" ON "MenuItem"("printStationId");

ALTER TABLE "PrintStation" ADD CONSTRAINT "PrintStation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_printStationId_fkey" FOREIGN KEY ("printStationId") REFERENCES "PrintStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Default kitchen station for each existing branch
INSERT INTO "PrintStation" ("id", "branchId", "name", "code", "sortOrder", "isActive", "isDefault")
SELECT gen_random_uuid()::text, b."id", 'Main kitchen', 'KITCHEN', 0, true, true
FROM "Branch" b
WHERE NOT EXISTS (
  SELECT 1 FROM "PrintStation" ps WHERE ps."branchId" = b."id" AND ps."isDefault" = true
);
