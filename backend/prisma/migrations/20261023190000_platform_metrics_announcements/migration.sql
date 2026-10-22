CREATE TYPE "AnnouncementSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL', 'PLAN', 'STATUS', 'TENANTS');

CREATE TABLE "TenantUsageDaily" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "usageDate" DATE NOT NULL,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "bookedPkr" INTEGER NOT NULL DEFAULT 0,
    "collectedPkr" INTEGER NOT NULL DEFAULT 0,
    "activeStaff" INTEGER NOT NULL DEFAULT 0,
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "apiRequests" INTEGER NOT NULL DEFAULT 0,
    "failedNotifications" INTEGER NOT NULL DEFAULT 0,
    "uploadBytes" BIGINT NOT NULL DEFAULT 0,
    "rowEstimate" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantUsageDaily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "severity" "AnnouncementSeverity" NOT NULL DEFAULT 'INFO',
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL',
    "audiencePlanSlug" TEXT,
    "audienceStatus" "TenantStatus",
    "audienceTenantIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "dismissible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnnouncementDismissal" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementDismissal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "version" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformJobRun" (
    "jobKey" TEXT NOT NULL,
    "lastStartedAt" TIMESTAMP(3),
    "lastFinishedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "PlatformJobRun_pkey" PRIMARY KEY ("jobKey")
);

CREATE UNIQUE INDEX "TenantUsageDaily_restaurantId_usageDate_key" ON "TenantUsageDaily"("restaurantId", "usageDate");
CREATE INDEX "TenantUsageDaily_usageDate_idx" ON "TenantUsageDaily"("usageDate");
CREATE INDEX "PlatformAnnouncement_startsAt_endsAt_idx" ON "PlatformAnnouncement"("startsAt", "endsAt");
CREATE UNIQUE INDEX "AnnouncementDismissal_announcementId_restaurantId_key" ON "AnnouncementDismissal"("announcementId", "restaurantId");
CREATE INDEX "AnnouncementDismissal_restaurantId_idx" ON "AnnouncementDismissal"("restaurantId");

ALTER TABLE "TenantUsageDaily" ADD CONSTRAINT "TenantUsageDaily_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnnouncementDismissal" ADD CONSTRAINT "AnnouncementDismissal_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "PlatformAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnouncementDismissal" ADD CONSTRAINT "AnnouncementDismissal_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "PlatformSettings" ("id", "version", "data", "updatedAt")
VALUES ('default', 1, '{"trialDays":14,"graceDays":7,"cancelRetentionDays":30,"defaultPlanSlug":"growth","supportEmail":"support@example.com"}', CURRENT_TIMESTAMP);
