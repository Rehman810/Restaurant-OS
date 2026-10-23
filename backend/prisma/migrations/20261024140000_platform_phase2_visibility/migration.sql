-- Phase 2: overview support tables, dunning logs, job history, broadcast enhancements

CREATE TYPE "AnnouncementPublishStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED');

ALTER TABLE "PlatformAnnouncement" ADD COLUMN IF NOT EXISTS "publishStatus" "AnnouncementPublishStatus" NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE "PlatformAnnouncement" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "PlatformAnnouncement" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
ALTER TABLE "PlatformAnnouncement" ADD COLUMN IF NOT EXISTS "excludeTestTenants" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlatformAnnouncement" ADD COLUMN IF NOT EXISTS "statsSent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlatformAnnouncement" ADD COLUMN IF NOT EXISTS "statsViewed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlatformAnnouncement" ADD COLUMN IF NOT EXISTS "notifyEmail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlatformAnnouncement" ADD COLUMN IF NOT EXISTS "notifyInApp" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "AnnouncementImpression" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementImpression_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnnouncementImpression_announcementId_restaurantId_key" ON "AnnouncementImpression"("announcementId", "restaurantId");
CREATE INDEX "AnnouncementImpression_announcementId_idx" ON "AnnouncementImpression"("announcementId");

ALTER TABLE "AnnouncementImpression" ADD CONSTRAINT "AnnouncementImpression_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "PlatformAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnouncementImpression" ADD CONSTRAINT "AnnouncementImpression_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PlatformJobRunHistory" (
    "id" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "triggeredBy" TEXT NOT NULL DEFAULT 'scheduler',

    CONSTRAINT "PlatformJobRunHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformJobRunHistory_jobKey_startedAt_idx" ON "PlatformJobRunHistory"("jobKey", "startedAt" DESC);

CREATE TABLE "PlatformInvoiceReminderLog" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "reminderKey" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformInvoiceReminderLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformInvoiceReminderLog_invoiceId_reminderKey_key" ON "PlatformInvoiceReminderLog"("invoiceId", "reminderKey");
CREATE INDEX "PlatformInvoiceReminderLog_sentAt_idx" ON "PlatformInvoiceReminderLog"("sentAt");

ALTER TABLE "PlatformInvoiceReminderLog" ADD CONSTRAINT "PlatformInvoiceReminderLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PlatformInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PlatformAuditLog_actorId_createdAt_idx" ON "PlatformAuditLog"("actorId", "createdAt");
CREATE INDEX "PlatformAuditLog_action_createdAt_idx" ON "PlatformAuditLog"("action", "createdAt");
