-- Branch profile fields and online-ordering toggle
ALTER TABLE "Branch" ADD COLUMN "addressLine" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Branch" ADD COLUMN "area" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Branch" ADD COLUMN "city" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Branch" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Branch" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "Branch" ADD COLUMN "email" TEXT;
ALTER TABLE "Branch" ADD COLUMN "managerUserId" TEXT;
ALTER TABLE "Branch" ADD COLUMN "acceptsOnlineOrders" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Branch" ADD COLUMN "deactivatedAt" TIMESTAMP(3);

UPDATE "Branch" SET "addressLine" = "address" WHERE "address" <> '' AND "addressLine" = '';

ALTER TABLE "Branch" ADD CONSTRAINT "Branch_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
