ALTER TABLE "User" ADD COLUMN "isOwner" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User" SET "isOwner" = true WHERE email = 'admin@admin.com';

ALTER TABLE "StoreSettings" ADD COLUMN "staffRequireTwoFaAdminManager" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StoreSettings" ADD COLUMN "staffInactivityDays" INTEGER NOT NULL DEFAULT 90;
ALTER TABLE "StoreSettings" ADD COLUMN "passwordMinLength" INTEGER NOT NULL DEFAULT 8;
