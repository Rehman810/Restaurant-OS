CREATE TABLE "TenantSupportSession" (
    "id" TEXT NOT NULL,
    "subjectRestaurantId" TEXT NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantSupportSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantSupportSession_tokenHash_key" ON "TenantSupportSession"("tokenHash");
CREATE INDEX "TenantSupportSession_subjectRestaurantId_expiresAt_idx" ON "TenantSupportSession"("subjectRestaurantId", "expiresAt");
CREATE INDEX "TenantSupportSession_platformUserId_idx" ON "TenantSupportSession"("platformUserId");

ALTER TABLE "TenantSupportSession" ADD CONSTRAINT "TenantSupportSession_subjectRestaurantId_fkey" FOREIGN KEY ("subjectRestaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantSupportSession" ADD CONSTRAINT "TenantSupportSession_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
