-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN "specialHours" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "StoreSettings" ADD COLUMN "onlineCloseReason" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StoreSettings" ADD COLUMN "onlineClosedAt" TIMESTAMP(3);
ALTER TABLE "StoreSettings" ADD COLUMN "onlineClosedByUserId" TEXT;
ALTER TABLE "StoreSettings" ADD COLUMN "onlineReopenAt" TIMESTAMP(3);
ALTER TABLE "StoreSettings" ADD COLUMN "lastOrderCutoffMinutes" INTEGER NOT NULL DEFAULT 0;
